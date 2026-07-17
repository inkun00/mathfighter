import { loadCustomQuizFromPadletUrl } from './customQuiz.js';

const QUIZ_DATA_KEY = 'math_fighter_custom_quiz_data';
const QUIZ_URL_KEY = 'math_fighter_custom_quiz_url';

function getPlayerName() {
  return document.getElementById('playerNameInput').value.trim() || '홍길동';
}

export function setupCustomGameControls({ onStart }) {
  const modal = document.getElementById('customUrlModal');
  const errorElement = document.getElementById('urlLoadError');
  const loadButton = document.getElementById('loadCustomGameBtn');
  const savedButton = document.getElementById('loadSavedCustomGameBtn');
  const urlInput = document.getElementById('padletUrlInput');

  document.getElementById('customGameBtn').addEventListener('click', () => {
    modal.classList.remove('hidden');
    errorElement.textContent = '';
    urlInput.value = localStorage.getItem(QUIZ_URL_KEY) || '';
    savedButton.style.display = localStorage.getItem(QUIZ_DATA_KEY) ? 'block' : 'none';
  });

  document.getElementById('closeUrlModalBtn').addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  savedButton.addEventListener('click', () => {
    const savedData = localStorage.getItem(QUIZ_DATA_KEY);
    if (!savedData) return;
    try {
      onStart(JSON.parse(savedData), getPlayerName());
      modal.classList.add('hidden');
    } catch {
      errorElement.textContent = '오류: 저장된 퀴즈 데이터를 불러오지 못했습니다.';
    }
  });

  document.getElementById('gotoPadletBtn').addEventListener('click', () => {
    window.open('https://padlet.com/inkun02/padlet-55n4tbvqcfhzoa99', '_blank');
  });

  loadButton.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    try {
      errorElement.textContent = '문제를 구성하는 중입니다...';
      loadButton.disabled = true;
      const categories = await loadCustomQuizFromPadletUrl(url);
      try {
        localStorage.setItem(QUIZ_DATA_KEY, JSON.stringify(categories));
        localStorage.setItem(QUIZ_URL_KEY, url);
      } catch (storageError) {
        console.warn('Failed to save custom quiz data to localStorage', storageError);
      }
      onStart(categories, getPlayerName());
      modal.classList.add('hidden');
    } catch (error) {
      errorElement.textContent = `오류: ${error.message}`;
    } finally {
      loadButton.disabled = false;
    }
  });
}
