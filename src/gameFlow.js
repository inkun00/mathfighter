import { PROBLEM_DURATION, getStageEnemyPressure } from './stageRules.js';

export function resolveGameTimerTick({
  now,
  lastSecTime,
  stageTimer,
  problemTimer,
  hasBoss
}) {
  if (now - lastSecTime < 1000) {
    return {
      ticked: false,
      problemExpired: false,
      lastSecTime,
      stageTimer,
      problemTimer
    };
  }

  const nextProblemTimer = problemTimer - 1;
  const problemExpired = nextProblemTimer <= 0;
  return {
    ticked: true,
    problemExpired,
    lastSecTime: now,
    stageTimer: hasBoss ? stageTimer : stageTimer - 1,
    problemTimer: problemExpired ? PROBLEM_DURATION : nextProblemTimer
  };
}

export function resolveMonsterSpawns({
  now,
  lastSpawnTime,
  stage,
  monsters,
  createMonster
}) {
  const { spawnRate, spawnBatch } = getStageEnemyPressure(stage);
  if (now - lastSpawnTime < spawnRate) {
    return { lastSpawnTime, spawnedCount: 0 };
  }

  for (let i = 0; i < spawnBatch; i++) {
    monsters.push(createMonster());
  }

  return { lastSpawnTime: now, spawnedCount: spawnBatch };
}
