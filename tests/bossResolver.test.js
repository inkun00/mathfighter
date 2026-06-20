import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveBossUpdate } from '../src/bossResolver.js';

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
