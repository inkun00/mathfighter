const ENEMY_PROJECTILE_SPEED_SCALE = 0.9;

export const ENEMY_PROJECTILE_PROFILES = Object.freeze({
  frost_slime: {
    shape: 'icicle', motion: 'straight', color: '#b8f4ff', accent: '#ffffff',
    count: 1, spread: 0, speed: 5.6, radius: 5, damageScale: 1.25,
    rangeMin: 120, rangeMax: 360, cooldown: 2600
  },
  bone_archer: {
    shape: 'arrow', motion: 'straight', color: '#e8ddc4', accent: '#8edcff',
    count: 2, spread: 0.14, speed: 6.2, speedStep: -0.45, radius: 4, damageScale: 0.72,
    rangeMin: 130, rangeMax: 390, cooldown: 2350
  },
  crystal_golem: {
    shape: 'crystal', motion: 'straight', color: '#35c9ee', accent: '#d6fbff',
    count: 5, spread: 0.84, speed: 3.9, radius: 6, damageScale: 0.56,
    rangeMin: 105, rangeMax: 350, cooldown: 2850
  },
  frost_wraith: {
    shape: 'frost_orb', motion: 'homing', color: '#74bfff', accent: '#e6f6ff',
    count: 1, spread: 0, speed: 3.15, radius: 8, damageScale: 1.05, turnRate: 0.032,
    rangeMin: 95, rangeMax: 380, cooldown: 2900
  },
  bolt_turret: {
    shape: 'electric_bolt', motion: 'zigzag', color: '#55bfff', accent: '#fff56d',
    count: 3, spread: 0.08, speed: 6.5, speedStep: -0.75, radius: 5, damageScale: 0.48,
    rangeMin: 140, rangeMax: 430, cooldown: 2100
  },
  storm_slime: {
    shape: 'storm_spark', motion: 'curve', color: '#5ac8ff', accent: '#f5ff87',
    count: 6, fullCircle: true, speed: 3.65, radius: 6, damageScale: 0.5, angularVelocity: 0.012,
    rangeMin: 0, rangeMax: 280, cooldown: 2500
  },
  rune_skeleton_mage: {
    shape: 'rune_disc', motion: 'curve', color: '#7666ff', accent: '#e2ceff',
    count: 3, spread: 0.72, speed: 3.85, radius: 8, damageScale: 0.78, angularVelocity: 0.018,
    rangeMin: 0, rangeMax: 290, cooldown: 2400
  },
  tempest_djinn: {
    shape: 'wind_crescent', motion: 'accelerate', color: '#38a8ff', accent: '#d9ffff',
    count: 3, spread: 1.08, speed: 2.8, radius: 9, damageScale: 0.72, acceleration: 1.009,
    rangeMin: 0, rangeMax: 320, cooldown: 2250
  }
});

export function getEnemyProjectileProfile(templateId) {
  return ENEMY_PROJECTILE_PROFILES[templateId] || null;
}

function normalizeAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

export class MonsterProjectile {
  constructor(x, y, targetX, targetY, dmg, options = {}) {
    this.x = x;
    this.y = y;
    this.dmg = dmg;
    this.speed = (options.speed || 3.5) * ENEMY_PROJECTILE_SPEED_SCALE;
    this.radius = options.radius || 6;
    this.color = options.color || '#ffa000';
    this.accent = options.accent || '#fff4cc';
    this.shape = options.shape || 'orb';
    this.motion = options.motion || 'straight';
    this.turnRate = options.turnRate || 0;
    this.angularVelocity = options.angularVelocity || 0;
    this.acceleration = options.acceleration || 1;
    this.age = 0;
    this.lifeTime = options.lifeTime || 360;
    this.rotationOffset = options.rotationOffset || 0;
    this.trail = [];
    this.isDead = false;

    const dx = targetX - x;
    const dy = targetY - y;
    const dist = Math.hypot(dx, dy);
    this.vx = dist > 0 ? (dx / dist) * this.speed : 0;
    this.vy = dist > 0 ? (dy / dist) * this.speed : this.speed;
  }

  update(canvasWidth, canvasHeight, playerPos = null) {
    this.age++;
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 8) this.trail.shift();

    if (this.motion === 'homing' && playerPos) {
      const currentAngle = Math.atan2(this.vy, this.vx);
      const targetAngle = Math.atan2(playerPos.y - this.y, playerPos.x - this.x);
      const turn = Math.max(-this.turnRate, Math.min(this.turnRate, normalizeAngle(targetAngle - currentAngle)));
      const speed = Math.hypot(this.vx, this.vy);
      this.vx = Math.cos(currentAngle + turn) * speed;
      this.vy = Math.sin(currentAngle + turn) * speed;
    } else if (this.motion === 'curve') {
      const direction = this.rotationOffset < 0 ? -1 : 1;
      const turn = this.angularVelocity * direction;
      const cos = Math.cos(turn);
      const sin = Math.sin(turn);
      const nextVx = this.vx * cos - this.vy * sin;
      this.vy = this.vx * sin + this.vy * cos;
      this.vx = nextVx;
    } else if (this.motion === 'zigzag') {
      const turn = Math.sin(this.age * 0.78 + this.rotationOffset) * 0.045;
      const cos = Math.cos(turn);
      const sin = Math.sin(turn);
      const nextVx = this.vx * cos - this.vy * sin;
      this.vy = this.vx * sin + this.vy * cos;
      this.vx = nextVx;
    } else if (this.motion === 'accelerate') {
      this.vx *= this.acceleration;
      this.vy *= this.acceleration;
    }

    this.x += this.vx;
    this.y += this.vy;

    const margin = 80;
    if (
      this.age >= this.lifeTime ||
      this.x < -margin || this.x > canvasWidth + margin ||
      this.y < -margin || this.y > canvasHeight + margin
    ) {
      this.isDead = true;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    this.trail.forEach((point, index) => {
      const progress = (index + 1) / this.trail.length;
      ctx.globalAlpha = progress * 0.18;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(point.x, point.y, Math.max(1, this.radius * progress * 0.55), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    ctx.save();
    ctx.translate(this.x, this.y);
    const angle = Math.atan2(this.vy, this.vx);
    ctx.rotate(angle);
    ctx.fillStyle = this.color;
    ctx.strokeStyle = this.accent;
    ctx.lineWidth = 2;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 8;

    if (this.shape === 'icicle') {
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-4, -5);
      ctx.lineTo(-11, 0);
      ctx.lineTo(-4, 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (this.shape === 'arrow') {
      ctx.beginPath();
      ctx.moveTo(-13, 0);
      ctx.lineTo(10, 0);
      ctx.moveTo(10, 0);
      ctx.lineTo(3, -5);
      ctx.moveTo(10, 0);
      ctx.lineTo(3, 5);
      ctx.moveTo(-10, 0);
      ctx.lineTo(-14, -4);
      ctx.moveTo(-10, 0);
      ctx.lineTo(-14, 4);
      ctx.stroke();
    } else if (this.shape === 'crystal') {
      ctx.rotate(this.age * 0.12);
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(0, -7);
      ctx.lineTo(-8, 0);
      ctx.lineTo(0, 7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = this.accent;
      ctx.fillRect(-1, -4, 2, 8);
    } else if (this.shape === 'frost_orb') {
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + Math.sin(this.age * 0.2) * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 5, 0, Math.PI * 2);
      ctx.globalAlpha = 0.45;
      ctx.stroke();
    } else if (this.shape === 'electric_bolt') {
      ctx.beginPath();
      ctx.moveTo(-14, 0);
      for (let i = 1; i <= 5; i++) {
        const x = -14 + i * 5.5;
        const y = Math.sin(this.age * 1.7 + i * 2.3) * 4;
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.strokeStyle = this.accent;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (this.shape === 'storm_spark') {
      ctx.rotate(this.age * 0.18);
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const radius = i % 2 === 0 ? 10 : 3;
        const pointAngle = i * Math.PI / 4;
        const x = Math.cos(pointAngle) * radius;
        const y = Math.sin(pointAngle) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (this.shape === 'rune_disc') {
      ctx.rotate(this.age * 0.16 + this.rotationOffset);
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const pointAngle = i * Math.PI * 2 / 3;
        const x = Math.cos(pointAngle) * 7;
        const y = Math.sin(pointAngle) * 7;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    } else if (this.shape === 'wind_crescent') {
      ctx.beginPath();
      ctx.arc(0, 0, 12, -1.15, 1.15);
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(1, 0, 12, -1.05, 1.05);
      ctx.strokeStyle = this.accent;
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    if (this.age < 10) {
      ctx.globalAlpha = (10 - this.age) / 10;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + this.age * 2, 0, Math.PI * 2);
      ctx.strokeStyle = this.accent;
      ctx.stroke();
    }
    ctx.restore();
  }
}

export function createEnemyProjectileVolley(templateId, source, target, baseDamage, speedScale = 1) {
  const profile = getEnemyProjectileProfile(templateId);
  if (!profile) return [];

  const baseAngle = Math.atan2(target.y - source.y, target.x - source.x);
  return Array.from({ length: profile.count }, (_, index) => {
    const centeredIndex = index - (profile.count - 1) / 2;
    const angle = profile.fullCircle
      ? baseAngle + index * Math.PI * 2 / profile.count
      : baseAngle + centeredIndex * (profile.count <= 1 ? 0 : profile.spread / (profile.count - 1));
    const speed = (profile.speed + centeredIndex * (profile.speedStep || 0)) * speedScale;
    const curveDirection = index % 2 === 0 ? 1 : -1;

    return new MonsterProjectile(
      source.x,
      source.y,
      source.x + Math.cos(angle) * 100,
      source.y + Math.sin(angle) * 100,
      baseDamage * profile.damageScale,
      {
        ...profile,
        speed,
        rotationOffset: curveDirection * (index + 1) * 0.35
      }
    );
  });
}
