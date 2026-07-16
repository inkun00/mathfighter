import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyCurriculumToPlayer,
  generateCurriculumBrainTrainingQuestions,
  generateCurriculumProblem,
  generateCurriculumReviewQuestions,
  getCurriculumGameQuestionBankState,
  resetCurriculumGameQuestionBank,
  restoreCurriculumGameQuestionBankState,
  restorePlayerCurriculum
} from '../src/curriculumProblems.js';
import { GRADE_FOUR_SEMESTER_ONE_QUESTION_BANK } from '../src/grade4Semester1QuestionBank.js';
import { GRADE_FOUR_SEMESTER_ONE_BRAIN_QUESTION_BANK } from '../src/grade4Semester1BrainQuestionBank.js';
import { GRADE_FIVE_SEMESTER_ONE_QUESTION_BANK } from '../src/grade5Semester1QuestionBank.js';
import { GRADE_FIVE_SEMESTER_ONE_BRAIN_QUESTION_BANK } from '../src/grade5Semester1BrainQuestionBank.js';
import { GRADE_SIX_SEMESTER_ONE_QUESTION_BANK } from '../src/grade6Semester1QuestionBank.js';

test('creates solvable game-ready problems for the grade 4 semester 1 curriculum', () => {
  const player = applyCurriculumToPlayer({}, '4-1');
  assert.equal(player.grade, 4);
  assert.equal(player.curriculum, '4-1');

  for (let i = 0; i < 100; i++) {
    const problem = generateCurriculumProblem();
    assert.equal(problem.type, 'curriculum_choice');
    assert.equal(problem.requiredCount, 1);
    assert.equal(problem.options.length, 1);
    assert.equal(problem.checkAnswer(problem.options[0]), true);
    assert.ok(problem.wrongAnswers.length >= 2);
    assert.ok(problem.wrongAnswers.every(answer => !problem.checkAnswer(answer)));
  }
});

test('loads all 100 uploaded questions with 20 questions in every unit', () => {
  assert.equal(GRADE_FOUR_SEMESTER_ONE_QUESTION_BANK.length, 100);
  assert.equal(new Set(GRADE_FOUR_SEMESTER_ONE_QUESTION_BANK.map(question => question.id)).size, 100);
  for (let area = 1; area <= 5; area++) {
    assert.equal(
      GRADE_FOUR_SEMESTER_ONE_QUESTION_BANK.filter(question => question.area === area).length,
      20
    );
  }
});

test('uses every uploaded question before repeating and balances units in groups of five', () => {
  resetCurriculumGameQuestionBank();
  applyCurriculumToPlayer({}, '4-1');
  const cycle = Array.from({ length: 100 }, () => generateCurriculumProblem());

  assert.equal(new Set(cycle.map(problem => problem.bankQuestionId)).size, 100);
  for (let index = 0; index < cycle.length; index += 5) {
    assert.deepEqual(
      [...new Set(cycle.slice(index, index + 5).map(problem => problem.area))].sort(),
      [1, 2, 3, 4, 5]
    );
  }

  const nextCycleProblem = generateCurriculumProblem();
  assert.notEqual(nextCycleProblem.bankQuestionId, cycle.at(-1).bankQuestionId);
});

test('restores the remaining question order without reusing consumed questions', () => {
  resetCurriculumGameQuestionBank();
  applyCurriculumToPlayer({}, '4-1');
  const consumed = Array.from({ length: 12 }, () => generateCurriculumProblem().bankQuestionId);
  const savedState = getCurriculumGameQuestionBankState();

  resetCurriculumGameQuestionBank();
  assert.equal(restoreCurriculumGameQuestionBankState(savedState), true);
  const remaining = Array.from({ length: 88 }, () => generateCurriculumProblem().bankQuestionId);

  assert.equal(new Set(remaining).size, 88);
  assert.ok(remaining.every(id => !consumed.includes(id)));
});

test('keeps Korean large-number units during gameplay', () => {
  applyCurriculumToPlayer({}, '4-1');
  let largeNumberProblem = null;

  for (let i = 0; i < 1000 && !largeNumberProblem; i++) {
    const problem = generateCurriculumProblem();
    if (problem.text.includes('10억씩')) largeNumberProblem = problem;
  }

  assert.ok(largeNumberProblem);
  assert.match(largeNumberProblem.options[0], /^\d+억$/);
  assert.ok(largeNumberProblem.wrongAnswers.every(answer => /^\d+억$/.test(answer)));
  assert.equal(largeNumberProblem.checkAnswer(largeNumberProblem.options[0]), true);
});

test('keeps other grade and semester selections on the standard problem path', () => {
  applyCurriculumToPlayer({}, '5-2');
  assert.equal(generateCurriculumProblem(), null);
});

test('loads and exhausts all 120 grade 5 semester 1 questions in balanced unit groups', () => {
  assert.equal(GRADE_FIVE_SEMESTER_ONE_QUESTION_BANK.length, 120);
  assert.equal(new Set(GRADE_FIVE_SEMESTER_ONE_QUESTION_BANK.map(question => question.id)).size, 120);
  for (let area = 1; area <= 6; area++) {
    assert.equal(GRADE_FIVE_SEMESTER_ONE_QUESTION_BANK.filter(question => question.area === area).length, 20);
  }

  applyCurriculumToPlayer({}, '5-1');
  const cycle = Array.from({ length: 120 }, () => generateCurriculumProblem());
  assert.equal(new Set(cycle.map(problem => problem.bankQuestionId)).size, 120);
  for (let index = 0; index < cycle.length; index += 6) {
    assert.deepEqual([...new Set(cycle.slice(index, index + 6).map(problem => problem.area))].sort(), [1, 2, 3, 4, 5, 6]);
  }
});

test('restores unused grade 5 semester 1 bank questions', () => {
  applyCurriculumToPlayer({}, '4-2');
  applyCurriculumToPlayer({}, '5-1');
  const consumed = Array.from({ length: 17 }, () => generateCurriculumProblem().bankQuestionId);
  const savedState = getCurriculumGameQuestionBankState();

  resetCurriculumGameQuestionBank();
  assert.equal(restoreCurriculumGameQuestionBankState(savedState), true);
  const remaining = Array.from({ length: 103 }, () => generateCurriculumProblem().bankQuestionId);
  assert.equal(new Set(remaining).size, 103);
  assert.ok(remaining.every(id => !consumed.includes(id)));
});

test('loads and exhausts all 120 grade 6 semester 1 questions in balanced unit groups', () => {
  assert.equal(GRADE_SIX_SEMESTER_ONE_QUESTION_BANK.length, 120);
  assert.equal(new Set(GRADE_SIX_SEMESTER_ONE_QUESTION_BANK.map(question => question.id)).size, 120);
  for (let area = 1; area <= 6; area++) {
    assert.equal(GRADE_SIX_SEMESTER_ONE_QUESTION_BANK.filter(question => question.area === area).length, 20);
  }

  applyCurriculumToPlayer({}, '6-1');
  const cycle = Array.from({ length: 120 }, () => generateCurriculumProblem());
  assert.equal(new Set(cycle.map(problem => problem.bankQuestionId)).size, 120);
  for (let index = 0; index < cycle.length; index += 6) {
    assert.deepEqual([...new Set(cycle.slice(index, index + 6).map(problem => problem.area))].sort(), [1, 2, 3, 4, 5, 6]);
  }
});

test('uses the corrected grade 6 content throughout the second uploaded set', () => {
  const secondSet = GRADE_SIX_SEMESTER_ONE_QUESTION_BANK.filter(question => question.sourceSet === 2);
  assert.equal(secondSet.length, 60);
  assert.deepEqual(
    secondSet.find(question => question.sourceQuestion === 1),
    {
      id: 'g6s1-set2-q1', curriculum: '6-1', area: 1, sourceUnit: 1, sourceSet: 2, sourceQuestion: 1,
      text: '5/7 ÷ 4의 계산 결과는 얼마입니까?', answer: '5/28', wrongAnswers: ['20/7', '4/7', '7/20']
    }
  );
  assert.match(secondSet.find(question => question.sourceQuestion === 21).text, /14\.8 ÷ 4/);
  assert.match(secondSet.find(question => question.sourceQuestion === 51).text, /직육면체의 부피/);
  assert.ok(secondSet.every(question => !/자연수의 혼합 계산|약수와 배수|규칙과 대응/.test(question.text)));
});

test('restores unused grade 6 semester 1 bank questions', () => {
  applyCurriculumToPlayer({}, '6-2');
  applyCurriculumToPlayer({}, '6-1');
  const consumed = Array.from({ length: 21 }, () => generateCurriculumProblem().bankQuestionId);
  const savedState = getCurriculumGameQuestionBankState();

  resetCurriculumGameQuestionBank();
  assert.equal(restoreCurriculumGameQuestionBankState(savedState), true);
  const remaining = Array.from({ length: 99 }, () => generateCurriculumProblem().bankQuestionId);
  assert.equal(new Set(remaining).size, 99);
  assert.ok(remaining.every(id => !consumed.includes(id)));
});

test('creates three grade 4 semester 1 brain-training questions from distinct units', () => {
  applyCurriculumToPlayer({}, '4-1');
  const questions = generateCurriculumBrainTrainingQuestions();

  assert.equal(questions.length, 3);
  assert.equal(new Set(questions.map(question => question.area)).size, 3);
  questions.forEach(question => {
    assert.deepEqual(question.options, []);
    assert.match(question.answer, /^\d+$/);
    assert.deepEqual(question.answers, [question.answer]);
  });
});

test('loads 100 numeric brain-training bank questions with 20 questions in every unit', () => {
  assert.equal(GRADE_FOUR_SEMESTER_ONE_BRAIN_QUESTION_BANK.length, 100);
  assert.equal(new Set(GRADE_FOUR_SEMESTER_ONE_BRAIN_QUESTION_BANK.map(question => question.id)).size, 100);
  assert.equal(new Set(GRADE_FOUR_SEMESTER_ONE_BRAIN_QUESTION_BANK.map(
    question => `${question.text}::${question.answer}`
  )).size, 100);
  assert.ok(GRADE_FOUR_SEMESTER_ONE_BRAIN_QUESTION_BANK.every(question => /^\d+$/.test(question.answer)));
  for (let area = 1; area <= 5; area++) {
    assert.equal(
      GRADE_FOUR_SEMESTER_ONE_BRAIN_QUESTION_BANK.filter(question => question.area === area).length,
      20
    );
  }
});

test('uses every brain-training bank question before repeating', () => {
  applyCurriculumToPlayer({}, '5-1');
  applyCurriculumToPlayer({}, '4-1');
  const firstNinetyNine = Array.from({ length: 33 }, () => generateCurriculumBrainTrainingQuestions()).flat();
  const nextSession = generateCurriculumBrainTrainingQuestions();
  const firstCycleIds = [...firstNinetyNine.map(question => question.bankQuestionId), nextSession[0].bankQuestionId];

  assert.equal(new Set(firstCycleIds).size, 100);
  assert.equal(new Set(nextSession.map(question => question.area)).size, 3);
  assert.ok(nextSession.slice(1).every(question => !firstNinetyNine.slice(-3)
    .some(previous => previous.bankQuestionId === question.bankQuestionId)));
});

test('restores the remaining brain-training question order', () => {
  applyCurriculumToPlayer({}, '5-1');
  applyCurriculumToPlayer({}, '4-1');
  const consumed = generateCurriculumBrainTrainingQuestions().map(question => question.bankQuestionId);
  const savedState = getCurriculumGameQuestionBankState();

  resetCurriculumGameQuestionBank();
  assert.equal(restoreCurriculumGameQuestionBankState(savedState), true);
  const restored = Array.from({ length: 32 }, () => generateCurriculumBrainTrainingQuestions()).flat();

  assert.equal(restored.length, 96);
  assert.equal(new Set(restored.map(question => question.bankQuestionId)).size, 96);
  assert.ok(restored.every(question => !consumed.includes(question.bankQuestionId)));
});

test('builds the grade 5 brain-training bank only from self-contained numeric source questions', () => {
  assert.equal(GRADE_FIVE_SEMESTER_ONE_BRAIN_QUESTION_BANK.length, 60);
  assert.equal(new Set(GRADE_FIVE_SEMESTER_ONE_BRAIN_QUESTION_BANK.map(question => question.id)).size, 60);
  assert.ok(GRADE_FIVE_SEMESTER_ONE_BRAIN_QUESTION_BANK.every(question => /^\d+(?:\.\d+)?$/.test(question.answer)));
  assert.deepEqual(
    GRADE_FIVE_SEMESTER_ONE_BRAIN_QUESTION_BANK.filter(question => question.answer.includes('.')).map(question => question.answer).sort(),
    ['0.45', '0.7']
  );
  assert.ok(GRADE_FIVE_SEMESTER_ONE_BRAIN_QUESTION_BANK.every(question => (
    GRADE_FIVE_SEMESTER_ONE_QUESTION_BANK.some(source => source.id === question.sourceQuestionId)
  )));
});

test('uses every grade 5 brain-training bank question before repeating', () => {
  applyCurriculumToPlayer({}, '4-2');
  applyCurriculumToPlayer({}, '5-1');
  const sessions = Array.from({ length: 20 }, () => generateCurriculumBrainTrainingQuestions());
  const cycle = sessions.flat();

  assert.equal(new Set(cycle.map(question => question.bankQuestionId)).size, 60);
  assert.ok(sessions.every(questions => new Set(questions.map(question => question.area)).size === 3));
  assert.ok(cycle.every(question => /^\d+(?:\.\d+)?$/.test(question.answer) && question.options.length === 0));
  assert.ok(cycle.every(question => question.allowDecimal));
});

test('restores unused grade 5 brain-training questions', () => {
  applyCurriculumToPlayer({}, '4-2');
  applyCurriculumToPlayer({}, '5-1');
  const consumed = generateCurriculumBrainTrainingQuestions().map(question => question.bankQuestionId);
  const savedState = getCurriculumGameQuestionBankState();

  resetCurriculumGameQuestionBank();
  assert.equal(restoreCurriculumGameQuestionBankState(savedState), true);
  const remaining = Array.from({ length: 19 }, () => generateCurriculumBrainTrainingQuestions()).flat();
  assert.equal(new Set(remaining.map(question => question.bankQuestionId)).size, 57);
  assert.ok(remaining.every(question => !consumed.includes(question.bankQuestionId)));
});

test('creates grade 4 semester 1 review questions from recorded weak units', () => {
  applyCurriculumToPlayer({}, '4-1');
  const questions = generateCurriculumReviewQuestions([2, 4]);

  assert.equal(questions.length, 3);
  assert.deepEqual(questions.map(question => question.area), [2, 4, 2]);
  questions.forEach(question => {
    assert.ok(question.options.length >= 3);
    assert.ok(question.options.includes(question.answer));
    assert.deepEqual(question.answers, [question.answer]);
  });
});

test('creates grade 5 semester 1 review questions from its uploaded bank', () => {
  applyCurriculumToPlayer({}, '5-1');
  const questions = generateCurriculumReviewQuestions([4, 6]);

  assert.deepEqual(questions.map(question => question.area), [4, 6, 4]);
  questions.forEach(question => {
    assert.ok(GRADE_FIVE_SEMESTER_ONE_QUESTION_BANK.some(item => item.id === question.bankQuestionId));
    assert.ok(question.options.includes(question.answer));
  });
});

test('creates grade 6 semester 1 review questions from its uploaded bank', () => {
  applyCurriculumToPlayer({}, '6-1');
  const questions = generateCurriculumReviewQuestions([1, 3, 6]);

  assert.deepEqual(questions.map(question => question.area), [1, 3, 6]);
  questions.forEach(question => {
    assert.ok(GRADE_SIX_SEMESTER_ONE_QUESTION_BANK.some(item => item.id === question.bankQuestionId));
    assert.ok(question.options.includes(question.answer));
  });
});

test('keeps curriculum review generation disabled outside bank-backed curricula', () => {
  applyCurriculumToPlayer({}, '6-2');
  assert.equal(generateCurriculumReviewQuestions([1, 2]), null);
});

test('restores legacy grades and current curriculum selections', () => {
  const selectElement = { value: '' };
  const legacyPlayer = restorePlayerCurriculum({}, { grade: 4 }, selectElement);
  assert.equal(legacyPlayer.curriculum, '4-1');
  assert.equal(selectElement.value, '4-1');

  const currentPlayer = restorePlayerCurriculum({}, { curriculum: '6-2' }, selectElement);
  assert.equal(currentPlayer.grade, 6);
  assert.equal(selectElement.value, '6-2');
});
