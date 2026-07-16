import assert from 'node:assert/strict';
import test from 'node:test';
import {
  generateBrainTrainingQuestions,
  generateProblem,
  getCorrectDropChance,
  getDivisors,
  getGCD,
  getLCM,
  getNextNumberDrop,
  getRandomNumberPool,
  getSimilarQuestions,
  setCustomQuizData
} from '../src/mathEngine.js';
import { applyCurriculumToPlayer } from '../src/curriculumProblems.js';

test('creates numeric short-answer questions for brain training', () => {
  setCustomQuizData([
    { name: '각도', items: ['30도', '60도'] },
    { name: '길이', items: ['120cm', '240cm'] },
    { name: '큰 수', items: ['30억', '50억'] }
  ]);

  const questions = generateBrainTrainingQuestions(1);

  assert.equal(questions.length, 3);
  questions.forEach(question => {
    assert.deepEqual(question.options, []);
    assert.match(question.answer, /^\d+$/);
    assert.ok(question.answers.every(answer => /^\d+$/.test(answer)));
  });
  setCustomQuizData(null);
});

test('rejects decimal and signed custom answers from brain training', () => {
  setCustomQuizData([
    { name: '소수', items: ['3.5'] },
    { name: '음수', items: ['-4'] },
    { name: '기호', items: ['+12'] }
  ]);

  const questions = generateBrainTrainingQuestions(1);

  assert.equal(questions.length, 3);
  assert.ok(questions.every(question => /^\d+$/.test(question.answer)));
  setCustomQuizData(null);
});

test('prioritizes grade 4 semester 1 review questions over custom quiz data', () => {
  applyCurriculumToPlayer({}, '4-1');
  setCustomQuizData([
    { name: '포유류', items: ['고래', '호랑이'] },
    { name: '조류', items: ['참새', '독수리'] }
  ]);

  const questions = getSimilarQuestions([1]);

  assert.equal(questions.length, 3);
  assert.ok(questions.every(question => question.area === 1));
  assert.ok(questions.every(question => question.id.startsWith('review-curriculum-')));

  setCustomQuizData(null);
  applyCurriculumToPlayer({}, '5-1');
});

test('prioritizes grade 5 semester 1 brain-training bank over custom quiz data', () => {
  applyCurriculumToPlayer({}, '5-1');
  setCustomQuizData([
    { name: '포유류', items: ['10', '20'] },
    { name: '조류', items: ['30', '40'] },
    { name: '어류', items: ['50', '60'] }
  ]);

  const questions = generateBrainTrainingQuestions(1);
  assert.equal(questions.length, 3);
  assert.ok(questions.every(question => question.bankQuestionId.startsWith('brain-g5s1-')));
  assert.ok(questions.every(question => /^\d+(?:\.\d+)?$/.test(question.answer)));

  setCustomQuizData(null);
  applyCurriculumToPlayer({}, '6-1');
});

test('uses a 25:75 correct-to-wrong drop ratio for every problem type', () => {
  assert.equal(getCorrectDropChance({ type: 'curriculum_choice' }), 0.25);
  assert.equal(getCorrectDropChance({ type: 'custom_text' }), 0.25);
  assert.equal(getCorrectDropChance({ type: 'multiple' }), 0.25);
  assert.equal(getCorrectDropChance(null), 0);
});

test('builds answer pools with exactly one correct candidate out of four', () => {
  const curriculumProblem = {
    type: 'curriculum_choice',
    options: [24],
    wrongAnswers: [12, 18, 30],
    checkAnswer: value => value === 24
  };
  const standardProblem = {
    type: 'multiple',
    targetNum: 7,
    options: [14, 21],
    checkAnswer: value => value % 7 === 0
  };

  [curriculumProblem, standardProblem].forEach(problem => {
    const pool = getRandomNumberPool(problem);
    assert.equal(pool.length, 4);
    assert.equal(pool.filter(value => problem.checkAnswer(value)).length, 1);
  });
});

test('guarantees one correct answer in every four consecutive number drops', () => {
  const problem = {
    type: 'curriculum_choice',
    options: [24],
    wrongAnswers: [12, 18, 30],
    checkAnswer: value => value === 24
  };
  const drops = Array.from({ length: 100 }, () => getNextNumberDrop(problem));
  const firstCorrectIndex = drops.findIndex(value => problem.checkAnswer(value));

  assert.ok(firstCorrectIndex >= 0 && firstCorrectIndex < 4);
  for (let start = firstCorrectIndex; start + 4 <= drops.length; start += 4) {
    const block = drops.slice(start, start + 4);
    assert.equal(block.filter(value => problem.checkAnswer(value)).length, 1);
  }
  assert.ok(drops.every(value => [12, 18, 24, 30].includes(value)));
});

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
