import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildWorksheetHtml,
  getFrequentWrongQuestions,
  getUnitAccuracy,
  getUnitLabels,
  recordProblemAttempt
} from '../src/learningReport.js';

test('records unit accuracy and ranks frequently missed problems', () => {
  const correct = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const total = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const wrong = {};
  const problem = {
    area: 2,
    type: 'curriculum_choice',
    text: '삼각형의 세 각의 합은?',
    options: [180],
    wrongAnswers: [90, 270, 360]
  };

  recordProblemAttempt(correct, total, wrong, problem, false);
  recordProblemAttempt(correct, total, wrong, problem, false);
  recordProblemAttempt(correct, total, wrong, problem, true);

  const accuracy = getUnitAccuracy(correct, total, ['큰 수', '각도', '계산', '도형', '규칙']);
  assert.deepEqual(accuracy[1], { area: 2, label: '각도', correct: 1, total: 3, rate: 33 });
  assert.equal(getFrequentWrongQuestions(wrong)[0].wrongCount, 2);
});

test('provides all six grade 5 semester 1 unit labels', () => {
  assert.deepEqual(getUnitLabels({ curriculum: '5-1' }), [
    '자연수의 혼합 계산', '약수와 배수', '규칙과 대응',
    '약분과 통분', '분수의 덧셈과 뺄셈', '다각형의 둘레와 넓이'
  ]);
});

test('provides all six grade 6 semester 1 unit labels', () => {
  assert.deepEqual(getUnitLabels({ curriculum: '6-1' }), [
    '분수의 나눗셈', '각기둥과 각뿔', '소수의 나눗셈',
    '비와 비율', '여러 가지 그래프', '직육면체의 겉넓이와 부피'
  ]);
});

test('builds a two-page worksheet with questions first and answers second', () => {
  const html = buildWorksheetHtml({
    playerName: '테스트 학생',
    curriculum: '4-1',
    labels: ['큰 수', '각도', '계산', '도형', '규칙'],
    questions: [{
      area: 2,
      text: '삼각형의 세 각의 합은?',
      answers: [180],
      distractors: [90, 270, 360],
      wrongCount: 2
    }]
  });

  assert.equal((html.match(/<section class="page">/g) || []).length, 2);
  assert.ok(html.indexOf('수학 보충 학습 시험지') < html.indexOf('문항별 정답'));
  assert.match(html, /<td>180<\/td>/);
  assert.match(html, /page-break-after: always/);
});
