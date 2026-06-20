import { circlesOverlap, distanceBetween } from './combatResolver.js';

export function resolveMonsterProjectileUpdates({
  projectiles,
  worldWidth,
  worldHeight,
  player = null,
  onPlayerDeath = () => {}
}) {
  projectiles.forEach(projectile => {
    projectile.update(worldWidth, worldHeight);
    if (!player || !circlesOverlap(player, projectile)) return;

    player.takeDamage(projectile.dmg);
    projectile.isDead = true;
    if (player.hp <= 0) onPlayerDeath();
  });

  return projectiles.filter(projectile => !projectile.isDead);
}

export function resolveMonsterUpdates({
  monsters,
  player,
  monsterProjectiles,
  now = Date.now(),
  onPlayerDeath
}) {
  monsters.forEach(monster => {
    if (monster.hp <= 0) return;

    const distance = distanceBetween(player, monster);
    const event = monster.update(
      { x: player.x, y: player.y },
      monsters,
      monsterProjectiles
    );

    if (event === 'explode' && distance < 80) {
      player.takeDamage(monster.atk * 1.5);
      if (player.hp <= 0) onPlayerDeath();
    }

    if (
      distance < player.radius + monster.radius &&
      now - monster.lastContactDamageTime >= 650
    ) {
      monster.lastContactDamageTime = now;
      player.takeDamage(Math.max(1, monster.atk * 0.16));
      if (player.hp <= 0) onPlayerDeath();
    }
  });
}
