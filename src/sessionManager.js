export const ACTIVE_SESSION_KEY = 'math_fighter_active_session';
export const SESSION_SCHEMA_VERSION = 1;

const RESTORABLE_STATES = new Set(['play', 'pause', 'levelUp', 'shop', 'exam']);
const MAX_SAVED_MONSTERS = 300;

function getStorage(storage) {
  return storage || globalThis.sessionStorage;
}

function normalizeStats(stats) {
  const fallback = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  if (!stats || typeof stats !== 'object') return fallback;
  return { ...fallback, ...stats };
}

function normalizeSession(parsed) {
  if (!parsed || typeof parsed !== 'object' || !parsed.player) return null;
  if (parsed.schemaVersion && parsed.schemaVersion !== SESSION_SCHEMA_VERSION) return null;
  if (!RESTORABLE_STATES.has(parsed.gameState)) return null;

  const currentStage = Number(parsed.currentStage);
  if (!Number.isFinite(currentStage) || currentStage < 1 || currentStage > 50) return null;

  return {
    ...parsed,
    schemaVersion: SESSION_SCHEMA_VERSION,
    currentStage: Math.floor(currentStage),
    stageTimer: Number.isFinite(parsed.stageTimer) ? parsed.stageTimer : 90,
    problemTimer: Number.isFinite(parsed.problemTimer) ? parsed.problemTimer : 30,
    brainTrainingCompletedStages: Array.isArray(parsed.brainTrainingCompletedStages)
      ? parsed.brainTrainingCompletedStages
      : [],
    correctAnswers: normalizeStats(parsed.correctAnswers),
    totalAnswers: normalizeStats(parsed.totalAnswers),
    combo: Number.isFinite(parsed.combo) ? parsed.combo : 0,
    problemProgress: Number.isFinite(parsed.problemProgress) ? parsed.problemProgress : 0,
    monsters: Array.isArray(parsed.monsters) ? parsed.monsters.slice(0, MAX_SAVED_MONSTERS) : []
  };
}

export function createSessionSnapshot({
  gameState,
  currentStage,
  stageTimer,
  problemTimer,
  selectedGender,
  usedReviewRevive,
  brainTrainingCompletedStages,
  correctAnswers,
  totalAnswers,
  combo,
  customQuizData,
  currentProblem,
  problemProgress,
  monsters,
  boss,
  player
}) {
  return {
    schemaVersion: SESSION_SCHEMA_VERSION,
    savedAt: Date.now(),
    gameState: gameState === 'stageClear' ? 'shop' : gameState,
    currentStage,
    stageTimer,
    problemTimer,
    selectedGender,
    usedReviewRevive,
    brainTrainingCompletedStages: [...brainTrainingCompletedStages],
    correctAnswers,
    totalAnswers,
    combo,
    customQuizData,
    currentProblem: currentProblem ? {
      area: currentProblem.area,
      text: currentProblem.text,
      targetNum: currentProblem.targetNum,
      type: currentProblem.type,
      options: currentProblem.options,
      wrongAnswers: currentProblem.wrongAnswers,
      requiredCount: currentProblem.requiredCount
    } : null,
    problemProgress,
    monsters: monsters
      .filter(monster => monster.hp > 0)
      .slice(0, MAX_SAVED_MONSTERS)
      .map(monster => ({
        templateId: monster.templateId,
        name: monster.name,
        x: Math.round(monster.x),
        y: Math.round(monster.y),
        hp: Math.floor(monster.hp),
        direction: monster.direction,
        facing: monster.facing,
        goldRewarded: Boolean(monster.goldRewarded)
      })),
    boss: boss && boss.hp > 0 ? {
      x: Math.round(boss.x),
      y: Math.round(boss.y),
      hp: Math.floor(boss.hp),
      isGimmickActive: Boolean(boss.isGimmickActive),
      lastGimmickTriggerTime: boss.lastGimmickTriggerTime
    } : null,
    player: {
      name: player.name,
      gender: player.gender,
      level: player.level,
      exp: player.exp,
      nextLevelExp: player.nextLevelExp,
      hp: Math.floor(player.hp),
      baseSpeed: player.baseSpeed,
      atkMultiplier: player.atkMultiplier,
      fireRateMultiplier: player.fireRateMultiplier,
      expMultiplier: player.expMultiplier,
      bonusMaxHp: player.bonusMaxHp,
      bonusDefense: player.bonusDefense,
      bonusMagnet: player.bonusMagnet,
      x: Math.round(player.x),
      y: Math.round(player.y)
    }
  };
}

export function saveActiveSession(snapshot, storage) {
  try {
    getStorage(storage).setItem(ACTIVE_SESSION_KEY, JSON.stringify(snapshot));
    return true;
  } catch (error) {
    console.warn('Failed to save Math Fighter session', error);
    return false;
  }
}

export function loadActiveSession(storage) {
  const targetStorage = getStorage(storage);
  const raw = targetStorage.getItem(ACTIVE_SESSION_KEY);
  if (!raw) return null;

  try {
    const session = normalizeSession(JSON.parse(raw));
    if (session) return session;
  } catch {
    console.warn('Discarded an invalid Math Fighter session.');
  }

  targetStorage.removeItem(ACTIVE_SESSION_KEY);
  return null;
}

export function clearActiveSession(storage) {
  getStorage(storage).removeItem(ACTIVE_SESSION_KEY);
}
