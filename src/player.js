import { getStatValue, getEquippedWeapons, WEAPONS_DB, getWeaponLevel } from './shop.js';
import {
  getWeaponBehavior,
  getWeaponPatternProfile,
  getWeaponPowerScale,
  getWeaponRange,
  getWeaponTierMultiplier,
  getWeaponVisualProfile
} from './weaponProfiles.js';

const projectileIconCache = new Map();
const firePatchSheet = new Image();
firePatchSheet.src = '/assets/effects/fire_patch_sheet.png';
const electromagneticLaserSheet = new Image();
electromagneticLaserSheet.src = '/assets/effects/electromagnetic_laser_beam.png';

function getProjectileIconImage(id) {
  if (!projectileIconCache.has(id)) {
    const img = new Image();
    img.src = `/assets/projectiles/projectile_${String(id).padStart(2, '0')}.png`;
    projectileIconCache.set(id, img);
  }
  return projectileIconCache.get(id);
}

const HOMING_BEHAVIORS = new Set(['homing', 'chain_lightning', 'missile_swarm']);
const RAIL_BEHAVIORS = new Set(['rail_laser', 'plasma_rail']);
const STATIONARY_BEHAVIORS = new Set(['mine', 'fire_patch', 'gravity_well', 'rail_laser', 'plasma_rail']);

function getWeaponLevelBonus(id) {
  const level = getWeaponLevel(id);
  const bonus = level - 1;
  return {
    level,
    damageScale: 1 + bonus * 0.1,
    sizeScale: 1 + bonus * 0.06,
    splashScale: 1 + bonus * 0.08,
    projectileBonus: Math.floor(bonus / 3)
  };
}

function getWeaponStatusEffect(id) {
  if ([6, 17, 22, 27].includes(id)) return { type: 'burn', duration: id >= 22 ? 4200 : 3000, power: id >= 22 ? 0.18 : 0.12 };
  if ([13, 23, 24].includes(id)) return { type: 'shock', duration: id >= 23 ? 1800 : 900, slow: id >= 23 ? 0.55 : 0.75 };
  if ([15, 25].includes(id)) return { type: 'gravity', duration: id >= 25 ? 3200 : 1800, slow: id >= 25 ? 0.42 : 0.62 };
  if ([14, 27].includes(id)) return { type: 'poison', duration: 3600, power: 0.1 };
  if ([18].includes(id)) return { type: 'stun', duration: 900, slow: 0.25 };
  return null;
}

function getSlotAngleOffset(slotIndex, slotCount) {
  if (slotCount <= 1) return 0;
  const offsets = slotCount >= 3 ? [-0.1, 0, 0.1] : [-0.07, 0.07];
  return offsets[slotIndex] || 0;
}


// Projectile Class representing weapons bullet/slashes in action
export class Projectile {
  constructor(x, y, targetX, targetY, weapon, player, options = {}) {
    try {
      this.x = x;
      this.y = y;
      this.type = weapon.type;
      this.behavior = options.behavior || getWeaponBehavior(weapon.id, weapon.type);
      const damageMultiplier = options.damageMultiplier || 1;
      const levelBonus = getWeaponLevelBonus(weapon.id);
      this.dmg = weapon.dmg * getWeaponPowerScale(weapon.id) * levelBonus.damageScale * (1 + getStatValue('atk') / 100) * (player.atkMultiplier || 1) * damageMultiplier;
      this.symbol = weapon.symbol;
      this.speed = 6 * (options.speedMultiplier || 1);
      this.radius = Math.round((options.radius || (['mine', 'fire_patch', 'gravity_well'].includes(this.behavior) ? 20 : 12)) * levelBonus.sizeScale);
      this.color = '#00ffff';
      this.lifeTime = options.lifeTime || (RAIL_BEHAVIORS.has(this.behavior) ? 280 : this.behavior === 'gravity_well' ? 5200 : this.behavior === 'mine' ? 7000 : this.behavior === 'boomerang' ? 2800 : 2000);
      this.createdTime = Date.now();
      this.startX = x;
      this.startY = y;
      this.maxRange = options.maxRange || getWeaponRange(weapon.id, this.behavior);
      this.lastAreaTickTime = 0;
      this.areaTickInterval = 350;
      this.hitCount = 0;
      this.pierceLimit = ['shockwave', 'nova', 'plasma_rail', 'gravity_well', 'void_pierce', 'dash_wave'].includes(this.behavior)
        ? 999
        : this.behavior === 'pierce'
          ? (weapon.id >= 20 ? 999 : 5)
          : this.behavior === 'boomerang'
            ? 8
            : 1;
      this.hitTargets = new WeakSet();
      this.splashRadius = ['explosive', 'cone_blast', 'mine', 'throw_fire', 'fire_patch', 'shockwave', 'nova', 'gravity_well', 'void_pierce', 'elemental_bolt', 'missile_swarm', 'dash_wave'].includes(this.behavior) || this.type === 'splash' || [15, 23, 25, 28].includes(weapon.id)
        ? (weapon.id >= 30 ? 145 : weapon.id >= 23 ? 118 : weapon.id >= 20 ? 105 : weapon.id === 8 ? 52 : 65)
        : 0;
      this.splashRadius = Math.round(this.splashRadius * levelBonus.splashScale);
      this.isDead = false;
      this.player = player;
      this.id = weapon.id;
      this.statusEffect = options.statusEffect || getWeaponStatusEffect(weapon.id);
      this.isParabolic = Boolean(weapon.name && weapon.name.includes("투척기"));
      this.z = 0;

      // Homing setup
      this.targetMonster = null;

      // Calculate angle/velocity towards targets
      const dx = targetX - x;
      const dy = targetY - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const baseAngle = Math.atan2(dy, dx);
      this.angle = Number.isFinite(baseAngle) ? baseAngle + (options.angleOffset || 0) : (options.angleOffset || 0);
      this.vx = Math.cos(this.angle) * this.speed;
      this.vy = Math.sin(this.angle) * this.speed;

      // Custom properties for specific weapons
      if (RAIL_BEHAVIORS.has(this.behavior)) {
        this.speed = 0;
        this.vx = 0;
        this.vy = 0;
        this.radius = Math.max(this.radius, 18);
        this.pierceLimit = 999;
      }
      if (this.behavior === 'boomerang') {
        this.isReturning = false;
      }
      if (this.behavior === 'orbit') {
        this.orbitRadius = 35 + (options.orbitIndex || 0) * 18;
        this.orbitAngle = options.orbitAngle || 0;
        this.orbitSpeed = 0.05;
      }
      if (this.behavior === 'gravity_well') {
        this.x = targetX;
        this.y = targetY;
        this.startX = targetX;
        this.startY = targetY;
        this.speed = 0;
        this.vx = 0;
        this.vy = 0;
        this.radius = Math.max(this.radius, 28);
        this.splashRadius = Math.max(this.splashRadius, Math.round(135 * levelBonus.splashScale));
      }
    } catch (err) {
      window.alert("Error in Projectile constructor: " + err.stack);
    }
  }

  update(monsters, playerPos) {
    try {
      const elapsed = Date.now() - this.createdTime;
      if (elapsed > this.lifeTime) {
        this.isDead = true;
        return;
      }

      if (STATIONARY_BEHAVIORS.has(this.behavior)) {
        return;
      }

      // Orbiting weapons move relative to player
      if (this.behavior === 'orbit') {
        this.orbitRadius = Math.min(95, this.orbitRadius + 0.7);
        this.orbitAngle += this.orbitSpeed;
        this.x = playerPos.x + Math.cos(this.orbitAngle) * this.orbitRadius;
        this.y = playerPos.y + Math.sin(this.orbitAngle) * this.orbitRadius;
        return;
      }

      // Homing logic: update target if needed
      if (HOMING_BEHAVIORS.has(this.behavior) && monsters.length > 0) {
        // Find closest active monster
        let closest = null;
        let minDist = Infinity;
        monsters.forEach(m => {
          if (m.hp <= 0) return;
          const dx = m.x - this.x;
          const dy = m.y - this.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDist) {
            minDist = dist;
            closest = m;
          }
        });

        if (closest) {
          this.targetMonster = closest;
          const dx = closest.x - this.x;
          const dy = closest.y - this.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0) {
            // Smoothly interpolate velocity
            const tx = (dx / dist) * this.speed;
            const ty = (dy / dist) * this.speed;
            this.vx = this.vx * 0.9 + tx * 0.1;
            this.vy = this.vy * 0.9 + ty * 0.1;
            this.angle = Math.atan2(this.vy, this.vx);
          }
        }
      }

      // Shears return logic
      if (this.behavior === 'boomerang') {
        if (elapsed > this.lifeTime / 2) {
          if (!this.isReturning) {
            this.isReturning = true;
            this.hitTargets = new WeakSet();
          }
        }
        if (this.isReturning) {
          const dx = playerPos.x - this.x;
          const dy = playerPos.y - this.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0) {
            this.vx = (dx / dist) * this.speed;
            this.vy = (dy / dist) * this.speed;
          }
        }
      }

      // Normal straight travel
      this.x += this.vx;
      this.y += this.vy;

      const traveledX = this.x - this.startX;
      const traveledY = this.y - this.startY;
      const traveled = Math.sqrt(traveledX * traveledX + traveledY * traveledY);
      
      if (this.isParabolic) {
        const progress = Math.min(1, traveled / this.maxRange);
        this.z = Math.sin(progress * Math.PI) * 110; // 110px peak height
      }

      if (traveled >= this.maxRange) {
        if (this.behavior === 'boomerang' && !this.isReturning) {
          this.isReturning = true;
          this.hitTargets = new WeakSet();
        } else if (this.behavior === 'throw_fire') {
          this.activateFirePatch();
        } else {
          this.isDead = true;
        }
      }
    } catch (err) {
      window.alert("Error in Projectile.update: " + err.stack);
    }
  }

  activateFirePatch() {
    const levelBonus = getWeaponLevelBonus(this.id);
    this.behavior = 'fire_patch';
    this.vx = 0;
    this.vy = 0;
    this.radius = Math.max(this.radius, 24);
    this.splashRadius = Math.round((this.id >= 22 ? 55 : 38) * levelBonus.splashScale);
    this.lifeTime = this.id >= 22 ? 5200 : 4200;
    this.createdTime = Date.now();
    this.angle = 0;
    this.z = 0;
    this.isParabolic = false;
  }

  canApplyAreaTick(now) {
    if (now - this.lastAreaTickTime < this.areaTickInterval) return false;
    this.lastAreaTickTime = now;
    return true;
  }

  draw(ctx) {
    const visualProfile = getWeaponVisualProfile(this.id);

    // Tesla Fusion Gun (ID 23) special lightning drawing: Character's body to target monster
    if (this.id === 23) {
      if (!this.player) return;
      ctx.save();
      
      const startX = this.player.x;
      const startY = this.player.y;
      const targetX = (this.targetMonster && this.targetMonster.hp > 0) ? this.targetMonster.x : this.x;
      const targetY = (this.targetMonster && this.targetMonster.hp > 0) ? this.targetMonster.y : this.y;
      
      const drawLightningArc = (x1, y1, x2, y2, displace, thick, color) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = thick;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const steps = Math.max(3, Math.floor(dist / 14));
        
        for (let i = 1; i < steps; i++) {
          const t = i / steps;
          let px = x1 + dx * t;
          let py = y1 + dy * t;
          
          const nx = -dy / (dist || 1);
          const ny = dx / (dist || 1);
          const offset = (Math.random() - 0.5) * displace;
          
          px += nx * offset;
          py += ny * offset;
          ctx.lineTo(px, py);
        }
        ctx.lineTo(x2, y2);
        ctx.stroke();
      };
      
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // Outer glow blue aura
      ctx.shadowBlur = visualProfile.glowBlur;
      ctx.shadowColor = '#00f6ff';
      drawLightningArc(startX, startY, targetX, targetY, 16, 4.8, 'rgba(0, 212, 255, 0.45)');
      
      // Middle cyan glow
      ctx.shadowBlur = 0;
      drawLightningArc(startX, startY, targetX, targetY, 11, 2.6, 'rgba(172, 246, 255, 0.8)');
      
      // Core white lightning bolt
      drawLightningArc(startX, startY, targetX, targetY, 7, 1.2, '#ffffff');

      // Static discharges around target
      const sparkCount = visualProfile.rank + 2 + Math.floor(Math.random() * 3);
      for (let s = 0; s < sparkCount; s++) {
        const angle = Math.random() * Math.PI * 2;
        const sparkLen = 9 + Math.random() * 15;
        const sx = targetX + Math.cos(angle) * sparkLen;
        const sy = targetY + Math.sin(angle) * sparkLen;
        drawLightningArc(targetX, targetY, sx, sy, 5, 1, '#b5f9ff');
      }

      ctx.restore();
      return;
    }

    ctx.save();

    // 1. Draw shadow on the ground if parabolic
    if (this.isParabolic && this.z > 0) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      const shadowScale = Math.max(0.4, 1 - (this.z / 110) * 0.45);
      ctx.beginPath();
      ctx.ellipse(0, 0, this.radius * 1.3 * shadowScale, this.radius * 0.65 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 2. Translate coordinates and apply z-height Y offset
    ctx.translate(this.x, this.y - (this.z || 0));
    ctx.rotate(this.angle);

    if (this.behavior === 'gravity_well') {
      const elapsed = Date.now() - this.createdTime;
      const pulse = 0.82 + Math.sin(elapsed / 110) * 0.12;
      ctx.rotate(-this.angle + elapsed / 650);
      ctx.globalAlpha = 0.82;
      ctx.strokeStyle = '#b35cff';
      ctx.fillStyle = 'rgba(35, 0, 70, 0.58)';
      ctx.shadowColor = '#d884ff';
      ctx.shadowBlur = visualProfile.glowBlur;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, this.splashRadius * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      for (let ring = 1; ring <= 3; ring++) {
        ctx.globalAlpha = 0.5 / ring;
        ctx.beginPath();
        ctx.arc(0, 0, this.splashRadius * (0.28 + ring * 0.18) * pulse, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    if (RAIL_BEHAVIORS.has(this.behavior)) {
      const elapsed = Date.now() - this.createdTime;
      const progress = Math.min(1, elapsed / this.lifeTime);
      const alpha = Math.sin(progress * Math.PI);
      const frameCount = 5;
      const frame = Math.min(frameCount - 1, Math.floor((elapsed / this.lifeTime) * frameCount));
      const beamLength = this.maxRange;
      const beamHeight = this.radius * (this.behavior === 'plasma_rail' ? 4.6 : 3.2);

      ctx.globalAlpha = Math.max(0.28, alpha);
      ctx.shadowColor = this.behavior === 'plasma_rail' ? '#ff4dff' : '#00eaff';
      ctx.shadowBlur = visualProfile.glowBlur;

      if (electromagneticLaserSheet.complete && electromagneticLaserSheet.naturalWidth !== 0) {
        const sw = electromagneticLaserSheet.naturalWidth;
        const sh = electromagneticLaserSheet.naturalHeight / frameCount;
        ctx.drawImage(
          electromagneticLaserSheet,
          0,
          frame * sh,
          sw,
          sh,
          -18,
          -beamHeight / 2,
          beamLength + 36,
          beamHeight
        );
      } else {
        ctx.strokeStyle = '#bffcff';
        ctx.lineWidth = beamHeight * 0.42;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(beamLength, 0);
        ctx.stroke();
        ctx.strokeStyle = '#00d9ff';
        ctx.lineWidth = beamHeight;
        ctx.globalAlpha = Math.max(0.12, alpha * 0.38);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(beamLength, 0);
        ctx.stroke();
      }

      ctx.restore();
      return;
    }

    if (this.behavior === 'fire_patch') {
      const elapsed = Date.now() - this.createdTime;
      const frame = Math.floor(elapsed / 80) % 16;
      const col = frame % 4;
      const row = Math.floor(frame / 4);

      if (firePatchSheet.complete && firePatchSheet.naturalWidth !== 0) {
        const sw = firePatchSheet.naturalWidth / 4;
        const sh = firePatchSheet.naturalHeight / 4;
        const pulse = 0.94 + Math.sin(Date.now() / 120) * 0.06;
        const drawSize = this.splashRadius * 2.45 * pulse;
        ctx.rotate(Math.sin(elapsed / 420) * 0.08);
        ctx.globalAlpha = 0.92;
        ctx.shadowColor = '#ff7a00';
        ctx.shadowBlur = 14;
        ctx.drawImage(
          firePatchSheet,
          col * sw,
          row * sh,
          sw,
          sh,
          -drawSize / 2,
          -drawSize / 2,
          drawSize,
          drawSize
        );
      } else {
        const pulse = 0.85 + Math.sin(Date.now() / 90) * 0.15;
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = 'rgba(255, 95, 0, 0.75)';
        ctx.strokeStyle = 'rgba(255, 215, 80, 0.85)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, this.splashRadius * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    const iconImg = getProjectileIconImage(this.id);
    if (iconImg.complete && iconImg.naturalWidth !== 0) {
      if (visualProfile.trailCount > 0 && !['mine', 'orbit'].includes(this.behavior)) {
        ctx.fillStyle = visualProfile.color;
        ctx.shadowColor = visualProfile.color;
        ctx.shadowBlur = visualProfile.glowBlur * 0.65;
        for (let i = visualProfile.trailCount; i >= 1; i--) {
          ctx.globalAlpha = 0.08 + (visualProfile.trailCount - i) * 0.06;
          ctx.beginPath();
          ctx.arc(-i * (6 + visualProfile.rank), 0, Math.max(2, this.radius * (1 - i * 0.1)), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      ctx.shadowColor = visualProfile.color;
      ctx.shadowBlur = visualProfile.glowBlur;
      const drawSize = this.behavior === 'mine'
        ? visualProfile.drawSize + 10
        : visualProfile.drawSize;
      ctx.drawImage(iconImg, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
      if (visualProfile.rank >= 4) {
        ctx.globalAlpha = 0.72;
        ctx.strokeStyle = visualProfile.color;
        ctx.lineWidth = Math.max(2, visualProfile.rank - 2);
        ctx.beginPath();
        ctx.arc(0, 0, drawSize * 0.62, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (this.behavior === 'mine') {
        ctx.strokeStyle = 'rgba(255, 170, 0, 0.65)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius + 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    // Render retro projectile look
    if (this.type === 'hit') {
      // Swords / Claws: draw slash arc
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, -Math.PI / 4, Math.PI / 4);
      ctx.stroke();
      
      // Draw weapon symbol
      ctx.font = '14px Arial';
      ctx.fillText(this.symbol, -5, 5);
    } else if (this.type === 'pierce') {
      // Laser / Spear / Chakram
      ctx.strokeStyle = '#00ffff';
      ctx.fillStyle = 'rgba(0, 255, 255, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.font = '14px Arial';
      ctx.fillText(this.symbol, -7, 5);
    } else if (this.type === 'splash') {
      // Firebomb / Napalm
      ctx.fillStyle = '#ff5500';
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = '14px Arial';
      ctx.fillText(this.symbol, -7, 5);
    } else {
      // Homing / Magic
      ctx.fillStyle = '#ff00ff';
      ctx.shadowColor = '#ff00ff';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = '14px Arial';
      ctx.fillText(this.symbol, -7, 5);
    }

    ctx.restore();
  }
}

// Player Character Class
export class Player {
  constructor(x, y, name = "길동", gender = "male") {
    this.x = x;
    this.y = y;
    this.name = name;
    this.gender = gender;
    this.radius = 16;
    
    // Upgraded base stats load
    this.maxHp = 100 + getStatValue('maxHp');
    this.hp = this.maxHp;
    this.defense = getStatValue('def');
    this.baseSpeed = 3.2;
    this.magnetRange = 50 + getStatValue('magnet');
    this.atkMultiplier = 1;
    this.fireRateMultiplier = 1;
    this.projectileSpeedMultiplier = 1;
    this.expMultiplier = 1;
    this.bonusMaxHp = 0;
    this.bonusDefense = 0;
    this.bonusMagnet = 0;
    
    // Level & Exp System
    this.level = 1;
    this.exp = 0;
    this.nextLevelExp = 100;
    this.gold = 0;

    this.lastShotTime = 0;
    this.lastShotTimes = {};
    this.isHitFlash = 0; // Tick timer for flashing white when damaged

    // Load sprite sheets depending on gender choice
    this.sheetImg = new Image();
    this.sheetImg.src = gender === 'female' ? '/assets/player_sheet_female.png' : '/assets/player_sheet.png';
    this.spriteSize = 80; // Rendered sprite display size in pixels

    // Animation states
    this.facing = 1; // 1 = Right, -1 = Left
    this.isMoving = false;
    this.direction = 'down'; // 'down', 'up', 'side'
  }

  // Reload/Sync stats after store purchases
  refreshStats() {
    const prevMax = this.maxHp;
    this.maxHp = 100 + getStatValue('maxHp') + this.bonusMaxHp;
    // Heal the delta amount
    if (this.maxHp > prevMax) {
      this.hp += (this.maxHp - prevMax);
    }
    this.hp = Math.floor(Math.min(this.maxHp, this.hp));
    this.defense = getStatValue('def') + this.bonusDefense;
    this.magnetRange = 50 + getStatValue('magnet') + this.bonusMagnet;
  }

  update(keys, canvasWidth, canvasHeight) {
    let dx = 0;
    let dy = 0;

    // Keyboard inputs
    if (keys['ArrowUp'] || keys['w'] || keys['W']) dy = -1;
    if (keys['ArrowDown'] || keys['s'] || keys['S']) dy = 1;
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) dx = -1;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) dx = 1;

    // Normalise speed for diagonal moves
    if (dx !== 0 && dy !== 0) {
      dx *= 0.7071;
      dy *= 0.7071;
    }

    const mobileMoveSpeedScale = keys.__mobileBrowserActive ? 0.5 : 1;

    // Apply movement
    this.x += dx * this.baseSpeed * mobileMoveSpeedScale;
    this.y += dy * this.baseSpeed * mobileMoveSpeedScale;

    // Boundary constraints
    this.x = Math.max(this.radius, Math.min(canvasWidth - this.radius, this.x));
    this.y = Math.max(this.radius, Math.min(canvasHeight - this.radius, this.y));

    // Update animation states based on movement values
    if (dx > 0) this.facing = 1;
    else if (dx < 0) this.facing = -1;

    if (Math.abs(dy) > Math.abs(dx)) {
      this.direction = dy > 0 ? 'down' : 'up';
    } else if (dx !== 0) {
      this.direction = 'side';
    }

    this.isMoving = dx !== 0 || dy !== 0;

    // Flash timer countdown
    if (this.isHitFlash > 0) this.isHitFlash--;
  }

  // Automatic weapon shoot routine
  shoot(monsters, projectiles, boss = null) {
    try {
      const weapons = getEquippedWeapons();
      const now = Date.now();

      weapons.forEach((weapon, index) => {
        const slotKey = String(weapon.id);
        const lastShotTime = this.lastShotTimes[slotKey] || 0;
        const cooldown = weapon.cooldown / this.fireRateMultiplier;
        if (now - lastShotTime < cooldown) return;
        const behavior = getWeaponBehavior(weapon.id, weapon.type);
        const weaponRange = getWeaponRange(weapon.id, behavior);
        const levelBonus = getWeaponLevelBonus(weapon.id);
        const patternProfile = getWeaponPatternProfile(
          weapon.id,
          behavior,
          levelBonus.projectileBonus
        );

        // Find closest active monster
        let closest = null;
        let minDist = Infinity;

        monsters.forEach(m => {
          if (m.hp <= 0) return;
          const dx = m.x - this.x;
          const dy = m.y - this.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= weaponRange && dist < minDist) {
            minDist = dist;
            closest = m;
          }
        });

        if (boss && boss.hp > 0) {
          const dx = boss.x - this.x;
          const dy = boss.y - this.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= weaponRange && (!closest || dist < minDist)) {
            minDist = dist;
            closest = boss;
          }
        }

        if (closest) {
          // Spawn weapon shot projectile targeting closest monster
          const slotOffsets = weapons.length === 3 ? [-12, 0, 12] : [-8, 8];
          const xOffset = weapons.length > 1 ? slotOffsets[index] : 0;
          const slotDamageMultipliers = weapons.length >= 3 ? [0.9, 0.8, 0.72] : [0.95, 0.82];
          const dualWieldMultiplier = weapons.length > 1 ? slotDamageMultipliers[index] : 1;
          const tierMultiplier = getWeaponTierMultiplier(weapon.id);
          const damageMultiplier = dualWieldMultiplier * tierMultiplier;
          const slotAngleOffset = getSlotAngleOffset(index, weapons.length);
          const targetX = closest.x;
          const targetY = closest.y;

          const spawnProjectile = (angleOffset = 0, extra = {}) => {
            projectiles.push(new Projectile(this.x + xOffset, this.y, targetX, targetY, weapon, this, {
              behavior,
              angleOffset: angleOffset + slotAngleOffset,
              damageMultiplier,
              maxRange: weaponRange,
              ...extra
            }));
          };

          if (['cone_blast', 'dash_wave'].includes(behavior)) {
            const blastCount = patternProfile.count;
            const blastSpread = weapon.id >= 21 ? 1.45 : weapon.id >= 11 ? 1.18 : 0.95;
            for (let i = 0; i < blastCount; i++) {
              const centeredIndex = i - (blastCount - 1) / 2;
              spawnProjectile(centeredIndex * (blastSpread / (blastCount - 1)), {
                behavior,
                damageMultiplier: damageMultiplier * patternProfile.damageScale,
                speedMultiplier: weapon.id >= 21 ? 1.05 : 0.92,
                maxRange: weaponRange,
                radius: weapon.id >= 21 ? 22 : 16
              });
            }
          } else if (['spread', 'elemental_burst', 'missile_swarm'].includes(behavior)) {
            const spreadCount = patternProfile.count;
            const spreadStep = weapon.id >= 28 ? Math.PI * 2 / spreadCount : 0.22;
            for (let i = 0; i < spreadCount; i++) {
              const centeredIndex = i - (spreadCount - 1) / 2;
              const angleOffset = weapon.id >= 28 ? i * spreadStep : centeredIndex * spreadStep;
              const elementalEffects = [
                { type: 'burn', duration: 3600, power: 0.12 },
                { type: 'gravity', duration: 1800, slow: 0.55 },
                { type: 'shock', duration: 1500, slow: 0.5 }
              ];
              spawnProjectile(angleOffset, {
                behavior: weapon.id === 12
                  ? 'explosive'
                  : behavior === 'missile_swarm'
                    ? 'missile_swarm'
                    : behavior === 'elemental_burst'
                      ? 'elemental_bolt'
                      : 'pierce',
                damageMultiplier: damageMultiplier * patternProfile.damageScale,
                speedMultiplier: 1.05,
                statusEffect: behavior === 'elemental_burst'
                  ? elementalEffects[i % elementalEffects.length]
                  : undefined
              });
            }
          } else if (behavior === 'shockwave') {
            const waveCount = patternProfile.count;
            for (let i = 0; i < waveCount; i++) {
              spawnProjectile((Math.PI * 2 / waveCount) * i, {
                behavior: 'shockwave',
                damageMultiplier: damageMultiplier * patternProfile.damageScale,
                speedMultiplier: 0.95,
                radius: 18,
                lifeTime: 1600
              });
            }
          } else if (behavior === 'nova') {
            const waveCount = patternProfile.count;
            for (let i = 0; i < waveCount; i++) {
              spawnProjectile((Math.PI * 2 / waveCount) * i, {
                behavior: 'nova',
                damageMultiplier: damageMultiplier * patternProfile.damageScale,
                speedMultiplier: 0.9,
                radius: 24,
                lifeTime: 2200
              });
            }
          } else if (behavior === 'mine') {
            const mineCount = patternProfile.count;
            for (let i = 0; i < mineCount; i++) {
              const angle = (Math.PI * 2 / mineCount) * i + Math.random() * 0.4;
              const distance = 35 + Math.random() * 45;
              projectiles.push(new Projectile(
                this.x + Math.cos(angle) * distance,
                this.y + Math.sin(angle) * distance,
                this.x + Math.cos(angle) * (distance + 1),
                this.y + Math.sin(angle) * (distance + 1),
                weapon,
                this,
                {
                  behavior: 'mine',
                  damageMultiplier: damageMultiplier * patternProfile.damageScale,
                  lifeTime: weapon.id >= 22 ? 9000 : 6500,
                  radius: weapon.id >= 22 ? 24 : 18
                }
              ));
            }
          } else if (behavior === 'orbit') {
            const orbitCount = patternProfile.count;
            for (let i = 0; i < orbitCount; i++) {
              spawnProjectile(0, {
                orbitIndex: i,
                orbitAngle: (Math.PI * 2 / orbitCount) * i,
                damageMultiplier: damageMultiplier * patternProfile.damageScale,
                lifeTime: 3600
              });
            }
          } else {
            const throwCount = patternProfile.count;
            for (let i = 0; i < throwCount; i++) {
              const centeredIndex = i - (throwCount - 1) / 2;
              spawnProjectile(centeredIndex * 0.34, behavior === 'throw_fire' ? {
                speedMultiplier: 0.85,
                lifeTime: weapon.id >= 22 ? 5600 : 5000,
                radius: weapon.id >= 22 ? 18 : 14,
                damageMultiplier: damageMultiplier * patternProfile.damageScale
              } : {});
            }
          }

          this.lastShotTimes[slotKey] = now;
          this.lastShotTime = now;
        }
      });
    } catch (err) {
      window.alert("Error in Player.shoot: " + err.stack);
    }
  }

  takeDamage(amount) {
    const netDmg = Math.max(1, Math.floor(amount - this.defense));
    this.hp = Math.floor(this.hp - netDmg);
    this.isHitFlash = 14; // short natural hit feedback
    if (this.hp < 0) this.hp = 0;
  }

  heal(amount) {
    this.hp = Math.floor(Math.min(this.maxHp, this.hp + amount));
  }

  gainExp(amount) {
    this.exp += Math.floor(amount * this.expMultiplier);
    if (this.exp >= this.nextLevelExp) {
      this.levelUp();
      return true; // Leveled up trigger
    }
    return false;
  }

  levelUp() {
    this.exp -= this.nextLevelExp;
    this.level += 1;
    this.nextLevelExp = Math.floor(this.nextLevelExp * 1.3);
    this.maxHp = 100 + getStatValue('maxHp') + this.bonusMaxHp;
    this.hp = this.maxHp; // Full heal on level up
  }

  draw(ctx) {
    ctx.save();
    
    const hitRatio = this.isHitFlash > 0 ? this.isHitFlash / 14 : 0;

    // Apply hit shake effect
    let shakeX = 0;
    if (this.isHitFlash > 0) {
      shakeX = Math.sin(Date.now() * 0.18) * 2.2 * hitRatio;
    }
    
    ctx.translate(this.x + shakeX, this.y);

    // Apply movement squash & stretch animation
    let scaleX = 1;
    let scaleY = 1;
    if (this.isMoving) {
      const angleFreq = Date.now() * 0.018;
      scaleY = 1 + Math.sin(angleFreq) * 0.05;
      scaleX = 1 - Math.sin(angleFreq) * 0.03;
    } else {
      // Idle breathing pulse
      scaleY = 1 + Math.sin(Date.now() * 0.003) * 0.02;
    }

    // Apply scaling (only squash/stretch, no direction flip since sheet contains left/right columns)
    ctx.scale(scaleX, scaleY);

    if (this.sheetImg.complete && this.sheetImg.naturalWidth !== 0) {
      // Calculate sprite sheet frame bounds (4 Columns, 4 Rows)
      const sw = this.sheetImg.naturalWidth / 4;
      const sh = this.sheetImg.naturalHeight / 4;
      
      // Determine Row index: 0 = down, 1 = left, 2 = right, 3 = up
      let row = 0;
      if (this.direction === 'up') {
        row = 3;
      } else if (this.direction === 'side') {
        row = this.facing === 1 ? 2 : 1; // 2 = right, 1 = left
      }
      
      // Determine Column index (4 frames walking cycle)
      const col = this.isMoving ? (Math.floor(Date.now() / 100) % 4) : 0;
      
      const sx = col * sw;
      const sy = row * sh;

      // Draw 2D sprite frame from sheet (centered on player position)
      const ss = this.spriteSize;
      ctx.drawImage(this.sheetImg, sx, sy, sw, sh, -ss / 2, -ss / 2, ss, ss);
      
      if (this.isHitFlash > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'source-atop';
        ctx.globalAlpha = 0.28 * hitRatio;
        ctx.fillStyle = '#ff3b5f';
        ctx.beginPath();
        ctx.ellipse(0, 0, ss * 0.42, ss * 0.48, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    } else {
      // Fallback retro shapes if asset is loading
      if (this.isHitFlash > 0) {
        ctx.fillStyle = '#ff6b6b';
      } else {
        ctx.fillStyle = '#39ff14'; // Math Fighter green suit
      }

      // Draw retro helmet player body
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Helmet visor
      ctx.fillStyle = '#00ffff';
      ctx.beginPath();
      ctx.arc(4, -2, 6, -Math.PI / 3, Math.PI / 3);
      ctx.fill();
    }

    ctx.restore();

    if (this.isHitFlash > 0) {
      ctx.save();
      const progress = 1 - hitRatio;
      const ringRadius = this.radius + 8 + progress * 18;
      ctx.globalAlpha = hitRatio * 0.75;
      ctx.strokeStyle = '#ff3b5f';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#ff1744';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(this.x, this.y, ringRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#ffd1d8';
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI * 2 * i) / 6 + progress * 1.4;
        const dist = this.radius + 4 + progress * 20;
        const size = 2 + (i % 2);
        ctx.beginPath();
        ctx.arc(this.x + Math.cos(angle) * dist, this.y + Math.sin(angle) * dist, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Draw Player Initial Name (No scale inheritance to prevent flipped text)
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 8px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(this.name, this.x, this.y + this.radius + 10);
    ctx.restore();
  }
}
