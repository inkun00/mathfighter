import { generateBrainTrainingQuestions, getSimilarQuestions, isCustomMode } from './mathEngine.js';
import { getWrongAreas, addGold, clearWrongAreas } from './shop.js';

let currentQuestions = [];
let brainTrainingQuestions = [];

function renderQuestionList(listContainer, questions, inputPrefix = 'question') {
  listContainer.innerHTML = '';

  questions.forEach((q, idx) => {
    const qDiv = document.createElement('div');
    qDiv.className = 'exam-item';

    const title = document.createElement('p');
    title.className = 'exam-q';
    title.innerText = `Q${idx + 1}. ${q.text}`;
    qDiv.appendChild(title);

    if (q.options && q.options.length > 0) {
      const optionsContainer = document.createElement('div');
      optionsContainer.className = 'exam-options';

      q.options.forEach(opt => {
        const label = document.createElement('label');
        label.className = 'exam-opt';

        const input = document.createElement('input');
        input.type = 'radio';
        input.name = `${inputPrefix}-${q.id}`;
        input.value = opt;

        label.appendChild(input);
        label.appendChild(document.createTextNode(` ${opt}`));
        optionsContainer.appendChild(label);
      });
      qDiv.appendChild(optionsContainer);
    } else {
      const input = document.createElement('input');
      input.type = isCustomMode() ? 'text' : 'number';
      input.className = 'exam-input-text';
      input.name = `${inputPrefix}-${q.id}`;
      input.placeholder = '답 입력';
      qDiv.appendChild(input);
    }

    listContainer.appendChild(qDiv);
  });
}

// Renders the review exam paper modal
export function openExamModal(onCloseCallback) {
  const modal = document.getElementById('examModal');
  const listContainer = document.getElementById('examQuestionList');
  const submitBtn = document.getElementById('submitExamBtn');

  const wrongAreas = getWrongAreas();
  currentQuestions = getSimilarQuestions(wrongAreas);
  renderQuestionList(listContainer, currentQuestions);

  submitBtn.onclick = () => {
    evaluateAnswers(onCloseCallback);
  };

  modal.classList.remove('hidden');
}

function getQuestionAnswer(q, inputPrefix = 'question') {
  if (q.options && q.options.length > 0) {
    const selected = document.querySelector(`input[name="${inputPrefix}-${q.id}"]:checked`);
    return selected ? selected.value : '';
  }

  const input = document.querySelector(`input[name="${inputPrefix}-${q.id}"]`);
  return input ? input.value.trim() : '';
}

// Grades the exam and calculates the gold bonus
function evaluateAnswers(onCloseCallback) {
  let correctCount = 0;
  const totalQuestions = currentQuestions.length;

  if (totalQuestions === 0) {
    closeExam(onCloseCallback);
    return;
  }

  currentQuestions.forEach(q => {
    const userAns = getQuestionAnswer(q);
    const isMultipleChoice = q.options && q.options.length > 0;
    if (isMultipleChoice) {
      if (userAns === q.answer) {
        correctCount++;
      }
    } else {
      if (isCustomMode()) {
        const cleanUser = userAns.replace(/\s+/g, '').toLowerCase();
        const answers = q.answers || [q.answer];
        const isCorrect = answers.some(ans => {
          const cleanAns = ans.replace(/\s+/g, '').toLowerCase();
          return cleanUser !== '' && cleanUser === cleanAns;
        });
        if (isCorrect) {
          correctCount++;
        }
      } else {
        const cleanUser = userAns.replace(/[^0-9-]/g, '');
        const cleanAns = q.answer.replace(/[^0-9-]/g, '');
        if (cleanUser !== '' && parseInt(cleanUser, 10) === parseInt(cleanAns, 10)) {
          correctCount++;
        }
      }
    }
  });

  const accuracy = (correctCount / totalQuestions) * 100;
  let bonusGold = 0;

  if (accuracy === 100) bonusGold = 1000;
  else if (accuracy >= 70) bonusGold = 600;
  else if (accuracy >= 50) bonusGold = 300;

  if (bonusGold > 0) {
    addGold(bonusGold);
  }

  alert(`[ 채점 결과 ]\n정답 개수: ${correctCount}/${totalQuestions} (${Math.round(accuracy)}%)\n보너스 ${bonusGold} 골드가 지급되었습니다!`);

  clearWrongAreas();
  closeExam(onCloseCallback);
}

function closeExam(onCloseCallback) {
  const modal = document.getElementById('examModal');
  modal.classList.add('hidden');
  if (onCloseCallback) onCloseCallback();
}

export function openBrainTrainingModal(stage, onCloseCallback) {
  const modal = document.getElementById('brainTrainingModal');
  const listContainer = document.getElementById('brainTrainingQuestionList');
  const submitBtn = document.getElementById('submitBrainTrainingBtn');
  const closeBtn = document.getElementById('closeBrainTrainingBtn');

  // Update description text dynamically to match the stage-based gold reward
  const desc = document.getElementById('brainTrainingDesc');
  const perfectBonusGold = Math.max(1, stage) * 1000;
  if (desc) {
    desc.textContent = `대기실에서 도전하는 추가 주관식 문제입니다. 한 문제당 300골드, 3문제를 모두 맞히면 총 ${perfectBonusGold.toLocaleString()}골드를 획득합니다.`;
  }

  brainTrainingQuestions = generateBrainTrainingQuestions(stage);
  renderQuestionList(listContainer, brainTrainingQuestions, 'brain-question');

  submitBtn.onclick = () => {
    evaluateBrainTraining(stage, onCloseCallback);
  };
  closeBtn.onclick = () => {
    closeBrainTraining(onCloseCallback, false);
  };

  modal.classList.remove('hidden');
}

function evaluateBrainTraining(stage, onCloseCallback) {
  let correctCount = 0;

  brainTrainingQuestions.forEach(q => {
    const userAns = getQuestionAnswer(q, 'brain-question');
    if (isCustomMode()) {
      const cleanUser = userAns.replace(/\s+/g, '').toLowerCase();
      const answers = q.answers || [q.answer];
      const isCorrect = answers.some(ans => {
        const cleanAns = ans.replace(/\s+/g, '').toLowerCase();
        return cleanUser !== '' && cleanUser === cleanAns;
      });
      if (isCorrect) {
        correctCount++;
      }
    } else {
      const cleanUser = userAns.replace(/[^0-9-]/g, '');
      const cleanAns = q.answer.replace(/[^0-9-]/g, '');
      if (cleanUser !== '' && parseInt(cleanUser, 10) === parseInt(cleanAns, 10)) {
        correctCount++;
      }
    }
  });

  const perfectBonusGold = Math.max(1, stage) * 1000;
  const bonusGold = correctCount === brainTrainingQuestions.length ? perfectBonusGold : correctCount * 300;
  if (bonusGold > 0) {
    addGold(bonusGold);
  }

  alert(`[ 특공대원 두뇌 강화 결과 ]\n정답 개수: ${correctCount}/${brainTrainingQuestions.length}\n보상 골드: ${bonusGold}G`);
  closeBrainTraining(onCloseCallback, true);
}

function closeBrainTraining(onCloseCallback, completed) {
  const modal = document.getElementById('brainTrainingModal');
  modal.classList.add('hidden');
  if (onCloseCallback) onCloseCallback(completed);
}
