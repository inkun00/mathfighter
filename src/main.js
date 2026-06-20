import { Player } from './player.js';
import { spawnMonster, restoreMonster } from './monster.js';
import { Boss } from './boss.js';
import { generateProblem, isCustomMode, setCustomQuizData, getCustomQuizData } from './mathEngine.js';
import {
  loadState, resetState, getGold, addGold, 
  getEquippedWeapons, WEAPONS_DB, UPGRADES_DB, 
  getUpgradeCost, getUpgradeLevel, purchaseUpgrade, purchaseWeapon, getOwnedWeapons, equipWeapon,
  recordWrongArea, getStatValue, getWeaponLevel, getWeaponUpgradeCost, getWeaponUpgradeSummary, upgradeWeapon
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
  getNextStageProgress,
  getStageClearFrames,
  getStageClearLabel,
  getStageClearReward,
  getStageEnemyPressure,
  getStageTimers,
  isBossStage
} from './stageRules.js';
import { resolveProjectileCollisions } from './combatResolver.js';
import { resolveDropItemPickups } from './pickupResolver.js';
import {
  resolveMonsterProjectileUpdates,
  resolveMonsterUpdates
} from './monsterResolver.js';
import { createBossGimmickProblem, resolveBossUpdate } from './bossResolver.js';

// Game variables
let canvas, ctx;
let gameState = 'start'; // 'start', 'play', 'pause', 'levelUp', 'shop', 'exam', 'cert'
let currentStage = 1;
let selectedGender = 'male'; // 'male' or 'female' character skin
const ARENA_SCALE = 2;
let worldWidth = 0;
let worldHeight = 0;

let player = null;
let monsters = [];
let projectiles = [];
let monsterProjectiles = [];
let dropItems = [];
let hitEffects = [];
let boss = null;
let isDeathHandled = false;
let usedReviewRevive = false;
let brainTrainingCompletedStages = new Set();

let lastSpawnTime = 0;
let lastSecTime = 0;
let lastSessionSaveTime = 0;
let cameraOffset = { x: 0, y: 0, initialized: false };

let currentProblem = null;
let problemProgress = 0;
let stageTimer = REGULAR_STAGE_DURATION; // Seconds left to survive regular stages
let problemTimer = PROBLEM_DURATION; // Seconds left for current math question
let problemSerial = 0;
let stageClearTimer = 0;
let bossDeathPos = null;

const STAGE_BACKGROUNDS = [
  { minStage: 40, src: '/assets/backgrounds/stage_40_cosmic.png' },
  { minStage: 30, src: '/assets/backgrounds/stage_30_forge.png' },
  { minStage: 20, src: '/assets/backgrounds/stage_20_ruins.png' },
  { minStage: 10, src: '/assets/backgrounds/stage_10_cavern.png' },
  { minStage: 1, src: '/assets/backgrounds/stage_01_academy.png' }
].map(background => {
  const image = new Image();
  image.src = background.src;
  return { ...background, image, pattern: null };
});

// Evaluation performance stats (indexed by math area 1~5)
let correctAnswers = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
let totalAnswers = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
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

function isMobileBrowserViewport() {
  return window.matchMedia?.('(pointer: coarse)').matches || window.innerWidth <= 760;
}

function getStageBackground(stage) {
  return STAGE_BACKGROUNDS.find(background => stage >= background.minStage) || STAGE_BACKGROUNDS[STAGE_BACKGROUNDS.length - 1];
}

function drawStageBackground(camera) {
  ctx.fillStyle = '#080312';
  ctx.fillRect(0, 0, worldWidth, worldHeight);

  const background = getStageBackground(currentStage);
  if (!background?.image?.complete || background.image.naturalWidth === 0) return;

  if (!background.pattern) {
    background.pattern = ctx.createPattern(background.image, 'repeat');
  }
  if (!background.pattern) return;

  ctx.save();
  ctx.globalAlpha = 0.72;
  ctx.fillStyle = background.pattern;
  ctx.fillRect(0, 0, worldWidth, worldHeight);

  const gradient = ctx.createRadialGradient(
    camera.x + canvas.width / 2,
    camera.y + canvas.height / 2,
    Math.min(canvas.width, canvas.height) * 0.25,
    camera.x + canvas.width / 2,
    camera.y + canvas.height / 2,
    Math.max(canvas.width, canvas.height) * 0.9
  );
  gradient.addColorStop(0, 'rgba(8, 3, 18, 0.04)');
  gradient.addColorStop(1, 'rgba(2, 0, 8, 0.45)');
  ctx.fillStyle = gradient;
  ctx.fillRect(camera.x, camera.y, canvas.width, canvas.height);
  ctx.restore();
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

// Init setup on window load. If the module is evaluated after DOMContentLoaded,
// run immediately so start-screen controls are always bound.
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initGameApp);
} else {
  initGameApp();
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
    combo = saved.combo || 0;

    if (saved.customQuizData) {
      setCustomQuizData(saved.customQuizData);
    }

    player = new Player(worldWidth / 2, worldHeight / 2, saved.player.name || 'Player', selectedGender);
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
      openShopScreen();
    } else {
      loadStage(currentStage);
      
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

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  worldWidth = canvas.width * ARENA_SCALE;
  worldHeight = canvas.height * ARENA_SCALE;
  cameraOffset.initialized = false;
}

function getTargetCameraOffset() {
  if (!player) return { x: 0, y: 0 };

  return {
    x: Math.max(0, Math.min(worldWidth - canvas.width, player.x - canvas.width / 2)),
    y: Math.max(0, Math.min(worldHeight - canvas.height, player.y - canvas.height / 2))
  };
}

function getCameraOffset() {
  const target = getTargetCameraOffset();
  if (!cameraOffset.initialized) {
    cameraOffset = { ...target, initialized: true };
    return target;
  }

  const smoothing = isMobileBrowserViewport() ? 0.12 : 1;
  cameraOffset.x += (target.x - cameraOffset.x) * smoothing;
  cameraOffset.y += (target.y - cameraOffset.y) * smoothing;

  return {
    x: Math.max(0, Math.min(worldWidth - canvas.width, cameraOffset.x)),
    y: Math.max(0, Math.min(worldHeight - canvas.height, cameraOffset.y))
  };
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

function resetCameraOffset() {
  cameraOffset = { x: 0, y: 0, initialized: false };
}

function isVisibleGameplayScreen() {
  const gameContainer = document.getElementById('gameContainer');
  const levelUpModal = document.getElementById('levelUpModal');
  const pauseModal = document.getElementById('pauseModal');
  return Boolean(
    player &&
    currentProblem &&
    gameContainer &&
    !gameContainer.classList.contains('hidden') &&
    (!levelUpModal || levelUpModal.classList.contains('hidden')) &&
    (!pauseModal || pauseModal.classList.contains('hidden'))
  );
}

function renderPauseLounge() {
  if (!player) return;

  // 1. Stats Rendering
  const stats = getCurrentStatSummary();
  const statsContainer = document.getElementById('pausePlayerStats');
  if (statsContainer) {
    statsContainer.innerHTML = `
      <div class="status-row"><span>최대 HP</span><strong>${stats.maxHp}</strong></div>
      <div class="status-row"><span>방어력</span><strong>${stats.defense}</strong></div>
      <div class="status-row"><span>공격 보너스</span><strong>+${stats.attackBonus}%</strong></div>
      <div class="status-row"><span>연사 보너스</span><strong>+${stats.fireRate}%</strong></div>
      <div class="status-row"><span>자석 범위</span><strong>${stats.magnet}</strong></div>
      <div class="status-row"><span>골드 보너스</span><strong>+${stats.goldBonus}%</strong></div>
      <div class="status-row"><span>무기 총 피해</span><strong>${stats.weaponDamage}</strong></div>
      <div class="status-row"><span>초당 화력</span><strong>${stats.weaponDps}</strong></div>
    `;
  }

  // 2. Weapon Change Rendering
  const weaponList = document.getElementById('pauseWeaponList');
  if (weaponList) {
    weaponList.innerHTML = "";
    const ownedWeapons = getOwnedWeapons();
    const equippedWeapons = getEquippedWeapons();
    const equippedWeaponIds = equippedWeapons.map(w => w.id);

    WEAPONS_DB.forEach(w => {
      // Only show owned weapons in the pause screen
      if (!ownedWeapons.includes(w.id)) return;

      const isEquipped = equippedWeaponIds.includes(w.id);
      const card = document.createElement('div');
      card.className = `pause-weapon-card ${isEquipped ? 'equipped' : ''}`;

      let actionBtn = "";
      if (isEquipped) {
        const canUnequip = equippedWeaponIds.length > 1;
        actionBtn = `<button class="buy-btn pause-weapon-btn equip-toggle-btn" data-id="${w.id}" ${canUnequip ? '' : 'disabled'}>장착 해제</button>`;
      } else {
        const label = equippedWeaponIds.length >= 3 ? '교체 장착' : '장착하기';
        actionBtn = `<button class="buy-btn pause-weapon-btn equip-toggle-btn" data-id="${w.id}">${label}</button>`;
      }

      card.innerHTML = `
        <div class="pause-weapon-card-header">
          <img class="pause-weapon-card-icon" src="/assets/weapons/weapon_${String(w.id).padStart(2, '0')}.png" alt="${w.name}">
          <h4>${w.name}</h4>
        </div>
        <p class="pause-weapon-desc">피해: ${w.dmg} / 범위: ${getWeaponRangeLabel(w.id, w.type)}</p>
        ${actionBtn}
      `;

      weaponList.appendChild(card);
    });

    // 3. Bind equip action click listeners
    weaponList.querySelectorAll('.equip-toggle-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = parseInt(e.currentTarget.dataset.id);
        if (equipWeapon(id)) {
          // Re-render immediately
          renderPauseLounge();
          // Update HUD to show the new weapon status
          updateHUD();
          // Save session changes immediately
          saveSessionSnapshot();
        }
      });
    });
  }
}

function showPauseMenu() {
  if (gameState !== 'play' && !isVisibleGameplayScreen()) return;
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
  hitEffects = [];
  boss = null;
  inputController.reset();
  resetCameraOffset();
  gameState = 'start';
}

function resetRunData() {
  clearActiveSession();
  resetState();
  correctAnswers = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  totalAnswers = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
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
  hitEffects = [];
  boss = null;
  inputController.reset();
  resetCameraOffset();
}

// Bind all UI button clicks and key listeners
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
    player = new Player(worldWidth / 2, worldHeight / 2, playerName, selectedGender);
    
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
      player = new Player(worldWidth / 2, worldHeight / 2, playerName, selectedGender);
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
      player = new Player(worldWidth / 2, worldHeight / 2, playerName, selectedGender);
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
    const progress = getNextStageProgress(currentStage);
    currentStage = progress.nextStage;

    if (progress.completed) {
      // Game fully completed! Show Certificate
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

// Prepare next level stage and start playing
function loadStage(stageNum) {
  // Clear scene entities
  monsters = [];
  projectiles = [];
  monsterProjectiles = [];
  dropItems = [];
  hitEffects = [];
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

function updateHUD() {
  if (!player || !currentProblem) return;

  // Render problem text
  document.getElementById('problemText').innerText = currentProblem.text;
  document.getElementById('problemTimer').innerText = boss ? 'BOSS' : stageTimer;

  // Gauge Progress
  const gaugePercent = (problemProgress / currentProblem.requiredCount) * 100;
  document.getElementById('problemGauge').style.width = `${Math.min(100, gaugePercent)}%`;

  // EXP & HP Gauges
  const expPercent = (player.exp / player.nextLevelExp) * 100;
  document.getElementById('expBar').style.width = `${Math.min(100, expPercent)}%`;
  document.getElementById('levelText').innerText = `LV.${player.level}`;

  player.hp = Math.floor(Math.min(player.maxHp, Math.max(0, player.hp)));
  const hpPercent = (player.hp / player.maxHp) * 100;
  document.getElementById('hpBar').style.width = `${Math.max(0, hpPercent)}%`;
  document.getElementById('hpText').innerText = `HP: ${Math.floor(player.hp)}/${Math.floor(player.maxHp)}`;

  player.gold = getGold();
  document.getElementById('goldText').innerText = player.gold;
  document.getElementById('comboText').innerText = `${combo} COMBO`;

  document.getElementById('debug-weapon-status')?.remove();
}

// Setup and show Level up choice cards
function triggerLevelUp() {
  gameState = 'levelUp';
  document.getElementById('levelUpModal').classList.remove('hidden');

  const container = document.getElementById('skillCardContainer');
  container.innerHTML = "";

  // 3 choices (1 weapon upgrade + 2 passives)
  const choices = [
    { name: "무기 화력 강화", desc: "이 세션 동안 현재 무기 공격력이 10% 상승합니다.", icon: "🔥", type: "weapon" },
    { name: "이동 가속 부스터", desc: "캐릭터의 이동 스피드가 15% 상승합니다.", icon: "👟", type: "speed" },
    { name: "자철석 자석 보강", desc: "보석과 아이템의 흡수 범위를 30px 늘립니다.", icon: "🧲", type: "magnet" }
  ];

  choices.forEach(c => {
    const card = document.createElement('div');
    card.className = "skill-card";
    
    card.innerHTML = `
      <span class="skill-icon">${c.icon}</span>
      <div class="skill-info">
        <h4>${c.name}</h4>
        <p>${c.desc}</p>
      </div>
    `;

    card.addEventListener('click', () => {
      applyLevelUpChoice(c);
      document.getElementById('levelUpModal').classList.add('hidden');
      gameState = 'play';
    });

    container.appendChild(card);
  });
}

function applyLevelUpChoice(choice) {
  if (choice.type === 'weapon') {
    // Current weapon damage boost (lasts for this stage)
    player.atkMultiplier = (player.atkMultiplier || 1) + 0.1;
  } else if (choice.type === 'speed') {
    player.baseSpeed += 0.5;
  } else if (choice.type === 'magnet') {
    player.magnetRange += 30;
  }
  updateHUD();
}

function triggerLevelUpEnhanced() {
  gameState = 'levelUp';
  document.getElementById('levelUpModal').classList.remove('hidden');

  const container = document.getElementById('skillCardContainer');
  container.innerHTML = "";

  getLevelUpChoices().forEach(choice => {
    const card = document.createElement('div');
    card.className = "skill-card";
    card.innerHTML = `
      <span class="skill-icon">${choice.icon}</span>
      <div class="skill-info">
        <h4>${choice.name}</h4>
        <p>${choice.desc}</p>
      </div>
    `;

    card.addEventListener('click', () => {
      applyEnhancedLevelUpChoice(choice);
      document.getElementById('levelUpModal').classList.add('hidden');
      gameState = 'play';
    });

    container.appendChild(card);
  });
}

function getLevelUpChoices() {
  const skillPool = [
    { name: "무기 화력 강화", desc: "모든 무기 피해량이 12% 증가합니다.", icon: "⚔️", type: "attack" },
    { name: "연사력 향상", desc: "자동 공격 간격이 12% 짧아집니다.", icon: "⚡", type: "fireRate" },
    { name: "방어력 향상", desc: "받는 피해를 줄이는 방어력이 3 증가합니다.", icon: "🛡️", type: "defense" },
    { name: "최대 체력 강화", desc: "최대 HP가 20 증가하고 즉시 20 회복합니다.", icon: "❤️", type: "maxHp" },
    { name: "이동 속도 향상", desc: "이동 속도가 10% 증가합니다.", icon: "👟", type: "speed" },
    { name: "자석 범위 확장", desc: "숫자와 보석을 끌어오는 범위가 35 증가합니다.", icon: "🧲", type: "magnet" },
    { name: "학습 집중력", desc: "경험치 획득량이 15% 증가합니다.", icon: "📘", type: "exp" },
    { name: "체력 향상", desc: "전체 체력이 10%증가합니다.", icon: "❤️", type: "hpPercent" }
  ];

  return skillPool.sort(() => Math.random() - 0.5).slice(0, 3);
}

function applyEnhancedLevelUpChoice(choice) {
  if (choice.type === 'attack') {
    player.atkMultiplier *= 1.12;
  } else if (choice.type === 'fireRate') {
    player.fireRateMultiplier *= 1.12;
  } else if (choice.type === 'defense') {
    player.bonusDefense += 3;
    player.refreshStats();
  } else if (choice.type === 'maxHp') {
    player.bonusMaxHp += 20;
    player.refreshStats();
    player.heal(20);
  } else if (choice.type === 'speed') {
    player.baseSpeed *= 1.1;
  } else if (choice.type === 'magnet') {
    player.bonusMagnet += 35;
    player.refreshStats();
  } else if (choice.type === 'exp') {
    player.expMultiplier *= 1.15;
  } else if (choice.type === 'hpPercent') {
    const increase = Math.max(1, Math.floor(player.maxHp * 0.1));
    player.bonusMaxHp += increase;
    player.refreshStats();
  }

  updateHUD();
}

function getWeaponFireStyleLabel(id, type) {
  if (id === 13) return '\uD654\uBA74 \uAD00\uD1B5 \uB808\uC774\uC800';
  if ([4, 20].includes(id)) return '왕복형';
  if ([6, 17, 22].includes(id)) return '투척 화염형';
  if (id === 8) return '부채꼴 폭발형';
  if ([3, 12, 19, 27, 28, 30].includes(id)) return '다중 발사형';
  if (id === 14) return '지뢰 설치형';
  if (id === 16) return '회전 궤도형';
  if ([5, 7, 13, 24, 26, 29].includes(id) || type === 'pierce') return '관통형';
  if ([2, 9, 15, 23, 25].includes(id) || type === 'homing') return '유도형';
  if ([8, 11, 21].includes(id) || type === 'splash') return '충돌 폭발형';
  return '직선 발사형';
}

function getWeaponRangeLabel(id, type) {
  if (id === 13) return '\uD654\uBA74 \uB05D';
  if ([6, 8, 11, 14, 17, 21, 22, 29, 30].includes(id) || type === 'splash') return '짧음';
  if ([3, 12, 16, 19, 27, 28].includes(id)) return '중간';
  return '김';
}

function getWeaponDps(weapon) {
  return Math.round((getWeaponDisplayDamage(weapon) * 1000) / Math.max(1, weapon.cooldown));
}

function getWeaponDisplayDamage(weapon) {
  const level = getWeaponLevel(weapon.id);
  return Math.round(weapon.dmg * (1 + (level - 1) * 0.1));
}

function getCurrentStatSummary() {
  const equippedWeapons = getEquippedWeapons();
  const weaponDamage = equippedWeapons.reduce((sum, weapon) => sum + getWeaponDisplayDamage(weapon), 0);
  const weaponDps = equippedWeapons.reduce((sum, weapon) => sum + getWeaponDps(weapon), 0);

  return {
    maxHp: player ? Math.floor(player.maxHp) : 100 + getStatValue('maxHp'),
    defense: player ? Math.floor(player.defense) : getStatValue('def'),
    attackBonus: Math.round(getStatValue('atk') + (((player?.atkMultiplier || 1) - 1) * 100)),
    magnet: player ? Math.floor(player.magnetRange) : 50 + getStatValue('magnet'),
    goldBonus: Math.round(getStatValue('goldBonus') * 100),
    fireRate: Math.round(((player?.fireRateMultiplier || 1) - 1) * 100),
    weaponDamage,
    weaponDps,
    equippedWeapons
  };
}

function renderShopStatusPanel() {
  const panel = document.getElementById('playerStatusPanel');
  if (!panel || !player) return;

  const stats = getCurrentStatSummary();
  const preview = document.getElementById('shopPlayerPreview');
  preview.classList.toggle('female', player.gender === 'female');
  document.getElementById('shopPlayerName').textContent = player.name || 'PLAYER';

  document.getElementById('shopPlayerStats').innerHTML = `
    <div class="status-section-title">능력치</div>
    <div class="status-row"><span>최대 HP</span><strong>${stats.maxHp}</strong></div>
    <div class="status-row"><span>방어력</span><strong>${stats.defense}</strong></div>
    <div class="status-row"><span>공격 보너스</span><strong>+${stats.attackBonus}%</strong></div>
    <div class="status-row"><span>연사 보너스</span><strong>+${stats.fireRate}%</strong></div>
    <div class="status-row"><span>자석 범위</span><strong>${stats.magnet}</strong></div>
    <div class="status-row"><span>골드 보너스</span><strong>+${stats.goldBonus}%</strong></div>
    <div class="status-row"><span>무기 총 피해</span><strong>${stats.weaponDamage}</strong></div>
    <div class="status-row"><span>초당 화력</span><strong>${stats.weaponDps}</strong></div>
  `;

  document.getElementById('shopEquippedWeapons').innerHTML = `
    <div class="status-section-title">장착 무기</div>
    ${stats.equippedWeapons.map((weapon, index) => `
      <div class="equipped-weapon-row">
        <span>${index + 1}. ${weapon.name} LV.${getWeaponLevel(weapon.id)}</span>
        <strong>${getWeaponDisplayDamage(weapon)}</strong>
      </div>
    `).join('') || '<div class="equipped-weapon-row"><span>없음</span><strong>-</strong></div>'}
  `;
}

function getWeaponChangeText(weapon, isOwned, isEquipped, equippedWeaponIds) {
  const equippedWeapons = getEquippedWeapons();
  const currentDamage = equippedWeapons.reduce((sum, item) => sum + getWeaponDisplayDamage(item), 0);
  const currentDps = equippedWeapons.reduce((sum, item) => sum + getWeaponDps(item), 0);
  let nextWeapons = [...equippedWeapons];

  if (!isOwned) {
    if (!nextWeapons.some(item => item.id === weapon.id)) {
      if (nextWeapons.length < 3) nextWeapons.push(weapon);
      else nextWeapons[2] = weapon;
    }
  } else if (isEquipped) {
    if (nextWeapons.length > 1) nextWeapons = nextWeapons.filter(item => item.id !== weapon.id);
  } else if (nextWeapons.length < 3) {
    nextWeapons.push(weapon);
  } else {
    nextWeapons[2] = weapon;
  }

  const nextDamage = nextWeapons.reduce((sum, item) => sum + getWeaponDisplayDamage(item), 0);
  const nextDps = nextWeapons.reduce((sum, item) => sum + getWeaponDps(item), 0);
  const deltaDamage = nextDamage - currentDamage;
  const deltaDps = nextDps - currentDps;
  const signDamage = deltaDamage >= 0 ? '+' : '';
  const signDps = deltaDps >= 0 ? '+' : '';

  if (isEquipped && equippedWeaponIds.length <= 1) return '최소 1개 장착 필요';
  return `변화: 피해 ${signDamage}${deltaDamage}, 초당 화력 ${signDps}${deltaDps}`;
}

function getWeaponUpgradeEffectText(weapon, summary) {
  const nextLevel = Math.min(summary.maxLevel, summary.level + 1);
  const nextBonus = nextLevel - 1;
  const parts = [`공격력 +${nextBonus * 10}%`];

  if (['hit', 'pierce', 'homing'].includes(weapon.type)) {
    parts.push(`크기 +${nextBonus * 6}%`);
  }
  if ([3, 8, 11, 12, 18, 19, 21, 27, 28, 30].includes(weapon.id)) {
    parts.push(`발사체 +${Math.floor(nextBonus / 3)}`);
  }
  if (weapon.type === 'splash' || [6, 8, 11, 12, 15, 17, 21, 22, 25, 27, 30].includes(weapon.id)) {
    parts.push(`범위 +${nextBonus * 8}%`);
  }

  return parts.join(', ');
}

function getUpgradeChangeText(upgrade, isMax) {
  if (isMax) return '변화: 최대 강화 완료';
  if (upgrade.key === 'maxHp') return `변화: 최대 HP +${upgrade.statAdd}`;
  if (upgrade.key === 'atk') return `변화: 공격 보너스 +${upgrade.statAdd}%`;
  if (upgrade.key === 'def') return `변화: 방어력 +${upgrade.statAdd}`;
  if (upgrade.key === 'magnet') return `변화: 자석 범위 +${upgrade.statAdd}`;
  if (upgrade.key === 'goldBonus') return `변화: 골드 보너스 +${Math.round(upgrade.statAdd * 100)}%`;
  return `변화: +${upgrade.statAdd}`;
}

// Renders the shop lounge lobby
function openShopScreen() {
  gameState = 'shop';
  blurActiveControl();
  hidePauseMenu();
  hideStartScreen();
  document.getElementById('gameContainer').classList.add('hidden');
  document.getElementById('shopScreen').classList.remove('hidden');

  document.getElementById('shopGoldText').innerText = getGold();
  renderShopStatusPanel();

  const brainTrainingBtn = document.getElementById('brainTrainingBtn');
  const brainTrainingDone = brainTrainingCompletedStages.has(currentStage);
  brainTrainingBtn.disabled = brainTrainingDone;
  brainTrainingBtn.textContent = brainTrainingDone ? '두뇌 강화 완료' : '특공대원 두뇌 강화';

  // Render Weapons Shop
  const weaponList = document.getElementById('weaponShopList');
  weaponList.innerHTML = "";
  
  const ownedWeapons = getOwnedWeapons();
  const equippedWeapons = getEquippedWeapons();
  const equippedWeaponIds = equippedWeapons.map(w => w.id);

  WEAPONS_DB.forEach(w => {
    const card = document.createElement('div');
    const isOwned = ownedWeapons.includes(w.id);
    const isEquipped = equippedWeaponIds.includes(w.id);
    const weaponLevel = getWeaponLevel(w.id);
    const upgradeSummary = getWeaponUpgradeSummary(w.id);
    const weaponUpgradeCost = getWeaponUpgradeCost(w.id);
    const isWeaponMax = weaponLevel >= upgradeSummary.maxLevel;
    const canUpgradeWeapon = isOwned && !isWeaponMax && getGold() >= weaponUpgradeCost;
    card.className = `shop-card ${isOwned ? 'purchased' : ''}`;

    let actionBtn = "";
    if (isEquipped) {
      const canUnequip = equippedWeaponIds.length > 1;
      actionBtn = `<button class="buy-btn equip-action-btn" data-id="${w.id}" ${canUnequip ? '' : 'disabled'}>${canUnequip ? '장착 해제' : '장착중'}</button>`;
    } else if (isOwned) {
      const label = equippedWeaponIds.length >= 3 ? '교체 장착' : '장착하기';
      actionBtn = `<button class="buy-btn equip-action-btn" data-id="${w.id}">${label}</button>`;
    } else {
      const isAffordable = getGold() >= w.price;
      actionBtn = `<button class="buy-btn buy-action-btn" data-id="${w.id}" ${isAffordable ? '' : 'disabled'}>구매 (🪙 ${w.price})</button>`;
    }

    card.innerHTML = `
      <div class="card-header">
        <img class="weapon-card-icon" src="/assets/weapons/weapon_${String(w.id).padStart(2, '0')}.png" alt="${w.name}" loading="lazy">
        <div class="card-title">
          <h3>${w.name}</h3>
          <span class="card-type ${w.type}">${w.type.toUpperCase()} · LV.${weaponLevel}/10</span>
        </div>
      </div>
      <p class="card-desc">${w.desc}</p>
      <div class="card-price-row">
        <span class="price">피해량: ${w.dmg}</span>
        ${actionBtn}
      </div>
    `;
    if (isOwned) {
      card.insertAdjacentHTML('beforeend', `
        <div class="weapon-upgrade-row">
          <span class="weapon-upgrade-info">${isWeaponMax ? '강화 MAX' : `강화비 ${weaponUpgradeCost}G`}</span>
          <button class="buy-btn weapon-upgrade-action-btn" data-id="${w.id}" ${canUpgradeWeapon ? '' : 'disabled'}>
            ${isWeaponMax ? 'MAX' : '무기 강화'}
          </button>
        </div>
        <div class="weapon-upgrade-effect">${isWeaponMax ? '최대 강화 완료' : getWeaponUpgradeEffectText(w, upgradeSummary)}</div>
      `);
    }
    card.querySelector('.price').textContent = isEquipped
      ? `장착 슬롯 ${equippedWeaponIds.indexOf(w.id) + 1}/3`
      : `피해량 ${w.dmg}`;
    card.querySelector('.card-desc').textContent = `${w.desc} 발사 방식: ${getWeaponFireStyleLabel(w.id, w.type)} / 사정거리: ${getWeaponRangeLabel(w.id, w.type)}`;
    card.insertAdjacentHTML('beforeend', `<div class="change-row"><span>${getWeaponChangeText(w, isOwned, isEquipped, equippedWeaponIds)}</span></div>`);

    weaponList.appendChild(card);
  });

  // Render Stat Upgrade Shop
  const upgradeList = document.getElementById('upgradeShopList');
  upgradeList.innerHTML = "";

  UPGRADES_DB.forEach(u => {
    const card = document.createElement('div');
    const lvl = getUpgradeLevel(u.key);
    const cost = getUpgradeCost(u.key);
    const isMax = lvl >= u.maxLevel;
    const isAffordable = getGold() >= cost && !isMax;

    card.className = "shop-card";
    card.innerHTML = `
      <div class="card-header">
        <span class="card-icon">${u.symbol}</span>
        <div class="card-title">
          <h3>${u.name}</h3>
          <span class="card-type homing">LV. ${lvl}/${u.maxLevel}</span>
        </div>
      </div>
      <p class="card-desc">${u.desc}</p>
      <div class="card-price-row">
        <span class="price">${isMax ? 'MAX' : `비용: 🪙 ${cost}`}</span>
        <button class="buy-btn upgrade-action-btn" data-key="${u.key}" ${isAffordable ? '' : 'disabled'}>
          ${isMax ? '강화 완료' : '강화하기'}
        </button>
      </div>
    `;
    card.insertAdjacentHTML('beforeend', `<div class="change-row"><span>${getUpgradeChangeText(u, isMax)}</span></div>`);

    upgradeList.appendChild(card);
  });

  // Bind click logic for dynamically created buttons
  document.querySelectorAll('.buy-action-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = parseInt(e.currentTarget.dataset.id);
      if (purchaseWeapon(id)) {
        player.gold = getGold();
        openShopScreen(); // refresh
      }
    });
  });

  document.querySelectorAll('.equip-action-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = parseInt(e.currentTarget.dataset.id);
      if (equipWeapon(id)) {
        player.gold = getGold();
        openShopScreen();
      }
    });
  });

  document.querySelectorAll('.weapon-upgrade-action-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = parseInt(e.currentTarget.dataset.id);
      if (upgradeWeapon(id)) {
        player.gold = getGold();
        openShopScreen();
      }
    });
  });

  document.querySelectorAll('.upgrade-action-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const key = e.currentTarget.dataset.key;
      if (purchaseUpgrade(key)) {
        player.refreshStats(); // Sync upgrade stats
        player.gold = getGold();
        openShopScreen();
      }
    });
  });

  saveSessionSnapshot();
}

// Renders the cert report screen
function openCertificateScreen() {
  gameState = 'cert';
  clearActiveSession();
  blurActiveControl();
  hidePauseMenu();
  hideStartScreen();
  document.getElementById('gameContainer').classList.add('hidden');
  document.getElementById('shopScreen').classList.add('hidden');
  
  const finalStage = getFinalStage(currentStage);
  showCertificate(player, correctAnswers, totalAnswers, finalStage);
}

// triggers review paper after death
function handlePlayerDeath() {
  if (isDeathHandled) return;
  isDeathHandled = true;

  if (usedReviewRevive) {
    if (player) player.hp = 0;
    openCertificateScreen();
    return;
  }

  usedReviewRevive = true;

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

  const activeProblem = createBossGimmickProblem(boss, currentProblem);

  // 1. Check timer ticks (once per second)
  if (now - lastSecTime >= 1000) {
    lastSecTime = now;
    if (!boss) {
      stageTimer--;
    }
    problemTimer--;

    if (problemTimer <= 0) {
      removeStaleNumberDrops();
      currentProblem = createStageProblem(currentStage);
      problemTimer = PROBLEM_DURATION;
      problemProgress = 0;
    }

    updateHUD();
  }

  // 2. Spawn monsters. Later stages increase spawn pace and batch size.
  const enemyPressure = getStageEnemyPressure(currentStage);
  if (now - lastSpawnTime >= enemyPressure.spawnRate) {
    const spawnCount = enemyPressure.spawnBatch;
    for (let i = 0; i < spawnCount; i++) {
      monsters.push(spawnMonster(worldWidth, worldHeight, player.x, player.y, currentStage));
    }
    lastSpawnTime = now;
  }

  // 3. Update Player
  keys.__mobileBrowserActive = isMobileBrowserViewport();
  player.update(keys, worldWidth, worldHeight);

  // 4. Update Auto shoot
  player.shoot(monsters, projectiles, boss && boss.hp > 0 ? boss : null);

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

  // 6. Update Projectiles
  projectiles.forEach(p => p.update(monsters, { x: player.x, y: player.y }));
  projectiles = projectiles.filter(p => !p.isDead);

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
      totalAnswers[activeProblem.area]++;

      if (result.correct) {
        combo = result.combo;
        correctAnswers[activeProblem.area]++;
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

  // 12. Clear regular stages after surviving for 90 seconds.
  if (!boss && !isBossStage(currentStage) && stageTimer <= 0) {
    triggerStageClear(false);
    return;
  }

  updateHUD();
}

// Particle list for floating damage texts
let textParticles = [];

function spawnTextParticle(x, y, text, color) {
  textParticles.push({
    x, y, text, color,
    alpha: 1.0,
    life: 30
  });
}

function spawnHitEffect(x, y, projectile, scale = 1) {
  if (!projectile) return;
  const tier = projectile.id >= 21 ? 3 : projectile.id >= 11 ? 2 : 1;
  const isAreaHit = projectile.splashRadius > 0 || ['explosive', 'mine', 'throw_fire', 'fire_patch'].includes(projectile.behavior);
  const color = tier === 3 ? '#ffcc00' : tier === 2 ? '#ff3df2' : '#00ffff';
  const sparkCount = Math.round((tier === 3 ? 18 : tier === 2 ? 12 : 6) * scale);
  const radius = (tier === 3 ? 62 : tier === 2 ? 42 : 24) * (isAreaHit ? 1.25 : 1) * scale;

  hitEffects.push({
    x,
    y,
    color,
    radius,
    sparkCount,
    tier,
    isAreaHit,
    createdTime: Date.now(),
    lifeTime: tier === 3 ? 520 : tier === 2 ? 420 : 260,
    angleSeed: Math.random() * Math.PI * 2
  });

  if (hitEffects.length > 80) hitEffects.splice(0, hitEffects.length - 80);
}

function drawHitEffects() {
  const now = Date.now();
  hitEffects.forEach(effect => {
    const progress = Math.min(1, (now - effect.createdTime) / effect.lifeTime);
    const alpha = 1 - progress;
    const ringRadius = effect.radius * (0.35 + progress * 0.9);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(effect.x, effect.y);

    ctx.strokeStyle = effect.color;
    ctx.lineWidth = Math.max(2, effect.tier * 1.6);
    ctx.shadowColor = effect.color;
    ctx.shadowBlur = effect.tier >= 2 ? 16 : 8;
    ctx.beginPath();
    ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    if (effect.isAreaHit || effect.tier >= 2) {
      ctx.globalAlpha = alpha * 0.35;
      ctx.fillStyle = effect.color;
      ctx.beginPath();
      ctx.arc(0, 0, ringRadius * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < effect.sparkCount; i++) {
      const angle = effect.angleSeed + (Math.PI * 2 * i) / effect.sparkCount;
      const distance = effect.radius * (0.25 + progress * (0.65 + (i % 3) * 0.12));
      const size = effect.tier + 1 + (i % 2);
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * distance, Math.sin(angle) * distance, size, 0, Math.PI * 2);
      ctx.fill();
    }

    if (effect.tier === 3) {
      ctx.globalAlpha = alpha * 0.9;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const angle = effect.angleSeed + i * (Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * ringRadius * 0.2, Math.sin(angle) * ringRadius * 0.2);
        ctx.lineTo(Math.cos(angle) * ringRadius * 1.2, Math.sin(angle) * ringRadius * 1.2);
        ctx.stroke();
      }
    }

    ctx.restore();
  });

  hitEffects = hitEffects.filter(effect => now - effect.createdTime < effect.lifeTime);
}

// Renders Canvas frame
function draw() {
  ctx.fillStyle = '#080312'; // Black spacer void
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const camera = getCameraOffset();
  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  drawStageBackground(camera);

  // Draw grid pattern for map floor
  ctx.strokeStyle = 'rgba(170, 70, 255, 0.09)';
  ctx.lineWidth = 1;
  const gridSize = 40;
  const startX = Math.floor(camera.x / gridSize) * gridSize;
  const endX = Math.min(worldWidth, camera.x + canvas.width + gridSize);
  const startY = Math.floor(camera.y / gridSize) * gridSize;
  const endY = Math.min(worldHeight, camera.y + canvas.height + gridSize);

  for (let x = startX; x <= endX; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, worldHeight);
    ctx.stroke();
  }
  for (let y = startY; y <= endY; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(worldWidth, y);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(0, 255, 255, 0.28)';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, worldWidth - 4, worldHeight - 4);

  // Draw Drop Items
  dropItems.forEach(item => item.draw(ctx));

  // Draw Projectiles
  projectiles.forEach(p => p.draw(ctx));

  // Draw Monster Projectiles
  monsterProjectiles.forEach(mp => mp.draw(ctx));

  // Draw Monsters
  monsters.forEach(m => {
    if (m.hp > 0) m.draw(ctx);
  });

  // Draw Player
  if (player) player.draw(ctx);

  // Draw Boss
  if (boss) boss.draw(ctx);

  // Render weapon hit effects above actors
  drawHitEffects();

  // Render floating text particles
  textParticles.forEach((tp, idx) => {
    tp.y -= 1.0;
    tp.alpha -= 0.035;
    ctx.fillStyle = tp.color;
    ctx.globalAlpha = Math.max(0, tp.alpha);
    ctx.font = 'bold 12px "Press Start 2P"';
    ctx.fillText(tp.text, tp.x, tp.y);
  });
  textParticles = textParticles.filter(tp => tp.alpha > 0);
  ctx.restore();

  if (gameState === 'stageClear') {
    drawStageClearBanner();
  }
}

function triggerStageClear(isBoss = false) {
  // Clear standard monsters and enemy bullets so the screen becomes clean
  monsters = [];
  monsterProjectiles = [];

  if (isBoss && boss) {
    const goldReward = getStageClearReward(currentStage, true);
    addGold(goldReward);
    player.gold = getGold();
    spawnTextParticle(boss.x, boss.y - 40, `BOSS DEFEATED! +${goldReward}G`, '#ffd700');
    
    bossDeathPos = { x: boss.x, y: boss.y };
    stageClearTimer = getStageClearFrames(true);
  } else {
    const goldReward = getStageClearReward(currentStage, false);
    addGold(goldReward);
    player.gold = getGold();
    spawnTextParticle(player.x, player.y - 30, `STAGE SURVIVED! +${goldReward}G`, '#39ff14');
    
    bossDeathPos = null;
    stageClearTimer = getStageClearFrames(false);
  }
  
  gameState = 'stageClear';
  saveSessionSnapshot();
}

function updateStageClear() {
  stageClearTimer--;

  // Update projectiles, items, hit effects
  projectiles.forEach(p => p.update(monsters, { x: player.x, y: player.y }));
  projectiles = projectiles.filter(p => !p.isDead);

  monsterProjectiles = resolveMonsterProjectileUpdates({
    projectiles: monsterProjectiles,
    worldWidth,
    worldHeight
  });

  dropItems.forEach(item => item.update({ x: player.x, y: player.y }, player.magnetRange));
  dropItems = dropItems.filter(item => !item.isDead);

  // If boss died, spawn continuous massive explosions at bossDeathPos
  if (bossDeathPos && stageClearTimer > 30) {
    if (stageClearTimer % 6 === 0) {
      const rx = bossDeathPos.x + (Math.random() - 0.5) * 160;
      const ry = bossDeathPos.y + (Math.random() - 0.5) * 160;
      const mockProj = { id: 22, splashRadius: 100, behavior: 'explosive' };
      spawnHitEffect(rx, ry, mockProj, 1.8);

      if (stageClearTimer % 12 === 0) {
        const textOption = ["BOOM!", "CRASH!", "KABOOM!", "DESTROYED!"][Math.floor(Math.random() * 4)];
        spawnTextParticle(rx, ry, textOption, "#ff3300");
      }
    }
  }

  if (stageClearTimer <= 0) {
    boss = null;
    bossDeathPos = null;
    openShopScreen();
  }
}

function drawStageClearBanner() {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  ctx.save();

  // 1. Draw dark backdrop
  ctx.fillStyle = 'rgba(8, 3, 18, 0.65)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. Draw retro container box
  const boxW = Math.min(520, canvas.width * 0.85);
  const boxH = 150;

  ctx.fillStyle = 'rgba(26, 0, 51, 0.88)';
  ctx.strokeStyle = '#00ffff';
  ctx.lineWidth = 4;
  ctx.shadowColor = '#00ffff';
  ctx.shadowBlur = 18;

  ctx.fillRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH);
  ctx.strokeRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH);

  // Draw inner gold trim line
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 2;
  ctx.strokeRect(cx - boxW / 2 + 6, cy - boxH / 2 + 6, boxW - 12, boxH - 12);

  // 3. Draw Stage Clear Text
  const scale = 1.0 + Math.sin(Date.now() * 0.01) * 0.04; // idle pulsing

  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Neon Green text for STAGE CLEAR
  ctx.fillStyle = '#39ff14';
  ctx.shadowColor = '#39ff14';
  ctx.shadowBlur = 12;
  ctx.font = 'bold 36px "Press Start 2P", sans-serif';
  ctx.fillText("STAGE CLEAR!", 0, -22);

  // Golden text for stage indicator
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 16px "Press Start 2P", sans-serif';
  const stageType = getStageClearLabel(currentStage);
  ctx.fillText(`STAGE ${currentStage} - ${stageType}`, 0, 26);

  // Small loading hint
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText("대기실 상점으로 이동 중...", 0, 52);

  ctx.restore();
}
