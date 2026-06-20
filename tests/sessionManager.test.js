import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACTIVE_SESSION_KEY,
  SESSION_SCHEMA_VERSION,
  clearActiveSession,
  createSessionSnapshot,
  loadActiveSession,
  saveActiveSession
} from '../src/sessionManager.js';

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
    has: key => values.has(key)
  };
}

function createPlayer() {
  return {
    name: 'Session Tester',
    gender: 'female',
    level: 3,
    exp: 20,
    nextLevelExp: 169,
    hp: 87.9,
    baseSpeed: 3.2,
    atkMultiplier: 1.1,
    fireRateMultiplier: 1.2,
    expMultiplier: 1,
    bonusMaxHp: 10,
    bonusDefense: 2,
    bonusMagnet: 15,
    x: 100.6,
    y: 200.4
  };
}

test('createSessionSnapshot produces a bounded serializable snapshot', () => {
  const monsters = Array.from({ length: 305 }, (_, index) => ({
    templateId: `monster-${index}`,
    name: `Monster ${index}`,
    x: index + 0.6,
    y: index + 0.4,
    hp: index === 0 ? 0 : 10.9,
    direction: 'down',
    facing: 1,
    goldRewarded: false
  }));

  const snapshot = createSessionSnapshot({
    gameState: 'stageClear',
    currentStage: 4,
    stageTimer: 12,
    problemTimer: 20,
    selectedGender: 'female',
    usedReviewRevive: false,
    brainTrainingCompletedStages: new Set([1, 2]),
    correctAnswers: { 1: 2 },
    totalAnswers: { 1: 3 },
    combo: 5,
    customQuizData: null,
    currentProblem: {
      area: 1,
      text: '12의 약수',
      targetNum: 12,
      type: 'divisor',
      options: [1, 2, 3, 4, 6, 12],
      requiredCount: 3,
      checkAnswer: () => true
    },
    problemProgress: 1,
    monsters,
    boss: null,
    player: createPlayer()
  });

  assert.equal(snapshot.schemaVersion, SESSION_SCHEMA_VERSION);
  assert.equal(snapshot.gameState, 'shop');
  assert.equal(snapshot.monsters.length, 300);
  assert.equal(snapshot.monsters[0].templateId, 'monster-1');
  assert.equal(snapshot.player.hp, 87);
  assert.equal(snapshot.player.x, 101);
  assert.equal('checkAnswer' in snapshot.currentProblem, false);
  assert.doesNotThrow(() => JSON.stringify(snapshot));
});

test('save and load accept legacy sessions and normalize defaults', () => {
  const storage = createStorage();
  const legacySession = {
    gameState: 'play',
    currentStage: '2',
    player: createPlayer()
  };

  assert.equal(saveActiveSession(legacySession, storage), true);
  const loaded = loadActiveSession(storage);

  assert.equal(loaded.schemaVersion, SESSION_SCHEMA_VERSION);
  assert.equal(loaded.currentStage, 2);
  assert.equal(loaded.stageTimer, 90);
  assert.equal(loaded.problemTimer, 30);
  assert.deepEqual(loaded.monsters, []);
  assert.deepEqual(loaded.correctAnswers, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
});

test('load removes corrupted or unsupported sessions', () => {
  const corruptedStorage = createStorage({ [ACTIVE_SESSION_KEY]: '{not-json' });
  const unsupportedStorage = createStorage({
    [ACTIVE_SESSION_KEY]: JSON.stringify({
      schemaVersion: SESSION_SCHEMA_VERSION + 1,
      gameState: 'play',
      currentStage: 1,
      player: createPlayer()
    })
  });

  assert.equal(loadActiveSession(corruptedStorage), null);
  assert.equal(corruptedStorage.has(ACTIVE_SESSION_KEY), false);
  assert.equal(loadActiveSession(unsupportedStorage), null);
  assert.equal(unsupportedStorage.has(ACTIVE_SESSION_KEY), false);
});

test('clearActiveSession removes the current snapshot', () => {
  const storage = createStorage({ [ACTIVE_SESSION_KEY]: '{}' });
  clearActiveSession(storage);
  assert.equal(storage.has(ACTIVE_SESSION_KEY), false);
});
