export function resolveBossUpdate({
  boss,
  player,
  monsterProjectiles,
  dropItems,
  onPenalty,
  onPlayerDeath
}) {
  const event = boss.update(
    { x: player.x, y: player.y },
    monsterProjectiles,
    dropItems
  );
  const comboReset = event === 'failed_penalty';

  if (comboReset) {
    player.takeDamage(40);
    onPenalty();

    if (player.hp <= 0) {
      onPlayerDeath();
      return {
        event,
        comboReset,
        playerDied: true,
        bossDefeated: false
      };
    }
  }

  return {
    event,
    comboReset,
    playerDied: false,
    bossDefeated: boss.hp <= 0
  };
}
