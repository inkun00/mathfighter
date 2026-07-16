import { GRADE_FIVE_SEMESTER_ONE_QUESTION_BANK } from './grade5Semester1QuestionBank.js';

function isSelfContainedNumericQuestion(question) {
  const answer = String(question.answer).replace(/\s+/g, '');
  return /^\d[\d,]*(?:\.\d+)?(?:개|명|m)?$/.test(answer)
    && !question.text.startsWith('다음 중')
    && !question.text.startsWith('앞 문제')
    && !question.text.includes('공약수가 아닌');
}

function normalizeNumericAnswer(answer) {
  return String(answer).replace(/,/g, '').match(/^\d+(?:\.\d+)?/)[0];
}

export const GRADE_FIVE_SEMESTER_ONE_BRAIN_QUESTION_BANK =
  GRADE_FIVE_SEMESTER_ONE_QUESTION_BANK
    .filter(isSelfContainedNumericQuestion)
    .map(question => ({
      id: `brain-${question.id}`,
      curriculum: '5-1',
      area: question.area,
      sourceQuestionId: question.id,
      text: question.text,
      answer: normalizeNumericAnswer(question.answer),
      allowDecimal: true
    }));
