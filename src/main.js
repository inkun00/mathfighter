import { Player } from './player.js';
import { spawnMonster, restoreMonster } from './monster.js';
import { Boss } from './boss.js';
import { generateProblem, isCustomMode, setCustomQuizData, getCustomQuizData } from './mathEngine.js';
import {
  loadState, resetState, getGold, addGold,
  getEquippedWeapons, equipWeapon, recordWrongArea
} from './shop.js';
import { openBrainTrainingModal, openExamModal } from './exam.js';
import { showCertificate, saveCertificate } from './certificate.js';
import { loadCustomQuizFromPadletUrl } from './customQuiz.js';
import { createInputController } from './inputController.js';
import {
  clearActiveSession,
  createSessionSnapshot,
  loadActiveSession,
  saveActiveSession
} from './sessionManager.js';
import {
  PROBLEM_DURATION,
  REGULAR_STAGE_DURATION,
  getFinalStage,
  getStageTimers,
  isBossStage
} from './stageRules.js';
import {
  resolvePlayerProjectileUpdates,
  resolveProjectileCollisions
} from './combatResolver.js';
import { resolveDropItemPickups } from './pickupResolver.js';
import {
  resolveMonsterProjectileUpdates,
  resolveMonsterUpdates
} from './monsterResolver.js';
import { createBossGimmickProblem, resolveBossUpdate } from './bossResolver.js';
import { resolveGameTimerTick, resolveMonsterSpawns } from './gameFlow.js';
import {
  createStageClearState,
  resolveStageClearFrame
} from './stageClearResolver.js';
import {
  getNextStageTransition,
  getPlayerDeathTransition
} from './runProgress.js';
import {
  createGameUi,
  isVisibleGameplayScreen
} from './gameUi.js';
import { createGameRenderer } from './gameRenderer.js';
import { createCameraController } from './cameraController.js';
import {
  applyCurriculumToPlayer,
  getCurriculumGameQuestionBankState,
  resetCurriculumGameQuestionBank,
  restoreCurriculumGameQuestionBankState,
  restorePlayerCurriculum
} from './curriculumProblems.js';
import { recordProblemAttempt } from './learningReport.js';

let canvas, ctx;
let gameState = 'start'; // 'start', 'play', 'pause', 'levelUp', 'shop', 'exam', 'cert'
let currentStage = 1;
let selectedGender = 'male'; // 'male' or 'female' character skin
let worldWidth = 0;
let worldHeight = 0;

let player = null;
let monsters = [];
let projectiles = [];
let monsterProjectiles = [];
let dropItems = [];
let boss = null;
let isDeathHandled = false;
let usedReviewRevive = false;
let brainTrainingCompletedStages = new Set();

let lastSpawnTime = 0;
let lastSecTime = 0;
let lastSessionSaveTime = 0;

let currentProblem = null;
let problemProgress = 0;
let stageTimer = REGULAR_STAGE_DURATION; // Seconds left to survive regular stages
let problemTimer = PROBLEM_DURATION; // Seconds left for current math question
let problemSerial = 0;
let stageClearTimer = 0;
let bossDeathPos = null;

let correctAnswers = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
let totalAnswers = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
let wrongQuestionStats = {};
let combo = 0;
const inputController = createInputController({
  getGameState: () => gameState,
  onPause: () => showPauseMenu(),
  onResume: () => resumeFromPause()
});
const { keys } = inputController;

function createStageProblem(stage) {
  const problem = generateProblem(stage);
  problem.id = `stage-${stage}-${++problemSerial}`;
  return problem;
}

function createRunPlayer(name) {
  return applyCurriculumToPlayer(new Player(worldWidth / 2, worldHeight / 2, name, selectedGender),
    document.getElementById('playerGradeSelect').value);
}

function removeStaleNumberDrops() {
  dropItems = dropItems.filter(item => item.type !== 'number');
}

function handleMonsterDefeat(monster, activeProblem, showBonusText = true) {
  if (!monster || monster.goldRewarded) return;
  monster.goldRewarded = true;

  const baseBonusGold = typeof monster.getDefeatGoldBonus === 'function' ? monster.getDefeatGoldBonus() : 1;
  const bonusGold = Math.max(1, Math.ceil(baseBonusGold * 1.1));
  addGold(bonusGold);
  if (player) player.gold = getGold();
  if (showBonusText && bonusGold >= 3) {
    spawnTextParticle(monster.x, monster.y - monster.radius - 8, `+${bonusGold}G`, '#ffcc00');
  }

  monster.dropLoot(activeProblem, dropItems);
}

function initGameApp() {
  if (window.__mathFighterInitialized) return;
  window.__mathFighterInitialized = true;
  document.body.dataset.mathFighterInitialized = 'true';

  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');
  
  // Fit canvas to window size
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('beforeunload', saveSessionSnapshot);

  // Load persistence save
  loadState();

  // Bind UI buttons
  setupEventListeners();

  restoreSessionIfNeeded();

  // Start Animation Loop
  requestAnimationFrame(gameLoop);
}

function saveSessionSnapshot() {
  if (!player || gameState === 'start' || gameState === 'cert') {
    clearActiveSession();
    return;
  }

  const snapshot = createSessionSnapshot({
    gameState,
    currentStage,
    stageTimer,
    problemTimer,
    selectedGender,
    usedReviewRevive,
    brainTrainingCompletedStages: [...brainTrainingCompletedStages],
    correctAnswers,
    totalAnswers,
    wrongQuestionStats,
    curriculumQuestionBankState: getCurriculumGameQuestionBankState(),
    combo,
    customQuizData: getCustomQuizData(),
    currentProblem,
    problemProgress,
    monsters,
    boss,
    player
  });
  saveActiveSession(snapshot);
}

function restoreSessionIfNeeded() {
  const saved = loadActiveSession();
  if (!saved) return;

  try {
    selectedGender = saved.selectedGender || saved.player.gender || 'male';
    currentStage = saved.currentStage || 1;
    stageTimer = Number.isFinite(saved.stageTimer) ? saved.stageTimer : REGULAR_STAGE_DURATION;
    problemTimer = Number.isFinite(saved.problemTimer) ? saved.problemTimer : PROBLEM_DURATION;
    usedReviewRevive = Boolean(saved.usedReviewRevive);
    brainTrainingCompletedStages = new Set(Array.isArray(saved.brainTrainingCompletedStages) ? saved.brainTrainingCompletedStages : []);
    correctAnswers = saved.correctAnswers || correctAnswers;
    totalAnswers = saved.totalAnswers || totalAnswers;
    wrongQuestionStats = saved.wrongQuestionStats || {};
    combo = saved.combo || 0;

    if (saved.customQuizData) {
      setCustomQuizData(saved.customQuizData);
    }

    player = new Player(worldWidth / 2, worldHeight / 2, saved.player.name || 'Player', selectedGender);
    restorePlayerCurriculum(player, saved.player, document.getElementById('playerGradeSelect'));
    player.level = saved.player.level || 1;
    player.exp = saved.player.exp || 0;
    player.nextLevelExp = saved.player.nextLevelExp || 100;
    player.baseSpeed = saved.player.baseSpeed || player.baseSpeed;
    player.atkMultiplier = saved.player.atkMultiplier || 1;
    player.fireRateMultiplier = saved.player.fireRateMultiplier || 1;
    player.expMultiplier = saved.player.expMultiplier || 1;
    player.bonusMaxHp = saved.player.bonusMaxHp || 0;
    player.bonusDefense = saved.player.bonusDefense || 0;
    player.bonusMagnet = saved.player.bonusMagnet || 0;
    player.refreshStats();
    player.hp = Math.floor(Math.max(1, Math.min(player.maxHp, saved.player.hp || player.maxHp)));

    if (saved.gameState === 'shop') {
      restoreCurriculumGameQuestionBankState(saved.curriculumQuestionBankState);
      openShopScreen();
    } else {
      loadStage(currentStage);
      restoreCurriculumGameQuestionBankState(saved.curriculumQuestionBankState);
      
      if (saved.currentProblem) {
        currentProblem = saved.currentProblem;
        if (isCustomMode()) {
          const quizData = getCustomQuizData();
          const target = quizData ? quizData.find(q => q.name === currentProblem.targetNum) : null;
          if (target) {
            currentProblem.checkAnswer = (val) => target.items.includes(val);
          } else {
            currentProblem.checkAnswer = (val) => currentProblem.options.includes(val);
          }
        } else {
          const type = currentProblem.type;
          const targetNum = currentProblem.targetNum;
          if (type === 'divisor') {
            currentProblem.checkAnswer = (num) => targetNum % num === 0;
          } else if (type === 'multiple') {
            currentProblem.checkAnswer = (num) => num > 0 && num % targetNum === 0;
          } else if (type === 'relation') {
            currentProblem.checkAnswer = (num) => currentProblem.options.includes(num);
          } else if (type === 'gcd') {
            currentProblem.checkAnswer = (num) => num === targetNum;
          } else if (type === 'lcm') {
            currentProblem.checkAnswer = (num) => num === targetNum;
          } else if (type === 'curriculum_choice') {
            currentProblem.checkAnswer = value => currentProblem.options.includes(value);
          }
        }
      }

      if (Number.isFinite(saved.problemProgress)) {
        problemProgress = saved.problemProgress;
      }

      stageTimer = Number.isFinite(saved.stageTimer) ? saved.stageTimer : stageTimer;
      problemTimer = Number.isFinite(saved.problemTimer) ? saved.problemTimer : problemTimer;
      player.hp = Math.floor(Math.max(1, Math.min(player.maxHp, saved.player.hp || player.maxHp)));
      player.x = Math.max(player.radius, Math.min(worldWidth - player.radius, saved.player.x ?? player.x));
      player.y = Math.max(player.radius, Math.min(worldHeight - player.radius, saved.player.y ?? player.y));
      if (Array.isArray(saved.monsters) && saved.monsters.length > 0) {
        monsters = saved.monsters
          .map(snapshot => restoreMonster(snapshot, currentStage))
          .filter(Boolean);
      }
      if (saved.boss && boss) {
        boss.x = saved.boss.x || boss.x;
        boss.y = saved.boss.y || boss.y;
        boss.hp = Math.max(1, Math.min(boss.maxHp, Math.floor(saved.boss.hp || boss.hp)));
        boss.isGimmickActive = false;
        boss.lastGimmickTriggerTime = saved.boss.lastGimmickTriggerTime || Date.now();
      }
      updateHUD();
    }
  } catch (error) {
    console.warn('Failed to restore Math Fighter session', error);
    clearActiveSession();
  }
}

function hideStartScreen() {
  document.getElementById('startScreen').classList.add('hidden');
  document.getElementById('startScreen').classList.remove('active');
}

function blurActiveControl() {
  if (document.activeElement && typeof document.activeElement.blur === 'function') {
    document.activeElement.blur();
  }
}

const {
  getCameraOffset,
  isMobileBrowserViewport,
  resetCameraOffset,
  resizeCanvas
} = createCameraController({
  getCanvas: () => canvas,
  getPlayer: () => player,
  getWorldSize: () => ({ worldWidth, worldHeight }),
  setWorldSize: (width, height) => {
    worldWidth = width;
    worldHeight = height;
  }
});

const {
  draw,
  resetEffects,
  spawnFireEffect,
  spawnHitEffect,
  spawnTextParticle
} = createGameRenderer({
  getCameraOffset,
  getState: () => ({
    canvas,
    ctx,
    worldWidth,
    worldHeight,
    currentStage,
    gameState,
    player,
    monsters,
    projectiles,
    monsterProjectiles,
    dropItems,
    boss
  })
});

const {
  openShopScreen,
  renderPauseLounge,
  triggerLevelUpEnhanced,
  updateHUD
} = createGameUi({
  getState: () => ({
    player,
    currentProblem: createBossGimmickProblem(boss, currentProblem, player?.curriculum),
    boss,
    stageTimer,
    problemProgress,
    combo,
    currentStage,
    brainTrainingCompletedStages
  }),
  setGameState: nextState => {
    gameState = nextState;
  },
  blurActiveControl,
  hidePauseMenu,
  hideStartScreen,
  saveSessionSnapshot
});

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initGameApp);
} else {
  initGameApp();
}
function showPauseMenu() {
  if (gameState !== 'play' && !isVisibleGameplayScreen(player, currentProblem)) return;
  gameState = 'pause';
  inputController.reset();
  blurActiveControl();
  renderPauseLounge();
  document.getElementById('pauseModal').classList.remove('hidden');
  saveSessionSnapshot();
}

window.pauseMathFighter = showPauseMenu;

function hidePauseMenu() {
  document.getElementById('pauseModal').classList.add('hidden');
}

function resumeFromPause() {
  if (gameState !== 'pause') return;
  hidePauseMenu();
  inputController.reset();
  
  if (player) {
    player.refreshStats();
    
    const equippedWeapons = getEquippedWeapons();
    const equippedWeaponIds = equippedWeapons.map(w => w.id);
    
    equippedWeapons.forEach(w => {
      const slotKey = String(w.id);
      if (player.lastShotTimes[slotKey] === undefined) {
        player.lastShotTimes[slotKey] = 0;
      }
    });

    projectiles = projectiles.filter(p => {
      if (p.id !== undefined) {
        return equippedWeaponIds.includes(p.id);
      }
      return true;
    });
  }

  gameState = 'play';
  saveSessionSnapshot();
}

function restartFromPause() {
  if (gameState !== 'pause') return;
  blurActiveControl();
  clearActiveSession();
  hidePauseMenu();
  document.getElementById('gameContainer').classList.add('hidden');
  document.getElementById('shopScreen').classList.add('hidden');
  document.getElementById('certScreen').classList.add('hidden');
  document.getElementById('startScreen').classList.remove('hidden');
  document.getElementById('startScreen').classList.add('active');
  resetState();
  player = null;
  monsters = [];
  projectiles = [];
  monsterProjectiles = [];
  dropItems = [];
  resetEffects();
  boss = null;
  inputController.reset();
  resetCameraOffset();
  gameState = 'start';
}

function resetRunData() {
  clearActiveSession();
  resetState();
  resetCurriculumGameQuestionBank();
  correctAnswers = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  totalAnswers = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  wrongQuestionStats = {};
  combo = 0;
  currentStage = 1;
  stageTimer = REGULAR_STAGE_DURATION;
  problemTimer = PROBLEM_DURATION;
  problemSerial = 0;
  usedReviewRevive = false;
  brainTrainingCompletedStages = new Set();
  isDeathHandled = false;
  monsters = [];
  projectiles = [];
  monsterProjectiles = [];
  dropItems = [];
  resetEffects();
  boss = null;
  inputController.reset();
  resetCameraOffset();
}

function setupEventListeners() {
  document.querySelectorAll('button').forEach(button => {
    button.type = 'button';
  });
  inputController.setup();

  // Gender Selection Card Click Listeners
  const maleCard = document.getElementById('genderMaleCard');
  const femaleCard = document.getElementById('genderFemaleCard');

  function selectGenderCard(gender) {
    selectedGender = gender === 'female' ? 'female' : 'male';
    maleCard.classList.toggle('active', selectedGender === 'male');
    femaleCard.classList.toggle('active', selectedGender === 'female');
  }

  if (maleCard && femaleCard) {
    document.addEventListener('click', (e) => {
      const card = e.target.closest?.('.gender-card');
      if (!card || !card.dataset.gender) return;
      selectGenderCard(card.dataset.gender);
    }, true);

    maleCard.addEventListener('click', () => {
      selectGenderCard('male');
    });

    femaleCard.addEventListener('click', () => {
      selectGenderCard('female');
    });
  }

  // Start Screen Button
  document.getElementById('startGameBtn').addEventListener('click', () => {
    const startScreen = document.getElementById('startScreen');
    if (startScreen.classList.contains('hidden')) return;
    gameState = 'start';
    blurActiveControl();

    // Clear custom mode when starting a regular math game
    setCustomQuizData(null);

    const nameInput = document.getElementById('playerNameInput');
    const playerName = nameInput.value.trim() || "홍길동";
    
    resetRunData();

    // Init session entities with selected gender
    player = createRunPlayer(playerName);
    
    // Sync upgrades
    player.refreshStats();

    // Load first Stage
    loadStage(currentStage);
  });

  // Custom Game Button - Show URL input modal
  document.getElementById('customGameBtn').addEventListener('click', () => {
    document.getElementById('customUrlModal').classList.remove('hidden');
    document.getElementById('urlLoadError').innerText = "";

    // Fill in last saved URL if exists
    const savedUrl = localStorage.getItem('math_fighter_custom_quiz_url');
    if (savedUrl) {
      document.getElementById('padletUrlInput').value = savedUrl;
    }

    // Toggle saved game button visibility
    const savedData = localStorage.getItem('math_fighter_custom_quiz_data');
    const loadSavedBtn = document.getElementById('loadSavedCustomGameBtn');
    if (savedData && loadSavedBtn) {
      loadSavedBtn.style.display = 'block';
    } else if (loadSavedBtn) {
      loadSavedBtn.style.display = 'none';
    }
  });

  // Close Custom Game Modal
  document.getElementById('closeUrlModalBtn').addEventListener('click', () => {
    document.getElementById('customUrlModal').classList.add('hidden');
  });

  // Load Saved Custom Game Action
  document.getElementById('loadSavedCustomGameBtn').addEventListener('click', () => {
    const savedData = localStorage.getItem('math_fighter_custom_quiz_data');
    if (!savedData) return;
    try {
      const categories = JSON.parse(savedData);
      setCustomQuizData(categories);
      document.getElementById('customUrlModal').classList.add('hidden');
      
      const nameInput = document.getElementById('playerNameInput');
      const playerName = nameInput.value.trim() || "홍길동";
      
      resetRunData();
      player = createRunPlayer(playerName);
      player.refreshStats();
      loadStage(1);
    } catch (err) {
      document.getElementById('urlLoadError').innerText = "오류: 저장된 퀴즈 데이터를 불러오지 못했습니다.";
    }
  });

  // Go to Padlet Web Page
  document.getElementById('gotoPadletBtn').addEventListener('click', () => {
    window.open('https://padlet.com/inkun02/padlet-55n4tbvqcfhzoa99', '_blank');
  });

  // Load Custom Game Action
  document.getElementById('loadCustomGameBtn').addEventListener('click', async () => {
    const urlInput = document.getElementById('padletUrlInput');
    const url = urlInput.value.trim();
    const errorEl = document.getElementById('urlLoadError');
    const loadBtn = document.getElementById('loadCustomGameBtn');

    try {
      errorEl.innerText = "문제를 구성하는 중입니다...";
      loadBtn.disabled = true;

      const categories = await loadCustomQuizFromPadletUrl(url);
      setCustomQuizData(categories);

      // Save custom game data & URL to localStorage
      try {
        localStorage.setItem('math_fighter_custom_quiz_data', JSON.stringify(categories));
        localStorage.setItem('math_fighter_custom_quiz_url', url);
      } catch (saveErr) {
        console.warn("Failed to save custom quiz data to localStorage", saveErr);
      }

      document.getElementById('customUrlModal').classList.add('hidden');

      // Start custom mode game
      const nameInput = document.getElementById('playerNameInput');
      const playerName = nameInput.value.trim() || "홍길동";
      
      resetRunData();
      player = createRunPlayer(playerName);
      player.refreshStats();
      loadStage(1);

    } catch (err) {
      errorEl.innerText = `오류: ${err.message}`;
    } finally {
      loadBtn.disabled = false;
    }
  });

  // Shop navigation tabs
  document.getElementById('tabWeaponBtn').addEventListener('click', () => {
    document.getElementById('tabWeaponBtn').classList.add('active');
    document.getElementById('tabUpgradeBtn').classList.remove('active');
    document.getElementById('weaponShopList').classList.add('active-grid');
    document.getElementById('upgradeShopList').classList.remove('active-grid');
  });

  document.getElementById('tabUpgradeBtn').addEventListener('click', () => {
    document.getElementById('tabUpgradeBtn').classList.add('active');
    document.getElementById('tabWeaponBtn').classList.remove('active');
    document.getElementById('upgradeShopList').classList.add('active-grid');
    document.getElementById('weaponShopList').classList.remove('active-grid');
  });

  const brainTrainingBtn = document.getElementById('brainTrainingBtn');
  if (brainTrainingBtn) {
    brainTrainingBtn.addEventListener('click', () => {
      if (brainTrainingCompletedStages.has(currentStage)) return;
      blurActiveControl();
      openBrainTrainingModal(currentStage, (completed) => {
        if (completed) {
          brainTrainingCompletedStages.add(currentStage);
        }
        if (player) player.gold = getGold();
        openShopScreen();
      });
    });
  }

  // Next stage button
  document.getElementById('nextStageBtn').addEventListener('click', () => {
    blurActiveControl();
    document.getElementById('shopScreen').classList.add('hidden');
    const transition = getNextStageTransition(currentStage);
    currentStage = transition.currentStage;

    if (transition.destination === 'certificate') {
      openCertificateScreen();
    } else {
      loadStage(currentStage);
    }
  });

  // Certificate Actions
  document.getElementById('saveCertBtn').addEventListener('click', () => {
    saveCertificate();
  });

  document.getElementById('restartGameBtn').addEventListener('click', () => {
    if (gameState !== 'cert') return;
    blurActiveControl();
    document.getElementById('certScreen').classList.add('hidden');
    document.getElementById('startScreen').classList.remove('hidden');
    document.getElementById('startScreen').classList.add('active');
    resetRunData();
    player = null;
    gameState = 'start';
  });

  document.getElementById('pauseResumeBtn').addEventListener('click', () => {
    resumeFromPause();
  });

  document.getElementById('pauseRestartBtn').addEventListener('click', () => {
    restartFromPause();
  });
}

function loadStage(stageNum) {
  // Clear scene entities
  monsters = [];
  projectiles = [];
  monsterProjectiles = [];
  dropItems = [];
  resetEffects();
  boss = null;
  inputController.reset();
  resetCameraOffset();
  isDeathHandled = false;
  hidePauseMenu();

  player.x = worldWidth / 2;
  player.y = worldHeight / 2;
  player.refreshStats(); // Load shop purchase upgrades

  // Form new problem
  currentProblem = createStageProblem(stageNum);
  problemProgress = 0;
  combo = 0; // Reset combo count for the new stage
  const timers = getStageTimers(stageNum);
  stageTimer = timers.stageTimer;
  problemTimer = timers.problemTimer;
  lastSpawnTime = Date.now() + 1200;
  lastSecTime = Date.now();

  // Spawns 10St, 20St, 30St, 40St, 50St Boss
  if (isBossStage(stageNum)) {
    boss = new Boss(worldWidth / 2, worldHeight / 2 - 260, stageNum);
  }

  // Hide UI screens & show canvas overlay
  hideStartScreen();
  document.getElementById('shopScreen').classList.add('hidden');
  document.getElementById('gameContainer').classList.remove('hidden');
  
  // Set stage labels
  document.getElementById('stageNum').innerText = stageNum;
  updateHUD();

  gameState = 'play';
  saveSessionSnapshot();
}

function openCertificateScreen() {
  gameState = 'cert';
  clearActiveSession();
  blurActiveControl();
  hidePauseMenu();
  hideStartScreen();
  document.getElementById('gameContainer').classList.add('hidden');
  document.getElementById('shopScreen').classList.add('hidden');
  
  const finalStage = getFinalStage(currentStage);
  showCertificate(player, correctAnswers, totalAnswers, wrongQuestionStats, finalStage);
}

function handlePlayerDeath() {
  const transition = getPlayerDeathTransition({ isDeathHandled, usedReviewRevive });
  if (transition.destination === 'ignore') return;
  isDeathHandled = transition.isDeathHandled;
  usedReviewRevive = transition.usedReviewRevive;

  if (transition.destination === 'certificate') {
    if (player) player.hp = 0;
    openCertificateScreen();
    return;
  }

  // Keep existing gold/upgrades so revival rewards add onto the current wallet.
  if (player) {
    player.refreshStats();
    player.gold = getGold();
  }

  gameState = 'exam';
  hidePauseMenu();
  document.getElementById('gameContainer').classList.add('hidden');
  hideStartScreen();
  
  openExamModal(() => {
    if (player) {
      player.refreshStats();
      player.hp = Math.floor(Math.min(player.maxHp, 100));
      player.gold = getGold();
    }
    isDeathHandled = false;
    updateHUD();
    // Post exam callback: route to shop lounge
    openShopScreen();
  });
}

// 60FPS Game Loop
function gameLoop() {
  if (gameState !== 'start') {
    hideStartScreen();
  }

  if (gameState === 'play' || gameState === 'stageClear') {
    update();
    draw();
  }

  const now = Date.now();
  if (now - lastSessionSaveTime >= 1000) {
    lastSessionSaveTime = now;
    saveSessionSnapshot();
  }
  requestAnimationFrame(gameLoop);
}

// Game Physics, Collision, Timer update
function update() {
  if (gameState === 'stageClear') {
    updateStageClear();
    return;
  }

  const now = Date.now();

  const activeProblem = createBossGimmickProblem(boss, currentProblem, player?.curriculum);

  // 1. Check timer ticks (once per second).
  const timerResult = resolveGameTimerTick({
    now,
    lastSecTime,
    stageTimer,
    problemTimer,
    hasBoss: Boolean(boss)
  });
  lastSecTime = timerResult.lastSecTime;
  stageTimer = timerResult.stageTimer;
  problemTimer = timerResult.problemTimer;

  if (timerResult.ticked) {
    if (timerResult.problemExpired) {
      removeStaleNumberDrops();
      currentProblem = createStageProblem(currentStage);
      problemProgress = 0;
    }

    updateHUD();
  }

  // 2. Spawn monsters. Later stages increase spawn pace and batch size.
  const spawnResult = resolveMonsterSpawns({
    now,
    lastSpawnTime,
    stage: currentStage,
    monsters,
    createMonster: () => spawnMonster(
      worldWidth,
      worldHeight,
      player.x,
      player.y,
      currentStage
    )
  });
  lastSpawnTime = spawnResult.lastSpawnTime;

  // 3. Update Player
  keys.__mobileBrowserActive = isMobileBrowserViewport();
  player.update(keys, worldWidth, worldHeight);

  // 4. Update Auto shoot
  player.shoot(monsters, projectiles, boss && boss.hp > 0 ? boss : null, spawnFireEffect);

  // 5. Update Boss (if active)
  if (boss) {
    const bossResult = resolveBossUpdate({
      boss,
      player,
      monsterProjectiles,
      dropItems,
      onPenalty: () => recordWrongArea(activeProblem.area),
      onPlayerDeath: handlePlayerDeath
    });

    if (bossResult.comboReset) combo = 0;
    if (bossResult.playerDied) return;

    if (bossResult.bossDefeated) {
      triggerStageClear(true);
      return;
    }
  }

  // 6. Update player projectiles and remove expired entries.
  projectiles = resolvePlayerProjectileUpdates({ projectiles, monsters, player });

  // 7. Update monster projectiles and resolve player collisions.
  monsterProjectiles = resolveMonsterProjectileUpdates({
    projectiles: monsterProjectiles,
    worldWidth,
    worldHeight,
    player,
    onPlayerDeath: handlePlayerDeath
  });

  // 8. Update monsters and resolve contact damage.
  resolveMonsterUpdates({
    monsters,
    player,
    monsterProjectiles,
    now,
    onPlayerDeath: handlePlayerDeath
  });

  // 9. Update and resolve drop item pickups.
  resolveDropItemPickups({
    dropItems,
    player,
    activeProblem,
    monsters,
    combo,
    stage: currentStage,
    onLevelUp: triggerLevelUpEnhanced,
    onMonsterDefeat: monster => handleMonsterDefeat(monster, activeProblem, false),
    onNumberAnswer: (item, result) => {
      recordProblemAttempt(correctAnswers, totalAnswers, wrongQuestionStats, activeProblem, result.correct);

      if (result.correct) {
        combo = result.combo;
        addGold(result.goldReward);
        player.gold = getGold();
        spawnTextParticle(item.x, item.y, "정답! +🪙", "#39ff14");

        if (boss && boss.isGimmickActive) {
          if (boss.stage !== 30) {
            boss.gimmickAnswerCount++;
            if (boss.gimmickAnswerCount >= boss.gimmickRequiredCount) {
              boss.isGimmickActive = false;
              boss.lastGimmickTriggerTime = Date.now();
              boss.speed = boss.baseSpeed;
              spawnTextParticle(boss.x, boss.y, "기믹 해결!", "#39ff14");
            }
          }
        } else {
          problemProgress++;
          if (problemProgress >= currentProblem.requiredCount) {
            combo += 5;
            removeStaleNumberDrops();
            currentProblem = createStageProblem(currentStage);
            problemProgress = 0;
            problemTimer = PROBLEM_DURATION;
          }
        }
        return combo;
      }

      player.takeDamage(result.penaltyDamage);
      combo = result.combo;
      spawnTextParticle(item.x, item.y, `오답! HP -${result.penaltyDamage}`, "#ff007f");
      recordWrongArea(activeProblem.area);
      if (player.hp <= 0) handlePlayerDeath();
      return combo;
    }
  });

  // 10. Clean up dead entities
  dropItems = dropItems.filter(item => !item.isDead);
  
  // 11. Resolve player projectile collisions.
  resolveProjectileCollisions({
    projectiles,
    monsters,
    boss,
    now,
    onMonsterDefeat: monster => handleMonsterDefeat(monster, activeProblem),
    onHitEffect: spawnHitEffect
  });

  monsters = monsters.filter(m => m.hp > 0 || Date.now() - m.spawnTime < 1000);

  // 12. Clear regular stages after the configured survival time.
  if (!boss && !isBossStage(currentStage) && stageTimer <= 0) {
    triggerStageClear(false);
    return;
  }

  updateHUD();
}

function triggerStageClear(isBoss = false) {
  // Clear standard monsters and enemy bullets so the screen becomes clean
  monsters = [];
  monsterProjectiles = [];

  const clearState = createStageClearState({
    stage: currentStage,
    isBoss,
    boss,
    player
  });
  addGold(clearState.goldReward);
  player.gold = getGold();
  spawnTextParticle(
    clearState.textParticle.x,
    clearState.textParticle.y,
    clearState.textParticle.text,
    clearState.textParticle.color
  );
  bossDeathPos = clearState.bossDeathPos;
  stageClearTimer = clearState.stageClearTimer;
  
  gameState = 'stageClear';
  saveSessionSnapshot();
}

function updateStageClear() {
  const result = resolveStageClearFrame({
    stageClearTimer,
    bossDeathPos,
    projectiles,
    monsterProjectiles,
    dropItems,
    monsters,
    player,
    worldWidth,
    worldHeight,
    onHitEffect: spawnHitEffect,
    onTextParticle: spawnTextParticle
  });
  stageClearTimer = result.stageClearTimer;
  projectiles = result.projectiles;
  monsterProjectiles = result.monsterProjectiles;
  dropItems = result.dropItems;

  if (result.completed) {
    boss = null;
    bossDeathPos = null;
    openShopScreen();
  }
}
