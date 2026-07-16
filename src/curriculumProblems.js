import { GRADE_FOUR_SEMESTER_ONE_QUESTION_BANK } from './grade4Semester1QuestionBank.js';
import { GRADE_FOUR_SEMESTER_ONE_BRAIN_QUESTION_BANK } from './grade4Semester1BrainQuestionBank.js';
import { GRADE_FIVE_SEMESTER_ONE_QUESTION_BANK } from './grade5Semester1QuestionBank.js';
import { GRADE_FIVE_SEMESTER_ONE_BRAIN_QUESTION_BANK } from './grade5Semester1BrainQuestionBank.js';
import { GRADE_SIX_SEMESTER_ONE_QUESTION_BANK } from './grade6Semester1QuestionBank.js';

const SUPPORTED_CURRICULA = new Set(['4-1', '4-2', '5-1', '5-2', '6-1', '6-2']);
const GAME_QUESTION_BANKS = new Map([
  ['4-1', GRADE_FOUR_SEMESTER_ONE_QUESTION_BANK.map(question => ({ ...question, curriculum: '4-1' }))],
  ['5-1', GRADE_FIVE_SEMESTER_ONE_QUESTION_BANK],
  ['6-1', GRADE_SIX_SEMESTER_ONE_QUESTION_BANK]
]);
const QUESTION_BANK_BY_ID = new Map(
  [...GAME_QUESTION_BANKS.values()].flat().map(question => [question.id, question])
);
const BRAIN_QUESTION_BANKS = new Map([
  ['4-1', GRADE_FOUR_SEMESTER_ONE_BRAIN_QUESTION_BANK.map(question => ({ ...question, curriculum: '4-1' }))],
  ['5-1', GRADE_FIVE_SEMESTER_ONE_BRAIN_QUESTION_BANK]
]);
const BRAIN_QUESTION_BANK_BY_ID = new Map(
  [...BRAIN_QUESTION_BANKS.values()].flat().map(question => [question.id, question])
);
let activeCurriculum = null;
let gameQuestionQueue = [];
let lastGameQuestionId = null;
let gameQuestionBankCurriculum = null;
let brainQuestionQueue = [];
let recentBrainQuestionIds = [];
let brainQuestionBankCurriculum = null;

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFrom(values) {
  return values[Math.floor(Math.random() * values.length)];
}

function shuffle(values) {
  return [...values].sort(() => Math.random() - 0.5);
}

function uniqueWrongAnswers(answer, values) {
  return [...new Set(values)].filter(value => value !== answer).slice(0, 4);
}

function createChoiceProblem(area, text, answer, wrongAnswers) {
  return {
    area,
    text,
    targetNum: text,
    type: 'curriculum_choice',
    options: [answer],
    wrongAnswers: uniqueWrongAnswers(answer, wrongAnswers),
    requiredCount: 1,
    checkAnswer: value => value === answer
  };
}

function buildGameQuestionQueue(curriculum) {
  const bank = GAME_QUESTION_BANKS.get(curriculum) || [];
  const areas = [...new Set(bank.map(question => question.area))].sort((a, b) => a - b);
  const questionsByArea = new Map();
  for (const area of areas) {
    questionsByArea.set(area, shuffle(bank.filter(question => question.area === area)));
  }

  const queue = [];
  const rounds = Math.max(0, ...questionsByArea.values().map(questions => questions.length));
  for (let round = 0; round < rounds; round++) {
    shuffle(areas).forEach(area => {
      if (!questionsByArea.get(area)[round]) return;
      queue.push(questionsByArea.get(area)[round]);
    });
  }

  if (queue[0]?.id === lastGameQuestionId) {
    const swapIndex = queue.findIndex(question => (
      question.area === queue[0].area && question.id !== lastGameQuestionId
    ));
    [queue[0], queue[swapIndex]] = [queue[swapIndex], queue[0]];
  }
  return queue;
}

function buildBrainQuestionQueue(curriculum, excludedAreas = [], blockedIds = recentBrainQuestionIds) {
  const bank = BRAIN_QUESTION_BANKS.get(curriculum) || [];
  const areas = [...new Set(bank.map(question => question.area))];
  const questionsByArea = new Map();
  for (const area of areas) {
    const questions = shuffle(bank.filter(question => question.area === area));
    if (blockedIds.includes(questions[0].id)) {
      const swapIndex = questions.findIndex(question => !blockedIds.includes(question.id));
      [questions[0], questions[swapIndex]] = [questions[swapIndex], questions[0]];
    }
    questionsByArea.set(area, questions);
  }

  const queue = [];
  let firstBatch = true;
  while ([...questionsByArea.values()].some(questions => questions.length > 0)) {
    const selectedAreas = [];
    while (selectedAreas.length < 3) {
      let candidates = areas.filter(area => (
        questionsByArea.get(area).length > 0
        && !selectedAreas.includes(area)
        && (!firstBatch || !excludedAreas.includes(area))
      ));
      if (candidates.length === 0 && firstBatch) {
        candidates = areas.filter(area => (
          questionsByArea.get(area).length > 0 && !selectedAreas.includes(area)
        ));
      }
      if (candidates.length === 0) break;
      const maxRemaining = Math.max(...candidates.map(area => questionsByArea.get(area).length));
      const area = randomFrom(candidates.filter(candidate => questionsByArea.get(candidate).length === maxRemaining));
      selectedAreas.push(area);
      queue.push(questionsByArea.get(area).shift());
    }
    firstBatch = false;
  }

  return queue;
}

function createBankProblem(question) {
  return {
    ...createChoiceProblem(question.area, question.text, question.answer, question.wrongAnswers),
    bankQuestionId: question.id,
    sourceSet: question.sourceSet,
    sourceQuestion: question.sourceQuestion
  };
}

export function resetCurriculumGameQuestionBank() {
  gameQuestionQueue = [];
  lastGameQuestionId = null;
  gameQuestionBankCurriculum = null;
  brainQuestionQueue = [];
  recentBrainQuestionIds = [];
  brainQuestionBankCurriculum = null;
}

export function getCurriculumGameQuestionBankState() {
  return {
    remainingQuestionIds: gameQuestionQueue.map(question => question.id),
    lastQuestionId: lastGameQuestionId,
    curriculum: gameQuestionBankCurriculum || activeCurriculum,
    remainingBrainQuestionIds: brainQuestionQueue.map(question => question.id),
    recentBrainQuestionIds: [...recentBrainQuestionIds],
    brainCurriculum: brainQuestionBankCurriculum || activeCurriculum
  };
}

export function restoreCurriculumGameQuestionBankState(state) {
  if (!state || !Array.isArray(state.remainingQuestionIds)) return false;
  const questionIds = [...new Set(state.remainingQuestionIds)];
  const maxBankSize = Math.max(...GAME_QUESTION_BANKS.values().map(bank => bank.length));
  if (questionIds.length !== state.remainingQuestionIds.length || questionIds.length > maxBankSize) return false;
  const restoredQueue = questionIds.map(id => QUESTION_BANK_BY_ID.get(id));
  if (restoredQueue.some(question => !question)) return false;
  const restoredCurriculum = GAME_QUESTION_BANKS.has(state.curriculum)
    ? state.curriculum
    : restoredQueue[0]?.curriculum || activeCurriculum;
  if (!GAME_QUESTION_BANKS.has(restoredCurriculum)) return false;
  if (restoredQueue.some(question => question.curriculum !== restoredCurriculum)) return false;

  gameQuestionQueue = restoredQueue;
  lastGameQuestionId = QUESTION_BANK_BY_ID.has(state.lastQuestionId) ? state.lastQuestionId : null;
  gameQuestionBankCurriculum = restoredCurriculum;

  if (Array.isArray(state.remainingBrainQuestionIds)) {
    const brainIds = [...new Set(state.remainingBrainQuestionIds)];
    const maxBrainBankSize = Math.max(...BRAIN_QUESTION_BANKS.values().map(bank => bank.length));
    if (brainIds.length !== state.remainingBrainQuestionIds.length || brainIds.length > maxBrainBankSize) return false;
    const restoredBrainQueue = brainIds.map(id => BRAIN_QUESTION_BANK_BY_ID.get(id));
    if (restoredBrainQueue.some(question => !question)) return false;
    const restoredBrainCurriculum = BRAIN_QUESTION_BANKS.has(state.brainCurriculum)
      ? state.brainCurriculum
      : restoredBrainQueue[0]?.curriculum
        || (BRAIN_QUESTION_BANKS.has(activeCurriculum) ? activeCurriculum : null);
    if (brainIds.length > 0 && !BRAIN_QUESTION_BANKS.has(restoredBrainCurriculum)) return false;
    if (restoredBrainQueue.some(question => question.curriculum !== restoredBrainCurriculum)) return false;
    brainQuestionQueue = restoredBrainQueue;
    brainQuestionBankCurriculum = restoredBrainCurriculum;
    recentBrainQuestionIds = Array.isArray(state.recentBrainQuestionIds)
      ? state.recentBrainQuestionIds.filter(id => (
        BRAIN_QUESTION_BANK_BY_ID.get(id)?.curriculum === restoredBrainCurriculum
      )).slice(-3)
      : [];
  } else {
    brainQuestionQueue = [];
    recentBrainQuestionIds = [];
    brainQuestionBankCurriculum = null;
  }
  return true;
}

function createLargeNumberProblem() {
  const kind = randomInt(1, 5);
  if (kind === 1) {
    const count = randomInt(2, 9);
    const answer = count * 10000;
    return createChoiceProblem(1, `10,000이 ${count}개인 수는?`, answer, [answer / 10, answer * 10, answer + 10000, count * 1000]);
  }
  if (kind === 2) {
    const digit = randomInt(2, 9);
    const answer = digit * 1000000;
    return createChoiceProblem(1, `${digit},300,000에서 ${digit}이 나타내는 값은?`, answer, [digit * 100000, digit * 10000, digit * 10000000]);
  }
  if (kind === 3) {
    const start = randomInt(2, 8) * 10;
    const answer = `${start + 10}억`;
    return createChoiceProblem(1, `10억씩 셀 때 ${start}억 다음 수는?`, answer, [
      `${start + 1}억`,
      `${start + 5}억`,
      `${start + 100}억`
    ]);
  }
  if (kind === 4) {
    return createChoiceProblem(1, '1조는 1억의 몇 배일까요?', '10,000배', ['100배', '1,000배', '100,000배']);
  }
  const base = randomInt(2, 8) * 1000;
  const answer = `${base + 100}만`;
  return createChoiceProblem(1, `100만씩 셀 때 ${base}만 다음 수는?`, answer, [
    `${base + 1}만`,
    `${base + 10}만`,
    `${base + 1000}만`
  ]);
}

function createAngleProblem(numericOnly = false) {
  const kind = randomInt(1, numericOnly ? 4 : 5);
  if (kind === 1) {
    const first = randomInt(3, 8) * 10;
    const second = randomInt(2, 7) * 5;
    const answer = first + second;
    return createChoiceProblem(2, `${first}도와 ${second}도의 합은?`, answer, [answer - 10, answer + 10, answer + 20]);
  }
  if (kind === 2) {
    const first = randomInt(4, 7) * 10;
    const second = randomInt(3, 6) * 10;
    const answer = 180 - first - second;
    return createChoiceProblem(2, `삼각형의 두 각이 ${first}도, ${second}도일 때 나머지 각은?`, answer, [answer - 10, answer + 10, 180 - answer]);
  }
  if (kind === 3) {
    const third = randomInt(6, 10) * 10;
    const answer = 180 - third;
    return createChoiceProblem(2, `평각에서 ${third}도를 뺀 각은?`, answer, [answer - 10, answer + 10, third]);
  }
  if (kind === 4) {
    const hour = randomFrom([2, 3, 4, 6]);
    const answer = hour * 30;
    return createChoiceProblem(2, `시계가 ${hour}시일 때 두 바늘의 작은 각은?`, answer, [30, 60, 90, 180]);
  }
  return createChoiceProblem(2, '90도보다 크고 180도보다 작은 각은?', '둔각', ['예각', '직각', '평각']);
}

function createCalculationProblem() {
  const kind = randomInt(1, 5);
  if (kind === 1) {
    const first = randomInt(12, 48) * 10;
    const second = randomInt(2, 9) * 10;
    const answer = first * second;
    return createChoiceProblem(3, `${first} × ${second}의 값은?`, answer, [answer / 10, answer + 100, answer - 100]);
  }
  if (kind === 2) {
    const divisor = randomInt(12, 30);
    const quotient = randomInt(4, 30);
    const answer = quotient;
    return createChoiceProblem(3, `${divisor * quotient} ÷ ${divisor}의 몫은?`, answer, [answer - 1, answer + 1, answer + 10]);
  }
  if (kind === 3) {
    const divisor = randomInt(11, 25);
    const quotient = randomInt(3, 9);
    const remainder = randomInt(1, divisor - 1);
    return createChoiceProblem(3, `${divisor * quotient + remainder} ÷ ${divisor}의 나머지는?`, remainder, [
      quotient,
      remainder + 1,
      divisor - remainder,
      Math.max(0, remainder - 1),
      divisor
    ]);
  }
  if (kind === 4) {
    const divisor = randomInt(10, 20);
    const quotient = randomInt(3, 9);
    const remainder = randomInt(1, divisor - 1);
    const answer = divisor * quotient + remainder;
    return createChoiceProblem(3, `${divisor}로 나누어 몫이 ${quotient}, 나머지가 ${remainder}인 수는?`, answer, [divisor * quotient, answer + divisor, answer - remainder]);
  }
  const daily = randomInt(12, 35);
  const days = randomInt(10, 20);
  const answer = daily * days;
  return createChoiceProblem(3, `하루 ${daily}쪽씩 ${days}일 읽으면 모두 몇 쪽일까요?`, answer, [answer - daily, answer + daily, daily + days]);
}

function createTransformationProblem(numericOnly = false) {
  if (numericOnly) {
    return randomFrom([
      createChoiceProblem(4, '시계 방향 90도는 반시계 방향 몇 도와 같을까요?', 270, [90, 180, 360]),
      createChoiceProblem(4, '시계 방향 180도는 반시계 방향 몇 도와 같을까요?', 180, [90, 270, 360]),
      createChoiceProblem(4, '시계 방향 270도는 반시계 방향 몇 도와 같을까요?', 90, [180, 270, 360]),
      createChoiceProblem(4, '시계 방향으로 90도씩 2번 돌리면 모두 몇 도 돌린 것일까요?', 180, [90, 270, 360]),
      createChoiceProblem(4, '시계 방향으로 90도씩 3번 돌리면 모두 몇 도 돌린 것일까요?', 270, [90, 180, 360]),
      createChoiceProblem(4, '시계 방향으로 180도씩 2번 돌리면 모두 몇 도 돌린 것일까요?', 360, [90, 180, 270])
    ]);
  }
  return randomFrom([
    createChoiceProblem(4, '도형을 밀었을 때 변하는 것은?', '위치', ['모양', '크기', '넓이']),
    createChoiceProblem(4, '도형을 두 번 연속 오른쪽으로 뒤집으면?', '처음 모양', ['좌우가 바뀐 모양', '위아래가 바뀐 모양', '90도 돈 모양']),
    createChoiceProblem(4, '시계 방향 270도는 반시계 방향 몇 도와 같을까요?', 90, [180, 270, 360]),
    createChoiceProblem(4, '정사각형을 시계 방향으로 90도 돌리면?', '처음 모양', ['직사각형', '마름모', '삼각형']),
    createChoiceProblem(4, '도형을 시계 방향으로 360도 돌리면?', '처음 모양', ['90도 돈 모양', '뒤집힌 모양', '작아진 모양'])
  ]);
}

function createPatternProblem(numericOnly = false) {
  const kind = randomInt(1, numericOnly ? 4 : 5);
  if (kind === 1) {
    const start = randomInt(1, 5);
    const step = randomInt(2, 9);
    const answer = start + step * 4;
    return createChoiceProblem(5, `${start}, ${start + step}, ${start + step * 2}, ${start + step * 3}, 다음 수는?`, answer, [answer - 1, answer + 1, answer + step]);
  }
  if (kind === 2) {
    const start = randomInt(1, 5);
    const multiplier = randomInt(2, 3);
    const answer = start * multiplier ** 4;
    return createChoiceProblem(5, `${start}, ${start * multiplier}, ${start * multiplier ** 2}, ${start * multiplier ** 3}, 다음 수는?`, answer, [answer / multiplier, answer + multiplier, answer * 2]);
  }
  if (kind === 3) return createChoiceProblem(5, '달력에서 위아래로 이웃한 두 수의 차이는?', 7, [1, 5, 10]);
  if (kind === 4) return createChoiceProblem(5, '90도씩 4번 회전하면 처음보다 몇 도 돈 것과 같을까요?', 360, [90, 180, 270]);
  return createChoiceProblem(5, '5단 곱셈 결과의 일의 자리 규칙은?', '5와 0 반복', ['1과 5 반복', '0과 2 반복', '규칙 없음']);
}

const GRADE_FOUR_SEMESTER_ONE_GENERATORS = [
  createLargeNumberProblem,
  createAngleProblem,
  createCalculationProblem,
  createTransformationProblem,
  createPatternProblem
];

export function applyCurriculumToPlayer(player, curriculum) {
  const normalized = SUPPORTED_CURRICULA.has(curriculum) ? curriculum : '5-1';
  if (activeCurriculum !== normalized) {
    resetCurriculumGameQuestionBank();
  }
  player.curriculum = normalized;
  player.grade = Number(normalized.split('-')[0]);
  activeCurriculum = normalized;
  return player;
}

export function restorePlayerCurriculum(player, snapshot, selectElement) {
  const fallback = snapshot.grade ? `${snapshot.grade}-1` : '5-1';
  applyCurriculumToPlayer(player, snapshot.curriculum || fallback);
  selectElement.value = player.curriculum;
  return player;
}

export function generateCurriculumProblem(curriculum = activeCurriculum) {
  if (!GAME_QUESTION_BANKS.has(curriculum)) return null;
  if (gameQuestionQueue.length === 0 || gameQuestionBankCurriculum !== curriculum) {
    gameQuestionQueue = buildGameQuestionQueue(curriculum);
    gameQuestionBankCurriculum = curriculum;
  }
  const question = gameQuestionQueue.shift();
  lastGameQuestionId = question.id;
  return createBankProblem(question);
}

export function generateCurriculumReviewQuestions(wrongAreas) {
  if (activeCurriculum === '5-1' || activeCurriculum === '6-1') {
    const bank = GAME_QUESTION_BANKS.get(activeCurriculum);
    const areaCount = new Set(bank.map(question => question.area)).size;
    const validAreas = Array.isArray(wrongAreas)
      ? wrongAreas.filter(area => Number.isInteger(area) && area >= 1 && area <= areaCount)
      : [];
    const baseAreas = validAreas.length > 0 ? validAreas : [1, 2, 3];
    const stamp = Date.now().toString(36);

    return Array.from({ length: 3 }, (_, index) => {
      const area = baseAreas[index % baseAreas.length];
      const question = randomFrom(bank.filter(item => item.area === area));
      return {
        id: `review-curriculum-${stamp}-${index + 1}`,
        bankQuestionId: question.id,
        area,
        text: question.text,
        options: shuffle([question.answer, ...question.wrongAnswers]),
        answer: question.answer,
        answers: [question.answer]
      };
    });
  }
  if (activeCurriculum !== '4-1') return null;

  const validAreas = Array.isArray(wrongAreas)
    ? wrongAreas.filter(area => Number.isInteger(area) && area >= 1 && area <= GRADE_FOUR_SEMESTER_ONE_GENERATORS.length)
    : [];
  const baseAreas = validAreas.length > 0 ? validAreas : [1, 2, 3];
  const stamp = Date.now().toString(36);

  return Array.from({ length: 3 }, (_, index) => {
    const area = baseAreas[index % baseAreas.length];
    const problem = GRADE_FOUR_SEMESTER_ONE_GENERATORS[area - 1]();
    const answer = String(problem.options[0]);

    return {
      id: `review-curriculum-${stamp}-${index + 1}`,
      area,
      text: problem.text,
      options: shuffle([answer, ...problem.wrongAnswers.map(String).slice(0, 3)]),
      answer,
      answers: [answer]
    };
  });
}

export function generateCurriculumBrainTrainingQuestions() {
  if (!BRAIN_QUESTION_BANKS.has(activeCurriculum)) return null;
  const stamp = Date.now().toString(36);
  const selected = [];
  while (selected.length < 3) {
    if (brainQuestionQueue.length === 0 || brainQuestionBankCurriculum !== activeCurriculum) {
      brainQuestionQueue = buildBrainQuestionQueue(
        activeCurriculum,
        selected.map(question => question.area),
        [...recentBrainQuestionIds, ...selected.map(question => question.id)]
      );
      brainQuestionBankCurriculum = activeCurriculum;
    }
    selected.push(brainQuestionQueue.shift());
  }

  recentBrainQuestionIds = selected.map(question => question.id);
  return selected.map((question, index) => ({
    id: `brain-curriculum-${stamp}-${index + 1}`,
    bankQuestionId: question.id,
    text: question.text,
    options: [],
    answer: question.answer,
    answers: [question.answer],
    area: question.area,
    allowDecimal: Boolean(question.allowDecimal)
  }));
}
