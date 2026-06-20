import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createBossGimmickProblem,
  resolveBossUpdate
} from '../src/bossResolver.js';

function createPlayer(overrides = {}) {
  return {
    x: 10,
    y: 20,
    hp: 100,
    damageTaken: [],
    takeDamage(amount) {
      this.damageTaken.push(amount);
      this.hp -= amount;
    },
    ...overrides
  };
}

function createBoss(overrides = {}) {
  return {
    hp: 100,
    updateCalls: [],
    update(...args) {
      this.updateCalls.push(args);
    },
    ...overrides
  };
}

function resolve(overrides = {}) {
  const boss = overrides.boss ?? createBoss();
  const player = overrides.player ?? createPlayer();
  const monsterProjectiles = overrides.monsterProjectiles ?? [];
  const dropItems = overrides.dropItems ?? [];
  const penalties = [];
  const deaths = [];

  const result = resolveBossUpdate({
    boss,
    player,
    monsterProjectiles,
    dropItems,
    onPenalty: () => penalties.push(player.hp),
    onPlayerDeath: () => deaths.push(player.hp)
  });

  return { boss, player, result, penalties, deaths };
}

test('updates the boss with the player target and shared entity lists', () => {
  const boss = createBoss();
  const projectiles = [];
  const drops = [];
  const result = resolve({ boss, monsterProjectiles: projectiles, dropItems: drops });

  assert.deepEqual(boss.updateCalls[0][0], { x: 10, y: 20 });
  assert.equal(boss.updateCalls[0][1], projectiles);
  assert.equal(boss.updateCalls[0][2], drops);
  assert.deepEqual(result.result, {
    event: undefined,
    comboReset: false,
    playerDied: false,
    bossDefeated: false
  });
});

test('applies the failed-gimmick penalty and requests a combo reset', () => {
  const boss = createBoss({ update: () => 'failed_penalty' });
  const result = resolve({ boss });

  assert.deepEqual(result.player.damageTaken, [40]);
  assert.deepEqual(result.penalties, [60]);
  assert.deepEqual(result.deaths, []);
  assert.equal(result.result.comboReset, true);
  assert.equal(result.result.playerDied, false);
});

test('reports lethal penalty damage before boss defeat', () => {
  const boss = createBoss({
    update() {
      this.hp = 0;
      return 'failed_penalty';
    }
  });
  const player = createPlayer({ hp: 30 });
  const result = resolve({ boss, player });

  assert.deepEqual(result.deaths, [-10]);
  assert.equal(result.result.playerDied, true);
  assert.equal(result.result.bossDefeated, false);
});

test('reports a boss defeated during its update', () => {
  const boss = createBoss({
    update() {
      this.hp = 0;
    }
  });
  const result = resolve({ boss });

  assert.equal(result.result.bossDefeated, true);
  assert.equal(result.result.playerDied, false);
});

test('keeps the current problem outside an active boss gimmick', () => {
  const currentProblem = { id: 7, area: 2 };

  assert.equal(createBossGimmickProblem(null, currentProblem), currentProblem);
  assert.equal(
    createBossGimmickProblem({ isGimmickActive: false }, currentProblem),
    currentProblem
  );
});

test('creates the stage 10 divisor problem', () => {
  const boss = {
    stage: 10,
    isGimmickActive: true,
    lastGimmickTriggerTime: 123,
    chaosCycleType: 'divisor',
    gimmickTargetVal: 36,
    gimmickRequiredCount: 3
  };
  const problem = createBossGimmickProblem(boss, { area: 2 });

  assert.equal(problem.id, 'boss-10-123-divisor');
  assert.equal(problem.area, 2);
  assert.equal(problem.type, 'divisor');
  assert.equal(problem.targetNum, 36);
  assert.equal(problem.requiredCount, 3);
  assert.deepEqual(problem.options, [2, 3, 4, 6, 9, 12, 18]);
  assert.equal(problem.checkAnswer(9), true);
  assert.equal(problem.checkAnswer(5), false);
});

test('creates the stage 20 positive-multiple problem', () => {
  const problem = createBossGimmickProblem({
    stage: 20,
    isGimmickActive: true,
    lastGimmickTriggerTime: 1,
    chaosCycleType: 'divisor',
    gimmickTargetVal: 7,
    gimmickRequiredCount: 1
  }, { area: 1 });

  assert.equal(problem.type, 'multiple');
  assert.deepEqual(problem.options, [7, 14, 21, 28, 35, 42]);
  assert.equal(problem.checkAnswer(14), true);
  assert.equal(problem.checkAnswer(0), false);
});

test('preserves the stage 30 platform-only problem behavior', () => {
  const problem = createBossGimmickProblem({
    stage: 30,
    isGimmickActive: true,
    lastGimmickTriggerTime: 1,
    chaosCycleType: 'divisor',
    gimmickTargetVal: 6,
    gimmickRequiredCount: 1
  }, { area: 3 });

  assert.equal(problem.type, 'divisor');
  assert.deepEqual(problem.options, [36]);
  assert.equal(problem.checkAnswer(6), false);
});

test('creates the stage 40 least-common-multiple problem', () => {
  const problem = createBossGimmickProblem({
    stage: 40,
    isGimmickActive: true,
    lastGimmickTriggerTime: 1,
    chaosCycleType: 'divisor',
    gimmickTargetVal: 12,
    gimmickRequiredCount: 1
  }, { area: 4 });

  assert.equal(problem.type, 'lcm');
  assert.deepEqual(problem.options, [12]);
  assert.equal(problem.checkAnswer(12), true);
  assert.equal(problem.checkAnswer(24), false);
});

test('creates every stage 50 chaos problem variant', () => {
  const cases = [
    ['divisor', [2, 3, 4, 6, 8, 12], 6, 5],
    ['multiple', [9, 18, 27, 36, 45], 18, 8],
    ['gcd', [8], 8, 4],
    ['lcm', [15], 15, 10]
  ];

  cases.forEach(([type, options, correct, wrong]) => {
    const problem = createBossGimmickProblem({
      stage: 50,
      isGimmickActive: true,
      lastGimmickTriggerTime: 1,
      chaosCycleType: type,
      gimmickTargetVal: correct,
      gimmickRequiredCount: 2
    }, { area: 5 });

    assert.equal(problem.type, type);
    assert.deepEqual(problem.options, options);
    assert.equal(problem.checkAnswer(correct), true);
    assert.equal(problem.checkAnswer(wrong), false);
  });
});
