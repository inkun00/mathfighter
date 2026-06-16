import { getGCD, getLCM } from './mathEngine.js';

const BOSS_STAT_NORMALIZER = 0.9;

export class Boss {
  constructor(x, y, stage) {
    this.x = x;
    this.y = y;
    this.stage = stage;
    this.radius = 135;
    this.isHitFlash = 0;

    // Determine Boss Type
    if (stage === 10) {
      this.name = "약수 수호 바위 골렘";
      this.maxHp = 1500;
      this.atk = 22;
      this.speed = 0.8;
      this.color = "#7c6853";
    } else if (stage === 20) {
      this.name = "배수 폭탄마 미라 네코";
      this.maxHp = 3000;
      this.atk = 28;
      this.speed = 1.3;
      this.color = "#e2b02a";
    } else if (stage === 30) {
      this.name = "공약수 레이저 아크-8";
      this.maxHp = 6000;
      this.atk = 36;
      this.speed = 1.0;
      this.color = "#00bcd4";
    } else if (stage === 40) {
      this.name = "최소공배수 파멸 리치";
      this.maxHp = 12000;
      this.atk = 46;
      this.speed = 1.2;
      this.color = "#9c27b0";
    } else {
      this.name = "카오스 매쓰 엠페러";
      this.maxHp = 25000;
      this.atk = 60;
      this.speed = 1.5;
      this.color = "#ff007f";
    }

    this.maxHp = Math.max(1, Math.floor(this.maxHp * BOSS_STAT_NORMALIZER * 10));
    this.atk = Math.max(1, Math.floor(this.atk * BOSS_STAT_NORMALIZER));
    this.speed *= BOSS_STAT_NORMALIZER;
    this.hp = this.maxHp;
    this.baseSpeed = this.speed;

    // Gimmick state management
    this.isGimmickActive = false;
    this.gimmickTimer = 0;
    this.gimmickEndTime = 0;
    this.gimmickDuration = 0;
    this.gimmickTargetVal = 0;
    this.gimmickAnswerCount = 0; // Current count of correct actions
    this.gimmickRequiredCount = 1;
    this.lastGimmickTriggerTime = Date.now();
    this.lastActionTime = 0;

    // Load nano banana2 boss sprite frames
    this.img1 = new Image();
    this.img1.src = '/assets/boss.png';
    this.img2 = new Image();
    this.img2.src = '/assets/boss2.png';
    this.currentImg = this.img1;

    this.facing = 1; // 1 = Right, -1 = Left

    // 30St: Laser Sentry platforms
    this.gimmickPlatforms = [];
    
    // 40St: Portal timers
    this.portalTimes = { a: 0, b: 0 };
    
    // 50St: Chaos mode cycling type
    this.chaosCycleType = 'divisor'; // 'divisor', 'multiple', 'gcd', 'lcm'
  }

  update(playerPos, monsterProjectiles, dropItems) {
    if (this.hp <= 0) return;
    const now = Date.now();
    
    if (this.isHitFlash > 0) this.isHitFlash--;

    // 1. Gimmick Trigger checks (Every 40 seconds)
    if (!this.isGimmickActive && now - this.lastGimmickTriggerTime >= 40000) {
      this.triggerGimmick(playerPos, dropItems);
    }

    // 2. Gimmick update loop
    if (this.isGimmickActive) {
      this.gimmickTimer = Math.max(0, this.gimmickEndTime - now);
      
      // Stage specific active gimmick update
      if (this.stage === 30) {
        // Laser robot doesn't move during laser grid
        this.speed = 0;
      } else if (this.stage === 40) {
        // Portal blink animation counters
        this.portalTimes.a = (this.portalTimes.a + 1) % 180; // 3 sec loop
        this.portalTimes.b = (this.portalTimes.b + 1) % 240; // 4 sec loop
      }

      if (this.gimmickTimer <= 0) {
        this.isGimmickActive = false;
        this.lastGimmickTriggerTime = now;
        this.speed = this.baseSpeed;
        
        if (this.stage === 30) {
          // Check if player is standing on a correct platform (within 35px)
          let onCorrectPlatform = false;
          this.gimmickPlatforms.forEach(plat => {
            const dx = playerPos.x - plat.x;
            const dy = playerPos.y - plat.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 35 && plat.isCorrect) {
              onCorrectPlatform = true;
            }
          });
          if (onCorrectPlatform) {
            return 'gimmick_success';
          }
        }
        
        return 'failed_penalty'; // Caught in main loop
      }
      return; // Stop normal AI updates during active gimmick
    }

    // 3. Normal AI Attack & Movement
    const dx = playerPos.x - this.x;
    const dy = playerPos.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Update boss facing direction
    if (dx !== 0) {
      this.facing = dx >= 0 ? 1 : -1;
    }

    // Follow player
    if (dist > 0) {
      this.x += (dx / dist) * this.speed;
      this.y += (dy / dist) * this.speed;
    }

    // Attack routines
    const actionInterval = this.stage >= 40 ? 1900 : this.stage >= 30 ? 2200 : 2500;
    if (now - this.lastActionTime >= actionInterval) {
      this.lastActionTime = now;
      const baseAngle = Math.atan2(dy, dx);
      const ringBurst = (count, dmg, color, radius, speed = 3.8, offset = 0) => {
        for (let i = 0; i < count; i++) {
          monsterProjectiles.push(new BossProjectile(
            this.x,
            this.y,
            offset + i * (Math.PI * 2 / count),
            dmg,
            color,
            radius,
            { speed }
          ));
        }
      };
      const fanBurst = (count, spread, dmg, color, radius, speed = 3.8) => {
        const start = baseAngle - spread / 2;
        const step = count <= 1 ? 0 : spread / (count - 1);
        for (let i = 0; i < count; i++) {
          monsterProjectiles.push(new BossProjectile(
            this.x,
            this.y,
            start + step * i,
            dmg,
            color,
            radius,
            { speed }
          ));
        }
      };

      if (this.stage === 10) {
        fanBurst(5, 0.9, this.atk * 0.82, '#8c7865', 11, 3.6);
        ringBurst(8, this.atk * 0.46, '#b89b78', 7, 2.7, now / 450);
      } else if (this.stage === 20) {
        fanBurst(7, 1.2, this.atk * 0.72, '#e2b02a', 8, 4.0);
        ringBurst(10, this.atk * 0.42, '#ffcc66', 6, 3.0, now / 360);
      } else if (this.stage === 30) {
        fanBurst(9, 1.45, this.atk * 0.68, '#00ffff', 6, 4.4);
        ringBurst(12, this.atk * 0.38, '#66f7ff', 5, 3.5, now / 310);
      } else if (this.stage === 40) {
        fanBurst(11, 1.75, this.atk * 0.62, '#9c27b0', 8, 4.2);
        ringBurst(14, this.atk * 0.36, '#d66bff', 6, 3.6, now / 260);
      } else if (this.stage === 50) {
        fanBurst(13, 2.1, this.atk * 0.58, '#ff007f', 8, 4.7);
        ringBurst(18, this.atk * 0.32, '#ff66aa', 6, 4.0, now / 220);
        ringBurst(9, this.atk * 0.45, '#ffd166', 9, 2.8, -now / 300);
      }
    }
  }

  // Trigger boss math gimmick phase
  triggerGimmick(playerPos, dropItems) {
    this.isGimmickActive = true;
    this.gimmickAnswerCount = 0;
    this.lastGimmickTriggerTime = Date.now();

    if (this.stage === 10) {
      // 약수 수호 쉴드 기믹
      this.gimmickDuration = 40000;
      this.gimmickTargetVal = 36;
      this.gimmickRequiredCount = 3;
      this.speed = 0; // Stays still
    } else if (this.stage === 20) {
      // 7의 배수 폭탄 기믹
      this.gimmickDuration = 30000;
      this.gimmickTargetVal = 7;
      this.gimmickRequiredCount = 1;
    } else if (this.stage === 30) {
      // 12와 18의 공약수 발판 대피
      this.gimmickDuration = 20000;
      this.gimmickDuration = 20000;
      this.gimmickTargetVal = 6; // GCD of 12 & 18
      this.gimmickRequiredCount = 1;
      this.speed = 0;

      // Spawn 4 platform positions around player
      const options = [
        { label: "1", x: playerPos.x - 120, y: playerPos.y - 120, isCorrect: true },
        { label: "3", x: playerPos.x + 120, y: playerPos.y - 120, isCorrect: true },
        { label: "6", x: playerPos.x - 120, y: playerPos.y + 120, isCorrect: true },
        { label: "5", x: playerPos.x + 120, y: playerPos.y + 120, isCorrect: false }
      ];
      this.gimmickPlatforms = options.sort(() => Math.random() - 0.5);
    } else if (this.stage === 40) {
      // LCM portal timings (3 and 4)
      this.gimmickDuration = 15000;
      this.gimmickTargetVal = 12; // LCM of 3 & 4
      this.gimmickRequiredCount = 1;
      this.portalTimes = { a: 0, b: 0 };
    } else if (this.stage === 50) {
      // Chaos match cycles (10 sec countdown)
      this.gimmickDuration = 10000;
      const types = ['divisor', 'multiple', 'gcd', 'lcm'];
      this.chaosCycleType = types[Math.floor(Math.random() * types.length)];
      if (this.chaosCycleType === 'divisor') {
        this.gimmickTargetVal = 24;
        this.gimmickRequiredCount = 2; // Need 2 divisors of 24
      } else if (this.chaosCycleType === 'multiple') {
        this.gimmickTargetVal = 9;
        this.gimmickRequiredCount = 2; // Need 2 multiples of 9
      } else if (this.chaosCycleType === 'gcd') {
        this.gimmickTargetVal = 8; // GCD of 16 & 24
        this.gimmickRequiredCount = 1;
      } else {
        this.gimmickTargetVal = 15; // LCM of 3 & 5
        this.gimmickRequiredCount = 1;
      }
    }

    this.gimmickTimer = this.gimmickDuration;
    this.gimmickEndTime = this.lastGimmickTriggerTime + this.gimmickDuration;
  }

  takeDamage(amount) {
    this.hp -= amount;
    this.isHitFlash = 5;
    if (this.hp < 0) this.hp = 0;
  }

  draw(ctx) {
    ctx.save();
    
    // Apply hit shake or gimmick vibration
    let shakeX = 0;
    if (this.isHitFlash > 0) {
      shakeX = Math.sin(Date.now() * 0.1) * 3;
    } else if (this.isGimmickActive) {
      // Slow rhythmic vibration during math gimmick
      shakeX = Math.sin(Date.now() * 0.05) * 1.5;
    }

    ctx.translate(this.x + shakeX, this.y);

    // Swap boss walking frames based on time (slow 250ms interval)
    const frame = Math.floor(Date.now() / 250) % 2;
    this.currentImg = frame === 0 ? this.img1 : this.img2;

    // Apply slow giant boss breathing animation
    let scaleX = 1;
    let scaleY = 1;
    const bounce = Math.sin(Date.now() * 0.006) * 0.04;
    scaleY = 1 + bounce;
    scaleX = 1 - bounce / 2;

    // Apply facing scale and giant bounce
    ctx.scale(this.facing * scaleX, scaleY);

    if (this.currentImg.complete && this.currentImg.naturalWidth !== 0) {
      // Draw nano banana2 sprite image
      ctx.drawImage(this.currentImg, -this.radius, -this.radius, this.radius * 2, this.radius * 2);
      
      // Draw hit overlay if hit
      if (this.isHitFlash > 0 && Math.floor(this.isHitFlash / 2) % 2 === 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Fallback shapes
      if (this.isHitFlash > 0 && Math.floor(this.isHitFlash / 2) % 2 === 0) {
        ctx.fillStyle = '#ffffff';
      } else {
        ctx.fillStyle = this.color;
      }

      // Draw Giant Boss Sprite Block
      ctx.beginPath();
      ctx.rect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Red Boss Eyes
      ctx.fillStyle = '#ff0000';
      ctx.beginPath();
      ctx.arc(-15, -10, 6, 0, Math.PI * 2);
      ctx.arc(15, -10, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // 10St Gimmick: Draw Shield ring orbiting
    if (this.stage === 10 && this.isGimmickActive) {
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 15, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();

    // Draw active gimmick labels and HUD overlay indicators
    if (this.isGimmickActive) {
      ctx.save();
      // Draw timer bar above boss
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(this.x - 50, this.y - this.radius - 22, 100, 8);
      ctx.fillStyle = '#ff007f';
      
      const fullTime = this.gimmickDuration || 1;
      ctx.fillRect(this.x - 50, this.y - this.radius - 22, (this.gimmickTimer / fullTime) * 100, 8);

      // Warning text
      ctx.fillStyle = '#ffcc00';
      ctx.font = '10px "Press Start 2P"';
      ctx.textAlign = 'center';
      
      let alertMsg = "";
      if (this.stage === 10) alertMsg = `[골렘 쉴드 작동: 36의 약수 수집! ${this.gimmickAnswerCount}/${this.gimmickRequiredCount}]`;
      else if (this.stage === 20) alertMsg = `[시한폭탄 작동: 7의 배수를 먹어 해체!]`;
      else if (this.stage === 30) alertMsg = `[레이저 난사: 12와 18의 공약수 발판 대피!]`;
      else if (this.stage === 40) alertMsg = `[차원 균열: 3과 4의 최소공배수 수집!]`;
      else alertMsg = `[최종 기믹: ${this.chaosCycleType === 'divisor' ? '24의 약수' : (this.chaosCycleType === 'multiple' ? '9의 배수' : (this.chaosCycleType === 'gcd' ? '16&24 최대공약수' : '3&5 최소공배수'))} 수집!]`;

      ctx.fillText(alertMsg, this.x, this.y - this.radius - 35);
      ctx.restore();

      // 30St: Draw platforms and laser grid
      if (this.stage === 30) {
        // Draw electro-grid lines in red/cyan pulsing
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 0, 80, 0.3)';
        ctx.lineWidth = 2;
        // Draw grid lines
        for (let lx = 0; lx < ctx.canvas.width; lx += 80) {
          ctx.beginPath();
          ctx.moveTo(lx, 0);
          ctx.lineTo(lx, ctx.canvas.height);
          ctx.stroke();
        }
        for (let ly = 0; ly < ctx.canvas.height; ly += 80) {
          ctx.beginPath();
          ctx.moveTo(0, ly);
          ctx.lineTo(ctx.canvas.width, ly);
          ctx.stroke();
        }
        ctx.restore();

        this.gimmickPlatforms.forEach(plat => {
          ctx.save();
          // Draw platform zone
          ctx.fillStyle = 'rgba(0, 255, 255, 0.15)';
          ctx.strokeStyle = '#00ffff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(plat.x, plat.y, 30, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Draw platform number label
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 16px Courier New';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(plat.label, plat.x, plat.y);
          ctx.restore();
        });
      }

      // 40St: Draw portals
      if (this.stage === 40) {
        // Portal A (3s cycle)
        ctx.save();
        ctx.strokeStyle = '#9c27b0';
        ctx.lineWidth = 3;
        ctx.fillStyle = `rgba(156, 39, 176, ${Math.sin(this.portalTimes.a * 0.05) * 0.2 + 0.1})`;
        ctx.beginPath();
        ctx.ellipse(this.x - 120, this.y, 25, 45, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px Courier New';
        ctx.fillText("3초 차원포털", this.x - 120, this.y + 60);

        // Portal B (4s cycle)
        ctx.fillStyle = `rgba(156, 39, 176, ${Math.sin(this.portalTimes.b * 0.05) * 0.2 + 0.1})`;
        ctx.beginPath();
        ctx.ellipse(this.x + 120, this.y, 25, 45, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = '#ffffff';
        ctx.fillText("4초 차원포털", this.x + 120, this.y + 60);
        ctx.restore();
      }
    }
  }
}

// Boss Projectile Class
export class BossProjectile {
  constructor(x, y, angle, dmg, color = '#ff0000', radius = 8, options = {}) {
    this.x = x;
    this.y = y;
    this.dmg = dmg;
    this.speed = (options.speed || 3.8) * BOSS_STAT_NORMALIZER;
    this.radius = radius;
    this.color = color;
    this.isDead = false;

    this.vx = Math.cos(angle) * this.speed;
    this.vy = Math.sin(angle) * this.speed;
  }

  update(canvasWidth, canvasHeight) {
    this.x += this.vx;
    this.y += this.vy;

    // Despawn on boundaries
    if (this.x < 0 || this.x > canvasWidth || this.y < 0 || this.y > canvasHeight) {
      this.isDead = true;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
