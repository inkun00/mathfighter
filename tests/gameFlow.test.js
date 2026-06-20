import assert from 'node:assert/strict';
import test from 'node:test';
import {
  resolveGameTimerTick,
  resolveMonsterSpawns
} from '../src/gameFlow.js';
import { PROBLEM_DURATION } from '../src/stageRules.js';

test('keeps timer state unchanged before a full second passes', () => {
  const result = resolveGameTimerTick({
    now: 1999,
    lastSecTime: 1000,
    stageTimer: 90,
    problemTimer: 30,
    hasBoss: false
  });

  assert.deepEqual(result, {
    ticked: false,
    problemExpired: false,
    lastSecTime: 1000,
    stageTimer: 90,
    problemTimer: 30
  });
});

test('ticks regular-stage and problem timers once at the boundary', () => {
  const result = resolveGameTimerTick({
    now: 2000,
    lastSecTime: 1000,
    stageTimer: 90,
    problemTimer: 30,
    hasBoss: false
  });

  assert.deepEqual(result, {
    ticked: true,
    problemExpired: false,
    lastSecTime: 2000,
    stageTimer: 89,
    problemTimer: 29
  });
});

test('pauses the stage timer during bosses and resets expired problems', () => {
  const result = resolveGameTimerTick({
    now: 2000,
    lastSecTime: 1000,
    stageTimer: 45,
    problemTimer: 1,
    hasBoss: true
  });

  assert.deepEqual(result, {
    ticked: true,
    problemExpired: true,
    lastSecTime: 2000,
    stageTimer: 45,
    problemTimer: PROBLEM_DURATION
  });
});

test('does not spawn monsters before the stage interval elapses', () => {
  const monsters = [];
  let factoryCalls = 0;
  const result = resolveMonsterSpawns({
    now: 1637,
    lastSpawnTime: 0,
    stage: 1,
    monsters,
    createMonster: () => {
      factoryCalls++;
      return { id: factoryCalls };
    }
  });

  assert.deepEqual(result, { lastSpawnTime: 0, spawnedCount: 0 });
  assert.deepEqual(monsters, []);
  assert.equal(factoryCalls, 0);
});

test('spawns the stage batch and advances the spawn clock', () => {
  const monsters = [{ id: 'existing' }];
  let factoryCalls = 0;
  const result = resolveMonsterSpawns({
    now: 547,
    lastSpawnTime: 0,
    stage: 50,
    monsters,
    createMonster: () => ({ id: ++factoryCalls })
  });

  assert.deepEqual(result, { lastSpawnTime: 547, spawnedCount: 4 });
  assert.equal(factoryCalls, 4);
  assert.deepEqual(monsters, [
    { id: 'existing' },
    { id: 1 },
    { id: 2 },
    { id: 3 },
    { id: 4 }
  ]);
});
