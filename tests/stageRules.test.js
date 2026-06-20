import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FINAL_STAGE,
  PROBLEM_DURATION,
  REGULAR_STAGE_DURATION,
  getFinalStage,
  getNextStageProgress,
  getStageClearFrames,
  getStageClearLabel,
  getStageClearReward,
  getStageEnemyPressure,
  getStageRewardMultiplier,
  getStageTimers,
  isBossStage
} from '../src/stageRules.js';

test('identifies boss stages and assigns stage timers', () => {
  assert.equal(isBossStage(9), false);
  assert.equal(isBossStage(10), true);
  assert.equal(isBossStage(50), true);
  assert.deepEqual(getStageTimers(9), {
    stageTimer: REGULAR_STAGE_DURATION,
    problemTimer: PROBLEM_DURATION
  });
  assert.deepEqual(getStageTimers(10), {
    stageTimer: 0,
    problemTimer: PROBLEM_DURATION
  });
});

test('calculates progression through the final stage', () => {
  assert.deepEqual(getNextStageProgress(49), { nextStage: 50, completed: false });
  assert.deepEqual(getNextStageProgress(FINAL_STAGE), { nextStage: 51, completed: true });
  assert.equal(getFinalStage(51), FINAL_STAGE);
  assert.equal(getFinalStage(0), 1);
});

test('scales enemy pressure while clamping out-of-range stages', () => {
  assert.deepEqual(getStageEnemyPressure(1), { spawnRate: 1638, spawnBatch: 1 });
  assert.deepEqual(getStageEnemyPressure(50), { spawnRate: 547, spawnBatch: 4 });
  assert.deepEqual(getStageEnemyPressure(0), getStageEnemyPressure(1));
  assert.deepEqual(getStageEnemyPressure(100), getStageEnemyPressure(50));
});

test('calculates stage rewards and clear presentation rules', () => {
  assert.equal(getStageRewardMultiplier(1), 1.1);
  assert.equal(getStageClearReward(20, true), 1000);
  assert.equal(getStageClearReward(20, false), 200);
  assert.equal(getStageClearFrames(true), 180);
  assert.equal(getStageClearFrames(false), 120);
  assert.equal(getStageClearLabel(20), 'BOSS DEFEATED!');
  assert.equal(getStageClearLabel(21), 'SURVIVED!');
});
