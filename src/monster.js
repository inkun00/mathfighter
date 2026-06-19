import { getRandomNumberPool } from './mathEngine.js';

const ENEMY_STAT_NORMALIZER = 0.9;

// Item Class for Drop Items: Exp Gem, Numbers, Bomb, Heart
export class DropItem {
  constructor(x, y, type, value, label = "", problemId = null) {
    this.x = x;
    this.y = y;
    this.type = type; // 'gem', 'number', 'bomb', 'heart'
    this.value = value; // Numerical value for Exp amount, or math answer
    this.label = label; // Visible label (e.g. number string)
    this.problemId = problemId;
    this.radius = type === 'number' ? Math.max(22, 10 + String(label || "").length * 6) : 6;
    this.isDead = false;
    this.magnetSpeed = 0;
    this.createdTime = Date.now();
    this.lifeTime = type === 'number' ? 18000 : Infinity;
  }

  update(playerPos, magnetRange) {
    if (Date.now() - this.createdTime >= this.lifeTime) {
      this.isDead = true;
      return;
    }

    const dx = playerPos.x - this.x;
    const dy = playerPos.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Magnet drag pull
    if (dist > 0 && dist < magnetRange) {
      this.magnetSpeed = Math.min(6, this.magnetSpeed + 0.3);
      this.x += (dx / dist) * this.magnetSpeed;
      this.y += (dy / dist) * this.magnetSpeed;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.type === 'number') {
      const age = Date.now() - this.createdTime;
      const timeLeft = this.lifeTime - age;
      if (timeLeft < 2500) {
        ctx.globalAlpha = 0.45 + Math.sin(Date.now() / 80) * 0.35;
      }
    }

    if (this.type === 'gem') {
      ctx.fillStyle = '#00ffff';
      ctx.beginPath();
      ctx.moveTo(0, -this.radius);
      ctx.lineTo(this.radius, 0);
      ctx.lineTo(0, this.radius);
      ctx.lineTo(-this.radius, 0);
      ctx.closePath();
      ctx.fill();
    } else if (this.type === 'number') {
      // Draw capsule/round-rect coin for text support
      const textWidth = ctx.measureText ? ctx.measureText(this.label).width : this.label.length * 9;
      const paddingX = 14;
      const boxWidth = Math.max(44, textWidth + paddingX * 2);
      const boxHeight = 36;
      
      ctx.fillStyle = '#ffe082';
      ctx.strokeStyle = '#ffb300';
      ctx.lineWidth = 3;
      
      ctx.beginPath();
      const rx = -boxWidth / 2;
      const ry = -boxHeight / 2;
      const r = 12; // corner radius
      ctx.moveTo(rx + r, ry);
      ctx.lineTo(rx + boxWidth - r, ry);
      ctx.quadraticCurveTo(rx + boxWidth, ry, rx + boxWidth, ry + r);
      ctx.lineTo(rx + boxWidth, ry + boxHeight - r);
      ctx.quadraticCurveTo(rx + boxWidth, ry + boxHeight, rx + boxWidth - r, ry + boxHeight);
      ctx.lineTo(rx + r, ry + boxHeight);
      ctx.quadraticCurveTo(rx, ry + boxHeight, rx, ry + boxHeight - r);
      ctx.lineTo(rx, ry + r);
      ctx.quadraticCurveTo(rx, ry, rx + r, ry);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Update radius dynamically for collision detection
      this.radius = boxWidth / 2;

      // Draw numerical/text label
      ctx.fillStyle = '#1a0033';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.label, 0, 1);
    } else if (this.type === 'bomb') {
      ctx.fillStyle = '#ff0055';
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.font = '12px Arial';
      ctx.fillText('💣', -6, 5);
    } else if (this.type === 'heart') {
      ctx.fillStyle = '#ff007f';
      ctx.font = '12px Arial';
      ctx.fillText('❤️', -6, 5);
    }

    ctx.restore();
  }
}

// Enemy Projectile representing projectiles thrown by ranger monsters
export class MonsterProjectile {
  constructor(x, y, targetX, targetY, dmg, options = {}) {
    this.x = x;
    this.y = y;
    this.dmg = dmg;
    this.speed = (options.speed || 3.5) * ENEMY_STAT_NORMALIZER;
    this.radius = options.radius || 6;
    this.color = options.color || '#ffa000';
    this.isDead = false;

    const dx = targetX - x;
    const dy = targetY - y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    this.vx = dist > 0 ? (dx / dist) * this.speed : 0;
    this.vy = dist > 0 ? (dy / dist) * this.speed : this.speed;
  }

  update(canvasWidth, canvasHeight) {
    this.x += this.vx;
    this.y += this.vy;

    // Boundary check
    if (this.x < 0 || this.x > canvasWidth || this.y < 0 || this.y > canvasHeight) {
      this.isDead = true;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// 50 types of monsters base definitions map by Theme
const MONSTER_TEMPLATES = {
  theme1: [
    { name: "꼬마 약수 슬라임", pattern: "charge", speed: 1.2, maxHp: 30, atk: 10, color: "#a0ff60" },
    { name: "숲속 던지기 다람쥐", pattern: "throw", speed: 1.5, maxHp: 20, atk: 8, color: "#d0a060" },
    { name: "가시덤불 고슴도치", pattern: "charge", speed: 0.9, maxHp: 45, atk: 12, color: "#808080" },
    { name: "붉은 이빨 박쥐", pattern: "charge", speed: 1.8, maxHp: 22, atk: 10, color: "#ff4060" },
    { name: "가시 덩굴 전사", pattern: "charge", speed: 1.1, maxHp: 80, atk: 15, color: "#20b060", isElite: true }
  ],
  theme2: [
    { name: "배수 모래 게", pattern: "charge", speed: 1.3, maxHp: 60, atk: 15, color: "#ffb060" },
    { name: "사막 던지기 전갈", pattern: "throw", speed: 1.4, maxHp: 40, atk: 12, color: "#e2b02a" },
    { name: "자폭형 모래 풍선", pattern: "bomb", speed: 1.6, maxHp: 30, atk: 25, color: "#ff6020" },
    { name: "분열 오아시스 젤리", pattern: "split", speed: 1.0, maxHp: 55, atk: 12, color: "#00a0ff" },
    { name: "미라 전사", pattern: "debuff", speed: 1.1, maxHp: 120, atk: 18, color: "#ffcc00", isElite: true }
  ],
  theme3: [
    { name: "진흙 늪지 거북이", pattern: "charge", speed: 0.7, maxHp: 150, atk: 20, color: "#2e7d32" },
    { name: "독가스 버섯 슬라임", pattern: "bomb", speed: 1.0, maxHp: 80, atk: 22, color: "#9c27b0" },
    { name: "습지 비행 반딧불이", pattern: "throw", speed: 1.7, maxHp: 60, atk: 16, color: "#ffeb3b" },
    { name: "늪지 독사", pattern: "charge", speed: 2.2, maxHp: 70, atk: 18, color: "#4caf50" },
    { name: "거대 악어 광전사", pattern: "charge", speed: 1.2, maxHp: 240, atk: 30, color: "#ff5722", isElite: true }
  ],
  theme4: [
    { name: "거품 소라", pattern: "throw", speed: 0.8, maxHp: 120, atk: 24, color: "#00bcd4" },
    { name: "집게 랍스터", pattern: "charge", speed: 1.4, maxHp: 140, atk: 28, color: "#e91e63" },
    { name: "해파리 발광체", pattern: "debuff", speed: 1.5, maxHp: 100, atk: 20, color: "#90caf9" },
    { name: "파도타기 상어", pattern: "charge", speed: 2.4, maxHp: 110, atk: 26, color: "#0d47a1" },
    { name: "심해 거대 문어", pattern: "throw", speed: 1.1, maxHp: 320, atk: 35, color: "#3f51b5", isElite: true }
  ]
};

const MONSTER_ROSTER = [
  {
    id: 'acid_slime',
    name: 'Acid Slime',
    family: 'slime',
    sheet: '/assets/monsters/monster_acid_slime_sheet.png',
    pattern: 'debuff',
    rank: 1,
    speed: 1.25,
    maxHp: 34,
    atk: 9,
    color: '#8cff4a',
    spriteSize: 58,
    radius: 15
  },
  {
    id: 'frost_slime',
    name: 'Frost Slime',
    family: 'slime',
    sheet: '/assets/monsters/monster_frost_slime_sheet.png',
    pattern: 'sniper',
    rank: 2,
    speed: 1.05,
    maxHp: 58,
    atk: 13,
    color: '#8ee8ff',
    spriteSize: 60,
    radius: 16
  },
  {
    id: 'void_slime',
    name: 'Void Slime',
    family: 'slime',
    sheet: '/assets/monsters/monster_void_slime_sheet.png',
    pattern: 'zigzag',
    rank: 3,
    speed: 1.65,
    maxHp: 82,
    atk: 18,
    color: '#9b5cff',
    spriteSize: 64,
    radius: 17
  },
  {
    id: 'magma_slime',
    name: 'Magma Slime',
    family: 'slime',
    sheet: '/assets/monsters/monster_magma_slime_sheet.png',
    pattern: 'bomb',
    rank: 4,
    speed: 1.25,
    maxHp: 120,
    atk: 30,
    color: '#ff6a2a',
    spriteSize: 68,
    radius: 19,
    isElite: true
  },
  {
    id: 'storm_slime',
    name: 'Storm Slime',
    family: 'slime',
    sheet: '/assets/monsters/monster_storm_slime_sheet.png',
    pattern: 'orbit',
    rank: 5,
    speed: 1.45,
    maxHp: 170,
    atk: 30,
    color: '#5ac8ff',
    spriteSize: 72,
    radius: 21,
    isElite: true
  },
  {
    id: 'grunt_zombie',
    name: 'Grunt Zombie',
    family: 'zombie',
    sheet: '/assets/monsters/monster_grunt_zombie_sheet.png',
    pattern: 'charge',
    rank: 1,
    speed: 1.15,
    maxHp: 48,
    atk: 12,
    color: '#8fb36a',
    spriteSize: 64,
    radius: 16
  },
  {
    id: 'plague_zombie',
    name: 'Plague Zombie',
    family: 'zombie',
    sheet: '/assets/monsters/monster_plague_zombie_sheet.png',
    pattern: 'regen',
    rank: 2,
    speed: 0.95,
    maxHp: 90,
    atk: 16,
    color: '#b0d957',
    spriteSize: 66,
    radius: 17
  },
  {
    id: 'runner_zombie',
    name: 'Runner Zombie',
    family: 'zombie',
    sheet: '/assets/monsters/monster_runner_zombie_sheet.png',
    pattern: 'rush',
    rank: 3,
    speed: 1.9,
    maxHp: 78,
    atk: 20,
    color: '#ff9a38',
    spriteSize: 66,
    radius: 17
  },
  {
    id: 'armored_zombie',
    name: 'Armored Zombie',
    family: 'zombie',
    sheet: '/assets/monsters/monster_armored_zombie_sheet.png',
    pattern: 'shield',
    rank: 4,
    speed: 0.85,
    maxHp: 210,
    atk: 28,
    color: '#6fb2d8',
    spriteSize: 76,
    radius: 22,
    isElite: true
  },
  {
    id: 'berserker_zombie',
    name: 'Berserker Zombie',
    family: 'zombie',
    sheet: '/assets/monsters/monster_berserker_zombie_sheet.png',
    pattern: 'rush',
    rank: 5,
    speed: 1.55,
    maxHp: 260,
    atk: 40,
    color: '#ff2d5f',
    spriteSize: 80,
    radius: 24,
    isElite: true
  }
];

function getStageMonsterPool(stage) {
  const stageRank = Math.min(5, Math.max(1, Math.floor((stage + 4) / 8)));
  const pool = [];

  MONSTER_ROSTER.forEach(monster => {
    const unlockStage = 1 + (monster.rank - 1) * 6;
    if (stage < unlockStage) return;
    if (monster.rank > stageRank + 2) return;

    const progress = Math.max(0, stage - unlockStage);
    const distance = Math.abs(monster.rank - stageRank);
    let weight = Math.max(1, 10 - distance * 3);

    if (monster.rank > stageRank) {
      weight = Math.max(1, 2 + Math.floor(progress * 0.7));
    } else if (monster.rank < stageRank) {
      weight = Math.max(2, weight - Math.floor((stage - monster.rank * 6) / 8));
    } else {
      weight += Math.min(4, Math.floor(progress / 3));
    }

    if (stage >= 35 && monster.rank >= 4) weight += 4;
    if (stage >= 45 && monster.rank >= 5) weight += 8;

    for (let i = 0; i < weight; i++) pool.push(monster);
  });

  return pool.length > 0 ? pool : MONSTER_ROSTER.filter(monster => monster.rank === 1);
}

// Monster Base Class
// Monster Base Class
export class Monster {
  constructor(x, y, template, stage) {
    this.x = x;
    this.y = y;
    this.stage = stage;
    this.templateId = template.id || template.name;
    this.rank = template.rank || 1;
    this.pattern = template.pattern;
    this.color = template.color;
    this.isElite = template.isElite || false;
    
    // Determine Slime Tier based on Stage difficulty
    this.isSlime = template.name.includes("슬라임");
    this.tier = 1;
    this.name = template.name;
    
    if (this.isSlime) {
      if (stage > 30) {
        this.tier = 3;
        this.name = "거대 결정 슬라임";
        this.isElite = true;
      } else if (stage > 10) {
        this.tier = 2;
        this.name = "가시 돌기 슬라임";
        this.isElite = true;
      } else {
        this.tier = 1;
        this.name = template.name; // Keep "꼬마 약수 슬라임" or "독가스 버섯 슬라임"
      }
    }

    // Scale stats with stage difficulty. Later 10-stage bands add a visible jump.
    const stageIndex = Math.max(0, stage - 1);
    const stageBand = Math.floor(stageIndex / 10);
    const hpScale = 1 + stageIndex * 0.14 + stageBand * 0.65;
    const atkScale = 1 + stageIndex * 0.055 + stageBand * 0.18;
    const speedScale = 1 + stageIndex * 0.012 + stageBand * 0.03;
    
    // Apply Tier multipliers for Slimes
    let tierHpScale = 1;
    let tierAtkScale = 1;
    let tierSpeedScale = 1;
    let tierRadiusScale = 1;
    
    if (this.isSlime) {
      if (this.tier === 2) {
        tierHpScale = 2.0;
        tierAtkScale = 1.5;
        tierSpeedScale = 1.1;
        tierRadiusScale = 1.25;
      } else if (this.tier === 3) {
        tierHpScale = 4.0;
        tierAtkScale = 2.2;
        tierSpeedScale = 1.2;
        tierRadiusScale = 1.5;
      }
    }

    this.maxHp = Math.max(1, Math.floor(template.maxHp * hpScale * tierHpScale * ENEMY_STAT_NORMALIZER));
    this.hp = this.maxHp;
    this.speed = template.speed * speedScale * tierSpeedScale * ENEMY_STAT_NORMALIZER;
    this.baseSpeed = this.speed;
    this.atk = Math.max(1, Math.floor(template.atk * atkScale * tierAtkScale * ENEMY_STAT_NORMALIZER));
    this.radius = Math.floor((template.radius || (this.isElite ? 22 : 14)) * tierRadiusScale);
    this.defense = Math.floor((stageIndex * 1.8 + stageBand * 14 + (this.isElite ? 18 + stageBand * 8 : 0)) * ENEMY_STAT_NORMALIZER);
    this.damageReduction = Math.min(0.55, (stageIndex * 0.006 + stageBand * 0.035 + (this.isElite ? 0.08 : 0)) * ENEMY_STAT_NORMALIZER);
    this.actionCooldownScale = Math.min(1.25, Math.max(0.55, 1 - stageIndex * 0.008 - stageBand * 0.025) / ENEMY_STAT_NORMALIZER);
    this.projectileSpeedScale = (1 + stageIndex * 0.008 + stageBand * 0.025) * ENEMY_STAT_NORMALIZER;

    this.xpVal = template.xpVal || (this.isElite ? (this.tier >= 3 ? 40 : 25) : 8);
    this.lastActionTime = 0;
    this.isHitFlash = 0;
    this.spawnTime = Date.now();
    this.lastRegenTime = 0;
    this.goldRewarded = false;
    this.lastContactDamageTime = 0;
    this.statusEffects = {
      burnUntil: 0,
      burnPower: 0,
      poisonUntil: 0,
      poisonPower: 0,
      slowUntil: 0,
      slowMultiplier: 1,
      lastStatusTickTime: 0
    };

    // Special bomb animation timer
    this.bombTimer = 0;
    this.isAboutToExplode = false;

    // Load nano banana2 slime sprite frames dictionary (fallback support)
    this.imgs = {
      down1: new Image(),
      down2: new Image(),
      up1: new Image(),
      up2: new Image(),
      side1: new Image(),
      side2: new Image()
    };
    this.imgs.down1.src = '/assets/slime_d1.png';
    this.imgs.down2.src = '/assets/slime_d2.png';
    this.imgs.up1.src = '/assets/slime_d1.png';
    this.imgs.up2.src = '/assets/slime_d2.png';
    this.imgs.side1.src = '/assets/slime_s1.png';
    this.imgs.side2.src = '/assets/slime_s2.png';

    // 4x4 Grid sheet loading
    this.sheetImg = new Image();
    if (this.isSlime) {
      if (this.tier === 3) {
        this.sheetImg.src = '/assets/slime_sheet3.png';
      } else if (this.tier === 2) {
        this.sheetImg.src = '/assets/slime_sheet2.png';
      } else {
        this.sheetImg.src = '/assets/slime_sheet1.png';
      }
    } else {
      // Fallback for other monsters
      this.sheetImg.src = '/assets/slime_sheet1.png';
    }
    if (template.sheet) {
      this.sheetImg.src = template.sheet;
    }
    this.spriteSize = template.spriteSize || 60; // Rendered sprite display size in pixels

    this.animOffset = Math.floor(Math.random() * 1000); // Random offset to desynchronize monster animations
    this.facing = 1; // 1 = Right, -1 = Left
    this.direction = 'down'; // 'down', 'up', 'side'
  }

  update(playerPos, monsters, monsterProjectiles) {
    if (this.hp <= 0) return;
    const now = Date.now();
    this.updateStatusEffects(now);

    const dx = playerPos.x - this.x;
    const dy = playerPos.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Update facing and direction based on player relative position
    if (dx !== 0) {
      this.facing = dx >= 0 ? 1 : -1;
    }
    
    if (Math.abs(dy) > Math.abs(dx)) {
      this.direction = dy >= 0 ? 'down' : 'up';
    } else {
      this.direction = 'side';
    }

    if (this.isHitFlash > 0) this.isHitFlash--;

    if (this.pattern === 'regen' && now - this.lastRegenTime >= 1000) {
      this.hp = Math.min(this.maxHp, this.hp + Math.max(2, Math.floor(this.maxHp * 0.025)));
      this.lastRegenTime = now;
    }

    // 1. Defuff Aura Effect (Mummy / Jellyfish)
    if (this.pattern === 'debuff' && dist < 120) {
      // Slow down player (handled in main loop update)
    }

    // 2. Self Explode Bomber Logic
    if (this.pattern === 'bomb') {
      if (dist < 80 && !this.isAboutToExplode) {
        this.isAboutToExplode = true;
        this.bombTimer = 90; // 1.5 seconds warning
      }

      if (this.isAboutToExplode) {
        this.bombTimer--;
        this.speed = 0.5; // Slow down during countdown
        if (this.bombTimer <= 0) {
          // Trigger explosion
          this.hp = 0; // Kills itself
          return 'explode'; // Trigger splash damage in main loop
        }
      }
    }

    if (this.pattern === 'rush' && dist < 260 && now - this.lastActionTime >= 1800 * this.actionCooldownScale) {
      const dashPower = (this.isElite ? 28 : 20) * Math.min(1.6, this.projectileSpeedScale);
      if (dist > 0) {
        this.x += (dx / dist) * dashPower;
        this.y += (dy / dist) * dashPower;
      }
      this.lastActionTime = now;
    }

    if (this.pattern === 'sniper' && dist < 360 && dist > 120) {
      if (now - this.lastActionTime >= 2600 * this.actionCooldownScale) {
        monsterProjectiles.push(new MonsterProjectile(this.x, this.y, playerPos.x, playerPos.y, this.atk * 1.25, {
          speed: 5.2 * this.projectileSpeedScale,
          radius: 5,
          color: '#8ee8ff'
        }));
        this.lastActionTime = now;
      }
      return;
    }

    if (this.pattern === 'orbit' && dist < 260) {
      if (now - this.lastActionTime >= 2400 * this.actionCooldownScale) {
        const baseAngle = Math.atan2(dy, dx);
        for (let i = -1; i <= 1; i++) {
          const angle = baseAngle + i * 0.45;
          monsterProjectiles.push(new MonsterProjectile(
            this.x,
            this.y,
            this.x + Math.cos(angle) * 100,
            this.y + Math.sin(angle) * 100,
            this.atk,
            { speed: 4.2 * this.projectileSpeedScale, radius: 7, color: '#5ac8ff' }
          ));
        }
        this.lastActionTime = now;
      }
    }

    // 3. Ranged Thrower Logic
    if (this.pattern === 'throw') {
      if (dist < 180 && dist > 100) {
        // Stop moving and throw projectile
        if (now - this.lastActionTime >= 2200 * this.actionCooldownScale) {
          monsterProjectiles.push(new MonsterProjectile(this.x, this.y, playerPos.x, playerPos.y, this.atk, {
            speed: 3.5 * this.projectileSpeedScale
          }));
          this.lastActionTime = now;
        }
        // Move slightly to orbit/avoid getting too close
        const angle = Math.atan2(dy, dx) + Math.PI / 2;
        this.x += Math.cos(angle) * this.speed * 0.5;
        this.y += Math.sin(angle) * this.speed * 0.5;
        return;
      }
    }

    // Default Charge movement towards player
    if (dist > 0) {
      const statusSpeedScale = this.statusEffects.slowUntil > now ? this.statusEffects.slowMultiplier : 1;
      let moveX = (dx / dist) * this.speed * statusSpeedScale;
      let moveY = (dy / dist) * this.speed * statusSpeedScale;

      if (this.pattern === 'zigzag') {
        const wave = Math.sin((now - this.spawnTime) / 180) * this.speed * 0.7;
        moveX += (-dy / dist) * wave;
        moveY += (dx / dist) * wave;
      }

      this.x += moveX;
      this.y += moveY;
    }

    // Push away from other monsters to prevent stacking
    monsters.forEach(other => {
      if (other === this || other.hp <= 0) return;
      const ox = other.x - this.x;
      const oy = other.y - this.y;
      const odist = Math.sqrt(ox * ox + oy * oy);
      const minDist = this.radius + other.radius;
      if (odist < minDist && odist > 0) {
        const force = (minDist - odist) * 0.1;
        this.x -= (ox / odist) * force;
        this.y -= (oy / odist) * force;
      }
    });
  }

  updateStatusEffects(now) {
    if (this.statusEffects.slowUntil <= now) {
      this.statusEffects.slowMultiplier = 1;
    }

    if (now - this.statusEffects.lastStatusTickTime < 500) return;
    this.statusEffects.lastStatusTickTime = now;

    if (this.statusEffects.burnUntil > now) {
      this.takeDamage(Math.max(1, this.maxHp * this.statusEffects.burnPower * 0.5));
    }

    if (this.statusEffects.poisonUntil > now) {
      this.takeDamage(Math.max(1, this.maxHp * this.statusEffects.poisonPower * 0.5));
    }
  }

  applyStatusEffect(effect) {
    if (!effect) return;
    const now = Date.now();

    if (effect.type === 'burn') {
      this.statusEffects.burnUntil = Math.max(this.statusEffects.burnUntil, now + effect.duration);
      this.statusEffects.burnPower = Math.max(this.statusEffects.burnPower, effect.power || 0.08);
    } else if (effect.type === 'poison') {
      this.statusEffects.poisonUntil = Math.max(this.statusEffects.poisonUntil, now + effect.duration);
      this.statusEffects.poisonPower = Math.max(this.statusEffects.poisonPower, effect.power || 0.07);
    } else if (['shock', 'gravity', 'stun'].includes(effect.type)) {
      this.statusEffects.slowUntil = Math.max(this.statusEffects.slowUntil, now + effect.duration);
      this.statusEffects.slowMultiplier = Math.min(this.statusEffects.slowMultiplier, effect.slow || 0.65);
    }
  }

  takeDamage(amount) {
    const shieldMultiplier = this.pattern === 'shield' ? 0.65 : 1;
    const reducedAmount = amount * shieldMultiplier * (1 - this.damageReduction);
    const finalAmount = Math.max(1, Math.floor(reducedAmount - this.defense));
    this.hp -= finalAmount;
    this.isHitFlash = 5;
    if (this.hp < 0) this.hp = 0;
  }

  // Handle dropping loot on death
  dropLoot(problem, dropItems) {
    // 1. Drop Exp Gem
    dropItems.push(new DropItem(this.x, this.y, 'gem', this.xpVal));

    // 2. Spawn Hearts (5% rate)
    if (Math.random() < 0.05) {
      dropItems.push(new DropItem(this.x, this.y, 'heart', 20));
    }

    // 3. Spawn Bombs (3% rate)
    if (Math.random() < 0.03) {
      dropItems.push(new DropItem(this.x, this.y, 'bomb', 0));
    }

    // 4. Drop Numbers (52% rate, increased by 30% from the previous 40%)
    if (problem && Math.random() < 0.52) {
      const numbers = getRandomNumberPool(problem);
      // Pick one randomly from pool
      const selected = numbers[Math.floor(Math.random() * numbers.length)];
      dropItems.push(new DropItem(this.x, this.y, 'number', selected, selected.toString(), problem.id || null));
    }
  }

  getDefeatGoldBonus() {
    const stageIndex = Math.max(0, this.stage - 1);
    const stageBand = Math.floor(stageIndex / 10);
    const stageGrowthMultiplier = 1 + stageIndex * 0.025 + stageBand * 0.12;
    const rankBonus = this.rank * 1.05;
    const powerBonus =
      this.maxHp / 150 +
      this.atk / 18 +
      this.defense / 15 +
      this.damageReduction * 28;
    const eliteMultiplier = this.isElite ? 1.45 : 1;
    return Math.max(1, Math.floor((1.5 + rankBonus + powerBonus) * stageGrowthMultiplier * eliteMultiplier * 1.1));
  }

  draw(ctx) {
    ctx.save();
    
    // Apply hit shake
    let shakeX = 0;
    if (this.isHitFlash > 0) {
      shakeX = Math.sin(Date.now() * 0.1) * 2;
    }
    
    // Apply frantic vibration if about to explode
    if (this.isAboutToExplode) {
      const intensity = (90 - this.bombTimer) * 0.15; // Vibrates harder as fuse burns
      shakeX += (Math.random() * 2 - 1) * intensity;
    }

    ctx.translate(this.x + shakeX, this.y);

    // Apply jelly bounce breathing animation
    // Speed of bounce scales if about to explode
    let scaleX = 1;
    let scaleY = 1;
    if (this.isAboutToExplode) {
      const freq = (90 - this.bombTimer) * 0.2;
      scaleY = 1 + Math.sin(freq) * 0.1;
      scaleX = 1 - Math.sin(freq) * 0.08;
    } else {
      // Idle bounce breathing pulse
      scaleY = 1 + Math.sin(Date.now() * 0.004) * 0.04;
      scaleX = 1 - Math.sin(Date.now() * 0.004) * 0.02;
    }

    // Apply bounce scaling (NO facing scale here to prevent double flip because sheet has left/right rows)
    ctx.scale(scaleX, scaleY);

    if (this.sheetImg && this.sheetImg.complete && this.sheetImg.naturalWidth !== 0) {
      // Calculate sprite sheet frame bounds (4 Columns, 4 Rows)
      const sw = this.sheetImg.naturalWidth / 4;
      const sh = this.sheetImg.naturalHeight / 4;
      
      // Determine Row index: 0 = down, 1 = left, 2 = right, 3 = up (matches slime_sheet.png layout)
      let row = 0;
      if (this.direction === 'up') {
        row = 3;
      } else if (this.direction === 'side') {
        row = this.facing === 1 ? 2 : 1; // 2 = right, 1 = left
      }
      
      // Determine Column index (4 frames walking cycle)
      const col = Math.floor((Date.now() + this.animOffset) / 280) % 4;
      
      const sx = col * sw;
      const sy = row * sh;

      // Draw 2D sprite frame from sheet (centered on monster position)
      const ss = this.spriteSize * (this.isElite ? (this.tier >= 3 ? 1.5 : 1.25) : 1);
      ctx.drawImage(this.sheetImg, sx, sy, sw, sh, -ss / 2, -ss / 2, ss, ss);
      
      // Draw color overlays for feedback
      if (this.isHitFlash > 0 && Math.floor(this.isHitFlash / 2) % 2 === 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
      } else if (this.isAboutToExplode && Math.floor(this.bombTimer / 6) % 2 === 0) {
        ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Fallback geometric drawing
      if (this.isHitFlash > 0 && Math.floor(this.isHitFlash / 2) % 2 === 0) {
        ctx.fillStyle = '#ffffff';
      } else if (this.isAboutToExplode && Math.floor(this.bombTimer / 6) % 2 === 0) {
        ctx.fillStyle = '#ff0000'; // Flash red during countdown
      } else {
        ctx.fillStyle = this.color;
      }

      // Draw retro enemy sprite block
      ctx.beginPath();
      if (this.isElite) {
        // Giant spiked cube
        ctx.rect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);
      } else {
        // Rounded blob
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Eye dot
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(3, -2, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Health Bar underneath Elite (Drawn outside scale matrix to prevent rotation/skew)
    if (this.isElite && this.hp < this.maxHp) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(this.x - 15, this.y + this.radius + 4, 30, 4);
      ctx.fillStyle = '#ff007f';
      ctx.fillRect(this.x - 15, this.y + this.radius + 4, (this.hp / this.maxHp) * 30, 4);
      ctx.restore();
    }
  }
}

// Spawns a batch of monsters based on stage and time elapsed
export function spawnMonster(canvasWidth, canvasHeight, playerX, playerY, stage) {
  const weightedPool = getStageMonsterPool(stage);
  const weightedTemplate = weightedPool[Math.floor(Math.random() * weightedPool.length)];
  const weightedAngle = Math.random() * Math.PI * 2;
  const weightedDist = 550;
  const weightedX = Math.max(20, Math.min(canvasWidth - 20, playerX + Math.cos(weightedAngle) * weightedDist));
  const weightedY = Math.max(20, Math.min(canvasHeight - 20, playerY + Math.sin(weightedAngle) * weightedDist));

  return new Monster(weightedX, weightedY, weightedTemplate, stage);

  // Determine Theme
  let theme = 'theme1';
  if (stage > 40) theme = 'theme5';
  else if (stage > 30) theme = 'theme4';
  else if (stage > 20) theme = 'theme3';
  else if (stage > 10) theme = 'theme2';

  let template;
  if (theme === 'theme5') {
    // Theme 5 dynamically synthesizes templates for high stage challenge
    const rand = Math.floor(Math.random() * 4);
    const templates = [
      { name: "가고일 기하 병사", pattern: "charge", speed: 1.8, maxHp: 180, atk: 25, color: "#78909c" },
      { name: "수식 소환 로브", pattern: "throw", speed: 1.2, maxHp: 140, atk: 30, color: "#673ab7" },
      { name: "메카 기하 골렘", pattern: "debuff", speed: 1.0, maxHp: 350, atk: 40, color: "#009688", isElite: true },
      { name: "자폭 무한 구체", pattern: "bomb", speed: 2.2, maxHp: 80, atk: 50, color: "#ff5722" }
    ];
    template = templates[rand];
  } else {
    const templates = MONSTER_TEMPLATES[theme];
    const rand = Math.floor(Math.random() * templates.length);
    template = templates[rand];
  }

  // Spawn outside viewport
  let x, y;
  const angle = Math.random() * Math.PI * 2;
  const dist = 550; // Viewport radius buffer

  x = playerX + Math.cos(angle) * dist;
  y = playerY + Math.sin(angle) * dist;

  // Confine within rough bounds of stage (clamped to map size)
  x = Math.max(20, Math.min(canvasWidth - 20, x));
  y = Math.max(20, Math.min(canvasHeight - 20, y));

  return new Monster(x, y, template, stage);
}

export function restoreMonster(snapshot, stage) {
  if (!snapshot || snapshot.hp <= 0) return null;

  const template = MONSTER_ROSTER.find(monster => monster.id === snapshot.templateId)
    || MONSTER_ROSTER.find(monster => monster.name === snapshot.name)
    || MONSTER_ROSTER[0];

  const monster = new Monster(snapshot.x, snapshot.y, template, stage);
  monster.hp = Math.max(1, Math.min(monster.maxHp, Math.floor(snapshot.hp)));
  monster.direction = snapshot.direction || monster.direction;
  monster.facing = snapshot.facing || monster.facing;
  monster.goldRewarded = Boolean(snapshot.goldRewarded);
  return monster;
}
