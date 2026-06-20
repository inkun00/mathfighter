import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createStageClearState,
  resolveStageClearFrame
} from '../src/stageClearResolver.js';

function createEntity(overrides = {}) {
  return {
    x: 0,
    y: 0,
    radius: 5,
    isDead: false,
    updateCalls: [],
    update(...args) {
      this.updateCalls.push(args);
    },
    ...overrides
  };
}

function resolve(overrides = {}) {
  const effects = [];
  const texts = [];
  const result = resolveStageClearFrame({
    stageClearTimer: 60,
    bossDeathPos: null,
    projectiles: [],
    monsterProjectiles: [],
    dropItems: [],
    monsters: [],
    player: { x: 10, y: 20, magnetRange: 100 },
    worldWidth: 800,
    worldHeight: 600,
    onHitEffect: (...args) => effects.push(args),
    onTextParticle: (...args) => texts.push(args),
    ...overrides
  });
  return { result, effects, texts };
}

test('creates regular-stage clear rewards and presentation state', () => {
  const result = createStageClearState({
    stage: 7,
    isBoss: false,
    boss: null,
    player: { x: 100, y: 200 }
  });

  assert.deepEqual(result, {
    goldReward: 200,
    bossDeathPos: null,
    stageClearTimer: 120,
    textParticle: {
      x: 100,
      y: 170,
      text: 'STAGE SURVIVED! +200G',
      color: '#39ff14'
    }
  });
});

test('creates boss clear rewards and preserves the death position', () => {
  const result = createStageClearState({
    stage: 20,
    isBoss: true,
    boss: { x: 300, y: 400 },
    player: { x: 100, y: 200 }
  });

  assert.deepEqual(result, {
    goldReward: 1000,
    bossDeathPos: { x: 300, y: 400 },
    stageClearTimer: 180,
    textParticle: {
      x: 300,
      y: 360,
      text: 'BOSS DEFEATED! +1000G',
      color: '#ffd700'
    }
  });
});

test('updates and removes stage-clear entities', () => {
  const projectile = createEntity({
    update(...args) {
      this.updateCalls.push(args);
      this.isDead = true;
    }
  });
  const monsterProjectile = createEntity();
  const drop = createEntity({
    update(...args) {
      this.updateCalls.push(args);
      this.isDead = true;
    }
  });
  const monsters = [{ hp: 10 }];
  const { result } = resolve({
    projectiles: [projectile],
    monsterProjectiles: [monsterProjectile],
    dropItems: [drop],
    monsters
  });

  assert.equal(projectile.updateCalls[0][0], monsters);
  assert.deepEqual(projectile.updateCalls[0][1], { x: 10, y: 20 });
  assert.deepEqual(monsterProjectile.updateCalls, [[800, 600]]);
  assert.deepEqual(drop.updateCalls, [[{ x: 10, y: 20 }, 100]]);
  assert.deepEqual(result.projectiles, []);
  assert.deepEqual(result.monsterProjectiles, [monsterProjectile]);
  assert.deepEqual(result.dropItems, []);
  assert.equal(result.stageClearTimer, 59);
});

test('spawns a boss explosion every six remaining frames', () => {
  const { effects, texts } = resolve({
    stageClearTimer: 43,
    bossDeathPos: { x: 100, y: 200 },
    random: () => 0.5
  });

  assert.deepEqual(effects, [[
    100,
    200,
    { id: 22, splashRadius: 100, behavior: 'explosive' },
    1.8
  ]]);
  assert.deepEqual(texts, []);
});

test('adds a deterministic explosion label every twelve frames', () => {
  const randomValues = [0.5, 0.5, 0.26];
  const { effects, texts } = resolve({
    stageClearTimer: 49,
    bossDeathPos: { x: 100, y: 200 },
    random: () => randomValues.shift()
  });

  assert.equal(effects.length, 1);
  assert.deepEqual(texts, [[100, 200, 'CRASH!', '#ff3300']]);
});

test('stops boss explosions during the final thirty frames', () => {
  const { effects } = resolve({
    stageClearTimer: 31,
    bossDeathPos: { x: 100, y: 200 },
    random: () => 0.5
  });

  assert.deepEqual(effects, []);
});

test('reports completion when the countdown reaches zero', () => {
  const { result } = resolve({ stageClearTimer: 1 });

  assert.equal(result.stageClearTimer, 0);
  assert.equal(result.completed, true);
});
