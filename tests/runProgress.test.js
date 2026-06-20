import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getNextStageTransition,
  getPlayerDeathTransition
} from '../src/runProgress.js';

test('routes normal stage progression back into play', () => {
  assert.deepEqual(getNextStageTransition(49), {
    currentStage: 50,
    destination: 'stage'
  });
});

test('routes progression after the final stage to the certificate', () => {
  assert.deepEqual(getNextStageTransition(50), {
    currentStage: 51,
    destination: 'certificate'
  });
});

test('routes the first death to review and consumes the revive', () => {
  assert.deepEqual(getPlayerDeathTransition({
    isDeathHandled: false,
    usedReviewRevive: false
  }), {
    destination: 'review',
    isDeathHandled: true,
    usedReviewRevive: true
  });
});

test('routes a later death to the certificate', () => {
  assert.deepEqual(getPlayerDeathTransition({
    isDeathHandled: false,
    usedReviewRevive: true
  }), {
    destination: 'certificate',
    isDeathHandled: true,
    usedReviewRevive: true
  });
});

test('ignores duplicate death handling in the same frame', () => {
  assert.deepEqual(getPlayerDeathTransition({
    isDeathHandled: true,
    usedReviewRevive: false
  }), {
    destination: 'ignore',
    isDeathHandled: true,
    usedReviewRevive: false
  });
});
