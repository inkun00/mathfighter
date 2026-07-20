import { getStageClearLabel } from './stageRules.js';
import {
  createWeaponFireEffect,
  createWeaponImpactEffect,
  drawWeaponFireEffect,
  drawWeaponImpactEffect
} from './weaponEffects.js';

const BACKGROUND_SOURCES = [
  { minStage: 40, src: '/assets/backgrounds/stage_40_cosmic.webp' },
  { minStage: 30, src: '/assets/backgrounds/stage_30_forge.webp' },
  { minStage: 20, src: '/assets/backgrounds/stage_20_ruins.webp' },
  { minStage: 10, src: '/assets/backgrounds/stage_10_cavern.webp' },
  { minStage: 1, src: '/assets/backgrounds/stage_01_academy.webp' }
];

export function createGameRenderer({ getState, getCameraOffset }) {
  const backgrounds = BACKGROUND_SOURCES.map(background => {
    const image = new Image();
    image.src = background.src;
    return { ...background, image, pattern: null };
  });
  let hitEffects = [];
  let fireEffects = [];
  let textParticles = [];
  const lastAreaImpactTimes = new WeakMap();

  function getStageBackground(stage) {
    return backgrounds.find(background => stage >= background.minStage) || backgrounds.at(-1);
  }

  function drawStageBackground(ctx, camera, state) {
    const { worldWidth, worldHeight, canvas, currentStage } = state;
    ctx.fillStyle = '#080312';
    ctx.fillRect(0, 0, worldWidth, worldHeight);

    const background = getStageBackground(currentStage);
    if (!background?.image?.complete || background.image.naturalWidth === 0) return;
    if (!background.pattern) background.pattern = ctx.createPattern(background.image, 'repeat');
    if (!background.pattern) return;

    ctx.save();
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = background.pattern;
    ctx.fillRect(0, 0, worldWidth, worldHeight);

    const gradient = ctx.createRadialGradient(
      camera.x + canvas.width / 2,
      camera.y + canvas.height / 2,
      Math.min(canvas.width, canvas.height) * 0.25,
      camera.x + canvas.width / 2,
      camera.y + canvas.height / 2,
      Math.max(canvas.width, canvas.height) * 0.9
    );
    gradient.addColorStop(0, 'rgba(8, 3, 18, 0.04)');
    gradient.addColorStop(1, 'rgba(2, 0, 8, 0.45)');
    ctx.fillStyle = gradient;
    ctx.fillRect(camera.x, camera.y, canvas.width, canvas.height);
    ctx.restore();
  }

  function spawnTextParticle(x, y, text, color) {
    textParticles.push({ x, y, text, color, alpha: 1, life: 30 });
  }

  function spawnFireEffect(event) {
    if (!event?.weapon) return;
    fireEffects.push(createWeaponFireEffect(event));
    if (fireEffects.length > 40) fireEffects.splice(0, fireEffects.length - 40);
  }

  function spawnHitEffect(x, y, projectile, scale = 1, details = {}) {
    if (!projectile) return;
    const now = Date.now();
    const effect = createWeaponImpactEffect(x, y, projectile, scale, details);
    const lastAreaImpact = lastAreaImpactTimes.get(projectile) || 0;
    if (effect.isAreaHit && effect.family !== 'electric' && now - lastAreaImpact < 45) return;
    if (effect.isAreaHit) lastAreaImpactTimes.set(projectile, now);
    hitEffects.push(effect);
    if (hitEffects.length > 90) hitEffects.splice(0, hitEffects.length - 90);
  }

  function drawHitEffects(ctx) {
    const now = Date.now();
    hitEffects.forEach(effect => drawWeaponImpactEffect(ctx, effect, now));
    hitEffects = hitEffects.filter(effect => now - effect.createdTime < effect.lifeTime);
  }

  function drawFireEffects(ctx) {
    const now = Date.now();
    fireEffects.forEach(effect => drawWeaponFireEffect(ctx, effect, now));
    fireEffects = fireEffects.filter(effect => now - effect.createdTime < effect.lifeTime);
  }

  function getCameraShake(now) {
    let x = 0;
    let y = 0;
    fireEffects.forEach(effect => {
      if (effect.shake <= 0) return;
      const progress = Math.min(1, (now - effect.createdTime) / effect.lifeTime);
      const strength = effect.shake * (1 - progress);
      x += Math.sin(now * 0.19 + effect.seed) * strength;
      y += Math.cos(now * 0.23 + effect.seed * 1.7) * strength;
    });
    return { x: Math.max(-5, Math.min(5, x)), y: Math.max(-5, Math.min(5, y)) };
  }

  function drawStageClearBanner(ctx, canvas, currentStage) {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const boxWidth = Math.min(520, canvas.width * 0.85);
    const boxHeight = 150;

    ctx.save();
    ctx.fillStyle = 'rgba(8, 3, 18, 0.65)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(26, 0, 51, 0.88)';
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 18;
    ctx.fillRect(centerX - boxWidth / 2, centerY - boxHeight / 2, boxWidth, boxHeight);
    ctx.strokeRect(centerX - boxWidth / 2, centerY - boxHeight / 2, boxWidth, boxHeight);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.strokeRect(centerX - boxWidth / 2 + 6, centerY - boxHeight / 2 + 6, boxWidth - 12, boxHeight - 12);

    ctx.translate(centerX, centerY);
    const scale = 1 + Math.sin(Date.now() * 0.01) * 0.04;
    ctx.scale(scale, scale);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#39ff14';
    ctx.shadowColor = '#39ff14';
    ctx.shadowBlur = 12;
    ctx.font = 'bold 36px "Press Start 2P", sans-serif';
    ctx.fillText('STAGE CLEAR!', 0, -22);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 16px "Press Start 2P", sans-serif';
    ctx.fillText(`STAGE ${currentStage} - ${getStageClearLabel(currentStage)}`, 0, 26);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('대기실 상점으로 이동 중...', 0, 52);
    ctx.restore();
  }

  function draw() {
    const state = getState();
    const {
      canvas, ctx, worldWidth, worldHeight, dropItems, projectiles,
      monsterProjectiles, monsters, player, boss, gameState, currentStage
    } = state;
    ctx.fillStyle = '#080312';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const camera = getCameraOffset();
    const cameraShake = getCameraShake(Date.now());
    ctx.save();
    ctx.translate(-camera.x + cameraShake.x, -camera.y + cameraShake.y);
    drawStageBackground(ctx, camera, state);

    ctx.strokeStyle = 'rgba(170, 70, 255, 0.09)';
    ctx.lineWidth = 1;
    const gridSize = 40;
    const startX = Math.floor(camera.x / gridSize) * gridSize;
    const endX = Math.min(worldWidth, camera.x + canvas.width + gridSize);
    const startY = Math.floor(camera.y / gridSize) * gridSize;
    const endY = Math.min(worldHeight, camera.y + canvas.height + gridSize);
    for (let x = startX; x <= endX; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, worldHeight);
      ctx.stroke();
    }
    for (let y = startY; y <= endY; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(worldWidth, y);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.28)';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, worldWidth - 4, worldHeight - 4);

    dropItems.forEach(item => item.draw(ctx));
    projectiles.forEach(projectile => projectile.draw(ctx));
    monsterProjectiles.forEach(projectile => projectile.draw(ctx));
    monsters.forEach(monster => {
      if (monster.hp > 0) monster.draw(ctx);
    });
    if (player) player.draw(ctx);
    if (boss) boss.draw(ctx);
    drawFireEffects(ctx);
    drawHitEffects(ctx);

    textParticles.forEach(particle => {
      particle.y -= 1;
      particle.alpha -= 0.035;
      ctx.fillStyle = particle.color;
      ctx.globalAlpha = Math.max(0, particle.alpha);
      ctx.font = 'bold 12px "Press Start 2P"';
      ctx.fillText(particle.text, particle.x, particle.y);
    });
    textParticles = textParticles.filter(particle => particle.alpha > 0);
    ctx.restore();

    if (gameState === 'stageClear') drawStageClearBanner(ctx, canvas, currentStage);
  }

  function resetEffects() {
    hitEffects = [];
    fireEffects = [];
    textParticles = [];
  }

  return { draw, resetEffects, spawnFireEffect, spawnHitEffect, spawnTextParticle };
}
