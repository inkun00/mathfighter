import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateNumberAnswer,
  resolveDropItemPickups
} from '../src/pickupResolver.js';

function createItem(type, overrides = {}) {
  return {
    type,
    x: 0,
    y: 0,
    radius: 5,
    value: 1,
    isDead: false,
    updateCalls: 0,
    update() {
      this.updateCalls++;
    },
    ...overrides
  };
}

function createPlayer(overrides = {}) {
  return {
    x: 0,
    y: 0,
    radius: 10,
    magnetRange: 100,
    gainExp: () => false,
    heal: () => {},
    ...overrides
  };
}

function resolve(overrides = {}) {
  resolveDropItemPickups({
    dropItems: [],
    player: createPlayer(),
    activeProblem: { id: 1, checkAnswer: value => value === 7 },
    monsters: [],
    combo: 0,
    stage: 1,
    onLevelUp: () => {},
    onMonsterDefeat: () => {},
    onNumberAnswer: () => {},
    ...overrides
  });
}

test('calculates correct-answer combo and stage-scaled gold', () => {
  const result = evaluateNumberAnswer({
    problem: { checkAnswer: value => value === 7 },
    value: 7,
    combo: 0,
    stage: 1,
    monsters: []
  });

  assert.deepEqual(result, {
    correct: true,
    combo: 1,
    goldReward: 46,
    penaltyDamage: 0
  });
});

test('calculates wrong-answer damage from the current enemy attack', () => {
  const result = evaluateNumberAnswer({
    problem: { checkAnswer: () => false },
    value: 3,
    combo: 9,
    stage: 1,
    monsters: [{ atk: 20 }]
  });

  assert.deepEqual(result, {
    correct: false,
    combo: 0,
    goldReward: 0,
    penaltyDamage: 12
  });
});

test('uses fallback damage when no enemy is present', () => {
  const result = evaluateNumberAnswer({
    problem: { checkAnswer: () => false },
    value: 3,
    combo: 2,
    stage: 1,
    monsters: []
  });

  assert.equal(result.penaltyDamage, 6);
});

test('applies gem, heart, and bomb pickups', () => {
  const gem = createItem('gem', { value: 10 });
  const heart = createItem('heart', { value: 15 });
  const bomb = createItem('bomb');
  const defeated = [];
  const healed = [];
  let levelUps = 0;
  const monsters = [
    { hp: 20, isElite: false },
    { hp: 20, isElite: true },
    { hp: 0, isElite: false }
  ];

  resolve({
    dropItems: [gem, heart, bomb],
    player: createPlayer({
      gainExp: value => value === 10,
      heal: value => healed.push(value)
    }),
    monsters,
    onLevelUp: () => levelUps++,
    onMonsterDefeat: monster => defeated.push(monster)
  });

  assert.equal(levelUps, 1);
  assert.deepEqual(healed, [15]);
  assert.equal(monsters[0].hp, 0);
  assert.equal(monsters[1].hp, 20);
  assert.deepEqual(defeated, [monsters[0]]);
  assert.equal([gem, heart, bomb].every(item => item.isDead), true);
});

test('ignores stale numbers and carries combo through sequential answers', () => {
  const stale = createItem('number', { problemId: 99, value: 7 });
  const first = createItem('number', { problemId: 1, value: 7 });
  const second = createItem('number', { problemId: 1, value: 7 });
  const combos = [];

  resolve({
    dropItems: [stale, first, second],
    onNumberAnswer: (_item, result) => {
      combos.push(result.combo);
      return result.combo;
    }
  });

  assert.equal(stale.isDead, true);
  assert.deepEqual(combos, [1, 2]);
});
