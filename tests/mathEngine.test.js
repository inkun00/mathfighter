import assert from 'node:assert/strict';
import test from 'node:test';
import {
  generateProblem,
  getDivisors,
  getGCD,
  getLCM,
  setCustomQuizData
} from '../src/mathEngine.js';

test('getDivisors returns all positive divisors in ascending order', () => {
  assert.deepEqual(getDivisors(36), [1, 2, 3, 4, 6, 9, 12, 18, 36]);
});

test('getGCD and getLCM calculate common factor values', () => {
  assert.equal(getGCD(18, 30), 6);
  assert.equal(getLCM(8, 12), 24);
});

test('generateProblem creates a solvable standard problem without browser globals', () => {
  setCustomQuizData(null);
  const problem = generateProblem(1);

  assert.equal(typeof problem.text, 'string');
  assert.ok(problem.options.length > 0);
  assert.ok(problem.options.some(option => problem.checkAnswer(option)));
});

test('generateProblem supports custom quiz data', () => {
  setCustomQuizData([
    { name: '포유류', items: ['고래', '박쥐', '호랑이'] },
    { name: '조류', items: ['참새', '독수리', '펭귄'] }
  ]);

  const problem = generateProblem(1);

  assert.equal(problem.type, 'custom_text');
  assert.equal(problem.requiredCount, 3);
  assert.ok(problem.options.some(option => problem.checkAnswer(option)));
  assert.ok(problem.wrongAnswers.length > 0);

  setCustomQuizData(null);
});
