import { resolvePlayerProjectileUpdates } from './combatResolver.js';
import { resolveMonsterProjectileUpdates } from './monsterResolver.js';
import { getStageClearFrames, getStageClearReward } from './stageRules.js';

const EXPLOSION_LABELS = ['BOOM!', 'CRASH!', 'KABOOM!', 'DESTROYED!'];

export function createStageClearState({ stage, isBoss, boss, player }) {
  const bossClear = Boolean(isBoss && boss);
  const goldReward = getStageClearReward(stage, bossClear);
  const source = bossClear ? boss : player;

  return {
    goldReward,
    bossDeathPos: bossClear ? { x: boss.x, y: boss.y } : null,
    stageClearTimer: getStageClearFrames(bossClear),
    textParticle: {
      x: source.x,
      y: source.y - (bossClear ? 40 : 30),
      text: bossClear
        ? `BOSS DEFEATED! +${goldReward}G`
        : `STAGE SURVIVED! +${goldReward}G`,
      color: bossClear ? '#ffd700' : '#39ff14'
    }
  };
}

export function resolveStageClearFrame({
  stageClearTimer,
  bossDeathPos,
  projectiles,
  monsterProjectiles,
  dropItems,
  monsters,
  player,
  worldWidth,
  worldHeight,
  random = Math.random,
  onHitEffect,
  onTextParticle
}) {
  const nextTimer = stageClearTimer - 1;
  const nextProjectiles = resolvePlayerProjectileUpdates({
    projectiles,
    monsters,
    player
  });
  const nextMonsterProjectiles = resolveMonsterProjectileUpdates({
    projectiles: monsterProjectiles,
    worldWidth,
    worldHeight
  });

  dropItems.forEach(item => {
    item.update({ x: player.x, y: player.y }, player.magnetRange);
  });
  const nextDropItems = dropItems.filter(item => !item.isDead);

  if (bossDeathPos && nextTimer > 30 && nextTimer % 6 === 0) {
    const x = bossDeathPos.x + (random() - 0.5) * 160;
    const y = bossDeathPos.y + (random() - 0.5) * 160;
    const projectile = { id: 22, splashRadius: 100, behavior: 'explosive' };
    onHitEffect(x, y, projectile, 1.8);

    if (nextTimer % 12 === 0) {
      const label = EXPLOSION_LABELS[Math.floor(random() * EXPLOSION_LABELS.length)];
      onTextParticle(x, y, label, '#ff3300');
    }
  }

  return {
    stageClearTimer: nextTimer,
    projectiles: nextProjectiles,
    monsterProjectiles: nextMonsterProjectiles,
    dropItems: nextDropItems,
    completed: nextTimer <= 0
  };
}
