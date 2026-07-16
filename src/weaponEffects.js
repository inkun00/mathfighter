import { getWeaponVisualProfile } from './weaponProfiles.js';

const FIRE_BEHAVIORS = new Set(['throw_fire', 'fire_patch', 'explosive']);
const ELECTRIC_BEHAVIORS = new Set(['chain_lightning', 'rail_laser', 'plasma_rail']);
const GRAVITY_BEHAVIORS = new Set(['gravity_well']);
const VOID_BEHAVIORS = new Set(['void_pierce']);
const SLASH_BEHAVIORS = new Set(['straight', 'cone_blast', 'dash_wave', 'boomerang']);
const BALLISTIC_BEHAVIORS = new Set(['homing', 'pierce', 'spread', 'missile_swarm']);

export function getWeaponEffectFamily(behavior, id, variant = null) {
  if (variant) return variant;
  if (id === 30 || behavior === 'nova') return 'nova';
  if (id === 27 || behavior === 'elemental_bolt' || behavior === 'elemental_burst') return 'elemental';
  if (GRAVITY_BEHAVIORS.has(behavior)) return 'gravity';
  if (VOID_BEHAVIORS.has(behavior)) return 'void';
  if (ELECTRIC_BEHAVIORS.has(behavior)) return 'electric';
  if (FIRE_BEHAVIORS.has(behavior) || behavior === 'mine') return 'fire';
  if (SLASH_BEHAVIORS.has(behavior)) return 'slash';
  if (BALLISTIC_BEHAVIORS.has(behavior)) return 'ballistic';
  if (behavior === 'shockwave' || behavior === 'orbit') return 'energy';
  return 'energy';
}

export function getWeaponAccentColor(id, behavior, variant = null) {
  const family = getWeaponEffectFamily(behavior, id, variant);
  const colors = {
    fire: '#ff7a24',
    electric: '#59f3ff',
    gravity: '#c06cff',
    void: '#9a4dff',
    slash: id >= 21 ? '#d6f6ff' : '#70ddff',
    ballistic: id >= 28 ? '#ffb347' : '#ffd166',
    energy: '#61e8ff',
    nova: '#fff2a8',
    elemental: '#ffffff'
  };
  return colors[family] || getWeaponVisualProfile(id).color;
}

export function createWeaponFireEffect(event) {
  const visual = getWeaponVisualProfile(event.weapon.id);
  const family = getWeaponEffectFamily(event.behavior, event.weapon.id);
  return {
    ...event,
    angle: Math.atan2(event.targetY - event.y, event.targetX - event.x),
    color: getWeaponAccentColor(event.weapon.id, event.behavior),
    family,
    tier: visual.rank,
    radius: visual.drawSize * (0.42 + visual.rank * 0.055),
    particleCount: 3 + visual.rank * 2,
    lifeTime: 90 + visual.rank * 28,
    shake: visual.rank >= 5 ? (visual.rank - 4) * 1.8 : visual.rank >= 3 ? 0.6 : 0,
    createdTime: Date.now(),
    seed: Math.random() * Math.PI * 2
  };
}

export function createWeaponImpactEffect(x, y, projectile, scale = 1, details = {}) {
  const visual = getWeaponVisualProfile(projectile.id);
  const family = getWeaponEffectFamily(projectile.behavior, projectile.id, projectile.effectVariant);
  const isAreaHit = projectile.splashRadius > 0 || ['fire', 'gravity', 'nova'].includes(family);
  return {
    x,
    y,
    origin: details.origin || null,
    angle: projectile.angle || 0,
    color: getWeaponAccentColor(projectile.id, projectile.behavior, projectile.effectVariant),
    family,
    radius: visual.drawSize * (isAreaHit ? 1.65 : 1.15) * visual.impactScale * scale,
    particleCount: Math.round((4 + visual.rank * 3) * visual.impactScale * scale),
    tier: visual.rank,
    isAreaHit,
    createdTime: Date.now(),
    lifeTime: visual.lifeTime,
    seed: Math.random() * Math.PI * 2
  };
}

function drawJaggedLine(ctx, x1, y1, x2, y2, seed, width, color) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;
  const steps = Math.max(4, Math.min(12, Math.floor(length / 22)));
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const offset = Math.sin(seed * 7 + i * 4.71) * Math.min(13, length * 0.08);
    ctx.lineTo(x1 + dx * t + nx * offset, y1 + dy * t + ny * offset);
  }
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

export function drawWeaponFireEffect(ctx, effect, now) {
  const progress = Math.min(1, (now - effect.createdTime) / effect.lifeTime);
  const alpha = 1 - progress;
  const radius = effect.radius * (0.65 + progress * 0.9);
  ctx.save();
  ctx.translate(effect.x, effect.y);
  ctx.rotate(effect.angle);
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = effect.tier >= 4 ? 'lighter' : 'source-over';
  ctx.shadowColor = effect.color;
  ctx.shadowBlur = 6 + effect.tier * 4;

  if (effect.family === 'slash') {
    ctx.strokeStyle = effect.color;
    ctx.lineWidth = 2 + effect.tier * 0.8;
    for (let i = 0; i < Math.min(3, 1 + Math.floor(effect.tier / 2)); i++) {
      ctx.beginPath();
      ctx.arc(0, 0, radius * (0.6 + i * 0.18), -0.8, 0.8);
      ctx.stroke();
    }
  } else if (['gravity', 'void', 'nova'].includes(effect.family)) {
    ctx.strokeStyle = effect.color;
    ctx.lineWidth = 2 + effect.tier * 0.6;
    const rings = effect.family === 'nova' ? 3 : 2;
    for (let i = 0; i < rings; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, radius * (0.42 + i * 0.27), effect.seed + progress * 3 + i, effect.seed + progress * 3 + i + Math.PI * 1.35);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = effect.color;
    ctx.beginPath();
    ctx.moveTo(radius * 1.35, 0);
    ctx.lineTo(-radius * 0.25, radius * 0.62);
    ctx.lineTo(0, 0);
    ctx.lineTo(-radius * 0.25, -radius * 0.62);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < effect.particleCount; i++) {
    const angle = effect.seed + i * 2.399;
    const distance = radius * (0.3 + ((i * 17) % 11) / 12);
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * distance, Math.sin(angle) * distance, 1 + effect.tier * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawImpactParticles(ctx, effect, progress, alpha) {
  ctx.fillStyle = effect.family === 'fire' ? '#ffd166' : '#ffffff';
  ctx.globalAlpha = alpha;
  for (let i = 0; i < effect.particleCount; i++) {
    const angle = effect.seed + (Math.PI * 2 * i) / effect.particleCount;
    const distance = effect.radius * (0.18 + progress * (0.62 + (i % 3) * 0.11));
    const stretch = effect.family === 'ballistic' ? 1.45 : 1;
    ctx.beginPath();
    ctx.ellipse(
      Math.cos(angle) * distance * stretch,
      Math.sin(angle) * distance,
      1.3 + effect.tier * 0.45 + (i % 2),
      1.3 + effect.tier * 0.18,
      angle,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
}

export function drawWeaponImpactEffect(ctx, effect, now) {
  const progress = Math.min(1, (now - effect.createdTime) / effect.lifeTime);
  const alpha = 1 - progress;
  const radius = effect.radius * (0.28 + progress * 0.95);
  ctx.save();
  ctx.translate(effect.x, effect.y);
  ctx.globalAlpha = alpha;
  ctx.shadowColor = effect.color;
  ctx.shadowBlur = 7 + effect.tier * 3;
  ctx.globalCompositeOperation = effect.tier >= 4 ? 'lighter' : 'source-over';

  if (effect.family === 'electric') {
    if (effect.origin) {
      drawJaggedLine(ctx, effect.origin.x - effect.x, effect.origin.y - effect.y, 0, 0, effect.seed, 2 + effect.tier * 0.55, effect.color);
      ctx.globalAlpha = alpha * 0.7;
      drawJaggedLine(ctx, effect.origin.x - effect.x, effect.origin.y - effect.y, 0, 0, effect.seed + 1.7, 1.2, '#ffffff');
    }
    ctx.strokeStyle = effect.color;
    ctx.lineWidth = 2 + effect.tier * 0.6;
    for (let i = 0; i < Math.min(8, effect.tier + 2); i++) {
      const angle = effect.seed + i * Math.PI * 2 / (effect.tier + 2);
      drawJaggedLine(ctx, 0, 0, Math.cos(angle) * radius, Math.sin(angle) * radius, effect.seed + i, 1.2 + effect.tier * 0.25, i % 2 ? '#ffffff' : effect.color);
    }
  } else if (effect.family === 'gravity') {
    ctx.strokeStyle = effect.color;
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = alpha * (0.85 - i * 0.18);
      ctx.beginPath();
      ctx.arc(0, 0, radius * (1 - i * 0.22), effect.seed - progress * 5 + i, effect.seed - progress * 5 + i + Math.PI * 1.45);
      ctx.stroke();
    }
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#120020';
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (effect.family === 'void') {
    ctx.rotate(effect.angle);
    ctx.strokeStyle = effect.color;
    ctx.lineWidth = 3 + effect.tier * 0.5;
    ctx.beginPath();
    ctx.moveTo(-radius, 0);
    ctx.quadraticCurveTo(0, -radius * 0.28, radius, 0);
    ctx.quadraticCurveTo(0, radius * 0.28, -radius, 0);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-radius * 0.75, 0);
    ctx.lineTo(radius * 0.75, 0);
    ctx.stroke();
  } else if (effect.family === 'slash') {
    ctx.rotate(effect.angle);
    ctx.strokeStyle = effect.color;
    ctx.lineWidth = 3 + effect.tier * 0.7;
    const arcs = effect.tier >= 5 ? 3 : effect.tier >= 3 ? 2 : 1;
    for (let i = 0; i < arcs; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, radius * (0.72 + i * 0.18), -1.05, 1.05);
      ctx.stroke();
    }
  } else if (effect.family === 'nova') {
    ctx.strokeStyle = effect.color;
    ctx.lineWidth = 2 + effect.tier * 0.55;
    for (let ring = 0; ring < 3; ring++) {
      const sides = 6 + ring * 2;
      ctx.beginPath();
      for (let i = 0; i <= sides; i++) {
        const angle = effect.seed + progress * (ring % 2 ? -2 : 2) + i * Math.PI * 2 / sides;
        const r = radius * (0.45 + ring * 0.25);
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  } else {
    ctx.strokeStyle = effect.color;
    ctx.lineWidth = Math.max(2, 1 + effect.tier * 0.9);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
    if (effect.isAreaHit || effect.tier >= 3) {
      ctx.globalAlpha = alpha * 0.3;
      ctx.fillStyle = effect.color;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.58, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawImpactParticles(ctx, effect, progress, alpha);
  ctx.restore();
}
