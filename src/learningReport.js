const DEFAULT_LABELS = ['약수', '배수', '수의 관계', '공약수', '공배수'];
const GRADE_FOUR_SEMESTER_ONE_LABELS = ['큰 수', '각도', '곱셈과 나눗셈', '평면도형의 이동', '규칙 찾기'];
const GRADE_FIVE_SEMESTER_ONE_LABELS = [
  '자연수의 혼합 계산', '약수와 배수', '규칙과 대응',
  '약분과 통분', '분수의 덧셈과 뺄셈', '다각형의 둘레와 넓이'
];
const GRADE_SIX_SEMESTER_ONE_LABELS = [
  '분수의 나눗셈', '각기둥과 각뿔', '소수의 나눗셈',
  '비와 비율', '여러 가지 그래프', '직육면체의 겉넓이와 부피'
];
const CUSTOM_LABELS = ['단어 매칭', '카테고리 분류', '순발력', '집중력', '정확도'];
const MAX_WRONG_QUESTIONS = 50;
const MAX_UNIT_AREA = 6;
const CHOICE_MARKERS = Object.freeze(['①', '②', '③', '④', '⑤']);

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getProblemKey(problem) {
  return `${problem.type || 'unknown'}:${problem.text}:${JSON.stringify(problem.options || [])}`;
}

export function getUnitLabels(player, customMode = false) {
  if (customMode) return CUSTOM_LABELS;
  if (player?.curriculum === '4-1') return GRADE_FOUR_SEMESTER_ONE_LABELS;
  if (player?.curriculum === '5-1') return GRADE_FIVE_SEMESTER_ONE_LABELS;
  if (player?.curriculum === '6-1') return GRADE_SIX_SEMESTER_ONE_LABELS;
  return DEFAULT_LABELS;
}

export function normalizeWrongQuestionStats(value) {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(Object.entries(value).slice(0, MAX_WRONG_QUESTIONS).flatMap(([key, item]) => {
    if (!item || typeof item.text !== 'string') return [];
    return [[key, {
      text: item.text,
      area: Math.max(1, Math.min(MAX_UNIT_AREA, Number(item.area) || 1)),
      answers: Array.isArray(item.answers) ? item.answers.slice(0, 10) : [],
      distractors: Array.isArray(item.distractors) ? item.distractors.slice(0, 10) : [],
      wrongCount: Math.max(1, Number(item.wrongCount) || 1),
      lastWrongAt: Number(item.lastWrongAt) || 0
    }]];
  }));
}

export function recordProblemAttempt(correctAnswers, totalAnswers, wrongQuestionStats, problem, correct) {
  const area = Math.max(1, Math.min(MAX_UNIT_AREA, Number(problem?.area) || 1));
  totalAnswers[area] = (totalAnswers[area] || 0) + 1;
  if (correct) {
    correctAnswers[area] = (correctAnswers[area] || 0) + 1;
    return;
  }

  const key = getProblemKey(problem);
  const previous = wrongQuestionStats[key];
  wrongQuestionStats[key] = {
    text: problem.text,
    area,
    answers: [...(problem.options || [])],
    distractors: [...(problem.wrongAnswers || [])],
    wrongCount: (previous?.wrongCount || 0) + 1,
    lastWrongAt: Date.now()
  };

  const entries = Object.entries(wrongQuestionStats);
  if (entries.length > MAX_WRONG_QUESTIONS) {
    entries.sort((a, b) => b[1].wrongCount - a[1].wrongCount || b[1].lastWrongAt - a[1].lastWrongAt);
    Object.keys(wrongQuestionStats).forEach(itemKey => delete wrongQuestionStats[itemKey]);
    entries.slice(0, MAX_WRONG_QUESTIONS).forEach(([itemKey, item]) => {
      wrongQuestionStats[itemKey] = item;
    });
  }
}

export function getUnitAccuracy(correctAnswers, totalAnswers, labels) {
  return labels.map((label, index) => {
    const area = index + 1;
    const correct = correctAnswers[area] || 0;
    const total = totalAnswers[area] || 0;
    return { area, label, correct, total, rate: total > 0 ? Math.round((correct / total) * 100) : 0 };
  });
}

export function getFrequentWrongQuestions(wrongQuestionStats, limit = 10) {
  return Object.values(normalizeWrongQuestionStats(wrongQuestionStats))
    .sort((a, b) => b.wrongCount - a.wrongCount || b.lastWrongAt - a.lastWrongAt)
    .slice(0, limit);
}

export function buildWorksheetHtml({ playerName, curriculum, labels, questions }) {
  const safeQuestions = questions.length > 0 ? questions : [{
    text: '틀린 문제가 없습니다.', area: 1, answers: ['복습 완료'], distractors: [], wrongCount: 0
  }];
  const questionRows = safeQuestions.map((question, index) => {
    const choices = [...question.answers, ...question.distractors].slice(0, 5);
    const numberedChoices = choices.map((choice, choiceIndex) => (
      `<span class="choice"><b>${CHOICE_MARKERS[choiceIndex]}</b> ${escapeHtml(choice)}</span>`
    )).join('');
    return `<article class="question"><h2>${index + 1}. ${escapeHtml(question.text)}</h2><p class="unit">${escapeHtml(labels[question.area - 1] || '')}</p>${choices.length > 1 ? `<div class="choices"><span class="choice-label">보기:</span>${numberedChoices}</div>` : ''}<div class="answer-line"></div></article>`;
  }).join('');
  const answerRows = safeQuestions.map((question, index) => `<tr><th>${index + 1}</th><td>${escapeHtml(question.text)}</td><td>${question.answers.map((answer, answerIndex) => `${CHOICE_MARKERS[answerIndex] || ''} ${escapeHtml(answer)}`.trim()).join(', ')}</td></tr>`).join('');

  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>${escapeHtml(playerName)} 학습 보충 시험지</title><style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #171717; font-family: "Noto Sans KR", Arial, sans-serif; }
    .page { min-height: 267mm; position: relative; break-after: page; page-break-after: always; }
    .page:last-child { break-after: auto; page-break-after: auto; }
    header { border-bottom: 3px solid #222; padding-bottom: 10px; margin-bottom: 18px; }
    h1 { margin: 0 0 8px; font-size: 24px; }
    .meta { display: flex; justify-content: space-between; font-size: 13px; }
    .question { break-inside: avoid; margin: 0 0 18px; }
    .question h2 { margin: 0 0 5px; font-size: 15px; font-weight: 600; }
    .unit { margin: 0 0 5px; color: #666; font-size: 11px; }
    .choices { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 16px; margin: 5px 0; padding: 7px 10px; background: #f2f2f2; font-size: 12px; }
    .choice-label { flex: 0 0 auto; }
    .choice { display: inline-flex; gap: 4px; line-height: 1.45; }
    .choice b { font-size: 13px; }
    .answer-line { height: 24px; border-bottom: 1px solid #999; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #aaa; padding: 9px; text-align: left; }
    th { width: 38px; text-align: center; background: #eee; }
    td:last-child { width: 26%; font-weight: 700; }
  </style></head><body>
    <section class="page"><header><h1>수학 보충 학습 시험지</h1><div class="meta"><span>이름: ${escapeHtml(playerName)}</span><span>과정: ${escapeHtml(curriculum || '수학')}</span></div></header>${questionRows}</section>
    <section class="page"><header><h1>문항별 정답</h1><div class="meta"><span>${escapeHtml(playerName)}</span><span>${escapeHtml(curriculum || '수학')}</span></div></header><table><thead><tr><th>번호</th><td>문제</td><td>정답</td></tr></thead><tbody>${answerRows}</tbody></table></section>
  </body></html>`;
}

export function printLearningWorksheet(data, openWindow = window.open) {
  const printWindow = openWindow('', '_blank', 'width=900,height=1100');
  if (!printWindow) return false;
  printWindow.document.open();
  printWindow.document.write(buildWorksheetHtml(data));
  printWindow.document.close();
  printWindow.addEventListener('load', () => {
    printWindow.focus();
    printWindow.print();
  }, { once: true });
  return true;
}

export function renderLearningReport({ player, correctAnswers, totalAnswers, wrongQuestionStats, customMode }) {
  const labels = getUnitLabels(player, customMode);
  const accuracy = getUnitAccuracy(correctAnswers, totalAnswers, labels);
  const questions = getFrequentWrongQuestions(wrongQuestionStats);
  const accuracyContainer = document.getElementById('unitAccuracyList');
  const wrongContainer = document.getElementById('frequentWrongList');
  const printButton = document.getElementById('printWorksheetBtn');

  accuracyContainer.innerHTML = accuracy.map(item => `
    <div class="unit-accuracy-row">
      <span class="unit-name">${escapeHtml(item.label)}</span>
      <div class="unit-rate-track"><span style="width:${item.rate}%"></span></div>
      <strong>${item.rate}%</strong><small>${item.correct}/${item.total}</small>
    </div>`).join('');

  wrongContainer.innerHTML = questions.length > 0
    ? questions.slice(0, 5).map((question, index) => `<li><span>${index + 1}. ${escapeHtml(question.text)}</span><strong>${question.wrongCount}회</strong></li>`).join('')
    : '<li class="no-wrong-answer">기록된 오답이 없습니다.</li>';

  printButton.disabled = questions.length === 0;
  printButton.onclick = () => printLearningWorksheet({
    playerName: player.name,
    curriculum: player.curriculum || '수학 기본 과정',
    labels,
    questions
  });
}
