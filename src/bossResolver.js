function getBossProblemOptions(boss) {
  if (boss.stage === 10) return { type: 'divisor', options: [2, 3, 4, 6, 9, 12, 18] };
  if (boss.stage === 20) return { type: 'multiple', options: [7, 14, 21, 28, 35, 42] };
  if (boss.stage === 40) return { type: 'lcm', options: [12] };

  if (boss.stage === 50) {
    const optionsByType = {
      divisor: [2, 3, 4, 6, 8, 12],
      multiple: [9, 18, 27, 36, 45],
      gcd: [8],
      lcm: [15]
    };
    return {
      type: boss.chaosCycleType,
      options: optionsByType[boss.chaosCycleType] ?? [36]
    };
  }

  return { type: 'divisor', options: [36] };
}

function checkBossAnswer(boss, value) {
  if (boss.stage === 10) return 36 % value === 0;
  if (boss.stage === 20) return value % 7 === 0 && value > 0;
  if (boss.stage === 40) return value === 12;

  if (boss.stage === 50) {
    if (boss.chaosCycleType === 'divisor') return 24 % value === 0;
    if (boss.chaosCycleType === 'multiple') return value % 9 === 0 && value > 0;
    if (boss.chaosCycleType === 'gcd') return value === 8;
    if (boss.chaosCycleType === 'lcm') return value === 15;
  }

  return false;
}

export function createBossGimmickProblem(boss, currentProblem) {
  if (!boss?.isGimmickActive) return currentProblem;

  const { type, options } = getBossProblemOptions(boss);
  return {
    id: `boss-${boss.stage}-${boss.lastGimmickTriggerTime}-${boss.chaosCycleType}`,
    area: currentProblem.area,
    type,
    targetNum: boss.gimmickTargetVal,
    options,
    requiredCount: boss.gimmickRequiredCount,
    checkAnswer: value => checkBossAnswer(boss, value)
  };
}

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
