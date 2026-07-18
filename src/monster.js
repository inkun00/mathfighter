import { getNextNumberDrop } from './mathEngine.js';
import { MONSTER_ROSTER } from './monsterRoster.js';
import {
  createEnemyProjectileVolley,
  getEnemyProjectileProfile,
  MonsterProjectile
} from './enemyProjectiles.js';

export { MonsterProjectile } from './enemyProjectiles.js';

const ENEMY_STAT_NORMALIZER = 0.9;
const MONSTER_IMAGE_CACHE = new Map();
const MONSTER_WALK_SEQUENCE = Object.freeze([0, 1, 2, 3]);

export function getMonsterAnimationFrame(isMoving, distance, spriteSize = 64) {
  if (!isMoving) return 0;
  const phaseDistance = Math.max(8, spriteSize * 0.15);
  const phase = Math.floor(distance / phaseDistance) % MONSTER_WALK_SEQUENCE.length;
  return MONSTER_WALK_SEQUENCE[phase];
}

export function getMonsterMotionDirection(dx, dy, currentFacing = 1, currentDirection = 'down') {
  if (Math.hypot(dx, dy) <= 0.01) {
    return { facing: currentFacing, direction: currentDirection };
  }

  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  const switchRatio = 1.25;
  const keepSide = currentDirection === 'side' && absY <= absX * switchRatio;
  const switchToSide = currentDirection !== 'side' && absX > absY * switchRatio;

  if (keepSide || switchToSide) {
    return { facing: dx >= 0 ? 1 : -1, direction: 'side' };
  }
  return { facing: currentFacing, direction: dy >= 0 ? 'down' : 'up' };
}

export function getCachedMonsterImage(source) {
  if (!MONSTER_IMAGE_CACHE.has(source)) {
    const image = new Image();
    image.src = source;
    MONSTER_IMAGE_CACHE.set(source, image);
  }
  return MONSTER_IMAGE_CACHE.get(source);
}

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
    this.family = template.family || '';
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

    // Shared image objects prevent every monster instance from decoding the same sprites again.
    this.imgs = {
      down1: getCachedMonsterImage('/assets/slime_d1.png'),
      down2: getCachedMonsterImage('/assets/slime_d2.png'),
      up1: getCachedMonsterImage('/assets/slime_d1.png'),
      up2: getCachedMonsterImage('/assets/slime_d2.png'),
      side1: getCachedMonsterImage('/assets/slime_s1.png'),
      side2: getCachedMonsterImage('/assets/slime_s2.png')
    };

    let sheetSource = '/assets/slime_sheet1.png';
    if (this.isSlime) {
      if (this.tier === 3) {
        sheetSource = '/assets/slime_sheet3.png';
      } else if (this.tier === 2) {
        sheetSource = '/assets/slime_sheet2.png';
      }
    }
    this.sheetImg = getCachedMonsterImage(template.sheet || sheetSource);
    this.spriteSize = template.spriteSize || 60; // Rendered sprite display size in pixels

    this.animationDistance = 0;
    this.isMoving = false;
    this.facing = 1; // 1 = Right, -1 = Left
    this.direction = 'down'; // 'down', 'up', 'side'
  }

  update(playerPos, monsters, monsterProjectiles) {
    if (this.hp <= 0) return;
    const now = Date.now();
    const startX = this.x;
    const startY = this.y;
    const finishUpdate = result => {
      this.syncMovementAnimation(startX, startY);
      return result;
    };
    this.updateStatusEffects(now);

    const dx = playerPos.x - this.x;
    const dy = playerPos.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Keep aiming direction stable near diagonal row boundaries.
    const targetDirection = getMonsterMotionDirection(dx, dy, this.facing, this.direction);
    this.facing = targetDirection.facing;
    this.direction = targetDirection.direction;

    if (this.isHitFlash > 0) this.isHitFlash--;

    const projectileProfile = getEnemyProjectileProfile(this.templateId);

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
          return finishUpdate('explode'); // Trigger splash damage in main loop
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

    if (
      this.pattern === 'sniper' && projectileProfile &&
      dist < projectileProfile.rangeMax && dist > projectileProfile.rangeMin
    ) {
      if (now - this.lastActionTime >= projectileProfile.cooldown * this.actionCooldownScale) {
        monsterProjectiles.push(...createEnemyProjectileVolley(
          this.templateId,
          this,
          playerPos,
          this.atk,
          this.projectileSpeedScale
        ));
        this.lastActionTime = now;
      }
      return finishUpdate();
    }

    if (this.pattern === 'orbit' && projectileProfile && dist < projectileProfile.rangeMax) {
      if (now - this.lastActionTime >= projectileProfile.cooldown * this.actionCooldownScale) {
        monsterProjectiles.push(...createEnemyProjectileVolley(
          this.templateId,
          this,
          playerPos,
          this.atk,
          this.projectileSpeedScale
        ));
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
        return finishUpdate();
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
    return finishUpdate();
  }

  syncMovementAnimation(startX, startY) {
    const movedX = this.x - startX;
    const movedY = this.y - startY;
    const movedDistance = Math.hypot(movedX, movedY);
    const movement = getMonsterMotionDirection(movedX, movedY, this.facing, this.direction);

    this.isMoving = movedDistance > 0.05;
    this.facing = movement.facing;
    this.direction = movement.direction;
    if (this.isMoving) this.animationDistance += movedDistance;
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
      const selected = getNextNumberDrop(problem);
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
    } else if (this.family === 'slime') {
      // Slimes keep a small elastic pulse; rigid monsters retain their proportions.
      scaleY = 1 + Math.sin(Date.now() * 0.003) * 0.025;
      scaleX = 1 - Math.sin(Date.now() * 0.003) * 0.015;
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
      
      // Advance the walking cycle only while the monster actually moves.
      const col = getMonsterAnimationFrame(this.isMoving, this.animationDistance, this.spriteSize);
      
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
