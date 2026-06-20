export const FINAL_STAGE = 50;
export const BOSS_STAGE_INTERVAL = 10;
export const REGULAR_STAGE_DURATION = 90;
export const PROBLEM_DURATION = 30;

export function isBossStage(stage) {
  return stage >= BOSS_STAGE_INTERVAL && stage % BOSS_STAGE_INTERVAL === 0;
}

export function getStageTimers(stage) {
  return {
    stageTimer: isBossStage(stage) ? 0 : REGULAR_STAGE_DURATION,
    problemTimer: PROBLEM_DURATION
  };
}

export function getNextStageProgress(stage) {
  const nextStage = stage + 1;
  return {
    nextStage,
    completed: nextStage > FINAL_STAGE
  };
}

export function getFinalStage(stage) {
  return Math.max(1, Math.min(FINAL_STAGE, stage));
}

export function getStageEnemyPressure(stage) {
  const clampedStage = Math.max(1, Math.min(FINAL_STAGE, stage));
  const stageBand = Math.floor((clampedStage - 1) / BOSS_STAGE_INTERVAL);
  const baseSpawnRate = Math.max(
    416,
    Math.floor((2300 - clampedStage * 24 - stageBand * 85) * 0.8)
  );

  return {
    spawnRate: Math.max(360, Math.floor(baseSpawnRate * 0.9)),
    spawnBatch: Math.min(4, 1 + Math.floor((clampedStage - 1) / 15))
  };
}

export function getStageRewardMultiplier(stage) {
  const stageGrowth = 1 + Math.max(0, stage - 1) * 0.03;
  return stageGrowth * 1.1;
}

export function getStageClearReward(stage, bossStage) {
  return bossStage ? 500 * (stage / BOSS_STAGE_INTERVAL) : 200;
}

export function getStageClearFrames(bossStage) {
  return bossStage ? 180 : 120;
}

export function getStageClearLabel(stage) {
  return isBossStage(stage) ? 'BOSS DEFEATED!' : 'SURVIVED!';
}
