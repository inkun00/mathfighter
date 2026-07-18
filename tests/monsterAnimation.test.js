import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getMonsterAnimationFrame,
  getMonsterMotionDirection
} from '../src/monster.js';

test('uses the idle frame while a monster is stationary', () => {
  assert.equal(getMonsterAnimationFrame(false, 9999, 64), 0);
});

test('plays generated walking poses in their original forward order', () => {
  const phaseDistance = 9.6;
  const frames = [0, 1, 2, 3, 4].map(phase => (
    getMonsterAnimationFrame(true, phase * phaseDistance, 64)
  ));

  assert.deepEqual(frames, [0, 1, 2, 3, 0]);
});

test('advances walking frames from traveled distance', () => {
  assert.equal(getMonsterAnimationFrame(true, 8, 64), 0);
  assert.equal(getMonsterAnimationFrame(true, 10, 64), 1);
  assert.equal(getMonsterAnimationFrame(true, 20, 64), 2);
});

test('derives sprite direction from actual diagonal movement', () => {
  assert.deepEqual(getMonsterMotionDirection(-3, 1), { facing: -1, direction: 'side' });
  assert.deepEqual(getMonsterMotionDirection(1, -3, -1), { facing: -1, direction: 'up' });
  assert.deepEqual(getMonsterMotionDirection(0, 0, 1, 'down'), { facing: 1, direction: 'down' });
});

test('keeps the current sprite row around diagonal direction boundaries', () => {
  assert.deepEqual(getMonsterMotionDirection(1, 1.05, 1, 'side'), { facing: 1, direction: 'side' });
  assert.deepEqual(getMonsterMotionDirection(1.05, 1, 1, 'down'), { facing: 1, direction: 'down' });
  assert.deepEqual(getMonsterMotionDirection(1, 1.4, 1, 'side'), { facing: 1, direction: 'down' });
});
