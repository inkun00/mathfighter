import { GRADE_SIX_SEMESTER_ONE_QUESTION_BANK } from './grade6Semester1QuestionBank.js';

function greatestCommonDivisor(first, second) {
  let a = first;
  let b = second;
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a;
}

function hasFiniteDecimalDenominator(numerator, denominator) {
  let reducedDenominator = denominator / greatestCommonDivisor(numerator, denominator);
  while (reducedDenominator % 2 === 0) reducedDenominator /= 2;
  while (reducedDenominator % 5 === 0) reducedDenominator /= 5;
  return reducedDenominator === 1;
}

function normalizeNumericAnswer(answer) {
  const normalized = String(answer).replace(/,/g, '').trim();
  const plainNumber = normalized.match(/^(\d+(?:\.\d+)?)(?:[^\d./:x+\-]{0,4})$/u);
  if (plainNumber) return plainNumber[1];

  const fraction = normalized.match(/^(?:(\d+)\s+)?(\d+)\/(\d+)(?:[^\d./:x+\-]{0,4})$/u);
  if (!fraction) return null;

  const whole = Number(fraction[1] || 0);
  const numerator = Number(fraction[2]);
  const denominator = Number(fraction[3]);
  if (!hasFiniteDecimalDenominator(numerator, denominator)) return null;
  return String(whole + numerator / denominator);
}

function createBrainQuestion(question) {
  if (question.text.startsWith('다음 중') || question.text.startsWith('앞 문제')) return null;
  if (question.text.includes('분수로') || question.text.includes('대분수로')) return null;
  if (question.text.includes('몇 분의 몇') || question.text.includes('단위는 무엇')) return null;

  const answer = normalizeNumericAnswer(question.answer);
  if (answer === null) return null;

  return {
    id: `brain-${question.id}`,
    curriculum: '6-1',
    area: question.area,
    sourceQuestionId: question.id,
    text: question.text,
    answer,
    allowDecimal: true
  };
}

export const GRADE_SIX_SEMESTER_ONE_BRAIN_QUESTION_BANK =
  GRADE_SIX_SEMESTER_ONE_QUESTION_BANK
    .map(createBrainQuestion)
    .filter(Boolean);
