import assert from 'node:assert/strict';
import test from 'node:test';
import { getCombatRenderQuality } from '../src/gameRenderer.js';

test('reduces combat rendering density as projectile and impact pressure rises', () => {
  assert.equal(getCombatRenderQuality(8, 6), 1);
  assert.equal(getCombatRenderQuality(24, 0), 0.8);
  assert.equal(getCombatRenderQuality(20, 24), 0.62);
  assert.equal(getCombatRenderQuality(32, 32), 0.45);
});

test('clamps invalid combat pressure inputs to the full-quality baseline', () => {
  assert.equal(getCombatRenderQuality(-10, -20), 1);
});
