import { expect, test } from '@playwright/test';

const SESSION_KEY = 'math_fighter_active_session';

function createShopSession(currentStage) {
  return {
    gameState: 'shop',
    currentStage,
    stageTimer: 90,
    problemTimer: 30,
    selectedGender: 'female',
    correctAnswers: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    totalAnswers: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    combo: 0,
    player: {
      name: 'E2E Shopper',
      gender: 'female',
      level: 3,
      exp: 20,
      nextLevelExp: 169,
      hp: 100,
      baseSpeed: 3.2,
      atkMultiplier: 1,
      fireRateMultiplier: 1,
      expMultiplier: 1,
      bonusMaxHp: 0,
      bonusDefense: 0,
      bonusMagnet: 0,
      x: 640,
      y: 360
    }
  };
}

function createPlaySession(currentStage, overrides = {}) {
  const base = createShopSession(currentStage);
  return {
    ...base,
    gameState: 'play',
    ...overrides,
    currentStage,
    player: {
      ...base.player,
      ...overrides.player
    }
  };
}

async function seedSession(page, session) {
  await page.addInitScript(({ key, value }) => {
    sessionStorage.setItem(key, JSON.stringify(value));
  }, { key: SESSION_KEY, value: session });
}

async function seedShopSession(page, currentStage) {
  await seedSession(page, createShopSession(currentStage));
}

async function installAdjustableClock(page) {
  await page.addInitScript(() => {
    const realNow = Date.now.bind(Date);
    let offset = 0;
    Date.now = () => realNow() + offset;
    window.__advanceMathFighterTime = milliseconds => {
      offset += milliseconds;
    };
  });
}

test('starts a regular game and pauses and resumes', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('#startScreen')).toBeVisible();
  await page.locator('#playerNameInput').fill('E2E Player');
  await page.locator('#startGameBtn').click();

  await expect(page.locator('#gameContainer')).toBeVisible();
  await expect(page.locator('#stageNum')).toHaveText('1');
  await expect(page.locator('#problemText')).not.toHaveText('로딩 중...');

  const initialX = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)).player.x, SESSION_KEY);
  await page.keyboard.down('d');
  await page.waitForTimeout(250);
  await page.keyboard.up('d');
  await expect.poll(async () => {
    return page.evaluate(key => JSON.parse(sessionStorage.getItem(key)).player.x, SESSION_KEY);
  }).toBeGreaterThan(initialX);

  await page.reload();
  await expect(page.locator('#gameContainer')).toBeVisible();
  await expect(page.locator('#stageNum')).toHaveText('1');

  await page.keyboard.press('Escape');
  await expect(page.locator('#pauseModal')).toBeVisible();
  await page.locator('#pauseResumeBtn').click();
  await expect(page.locator('#pauseModal')).toBeHidden();
});

test('restores an active session into the shop', async ({ page }) => {
  await seedShopSession(page, 2);

  await page.goto('/');

  await expect(page.locator('#shopScreen')).toBeVisible();
  await expect(page.locator('#shopPlayerName')).toHaveText('E2E Shopper');
  await expect(page.locator('#nextStageBtn')).toBeVisible();
  await page.locator('#nextStageBtn').click();
  await expect(page.locator('#gameContainer')).toBeVisible();
  await expect(page.locator('#stageNum')).toHaveText('3');
});

test('clears a real regular stage countdown into the shop', async ({ page }) => {
  await seedSession(page, createPlaySession(1, {
    stageTimer: 1,
    player: { name: 'Stage Clear E2E' }
  }));

  await page.goto('/');
  await expect(page.locator('#gameContainer')).toBeVisible();
  await expect(page.locator('#stageNum')).toHaveText('1');

  await expect(page.locator('#shopScreen')).toBeVisible({ timeout: 8000 });
  await expect(page.locator('#shopPlayerName')).toHaveText('Stage Clear E2E');
  await expect(page.locator('#shopGoldText')).toHaveText('200');
});

test('advances from stage 9 into a boss stage', async ({ page }) => {
  await seedShopSession(page, 9);

  await page.goto('/');
  await page.locator('#nextStageBtn').click();

  await expect(page.locator('#gameContainer')).toBeVisible();
  await expect(page.locator('#stageNum')).toHaveText('10');
  await expect(page.locator('#problemTimer')).toHaveText('BOSS');
});

test('activates and fails a real stage 10 boss gimmick', async ({ page }) => {
  await installAdjustableClock(page);
  await seedSession(page, createPlaySession(10, {
    combo: 7,
    player: { name: 'Boss Gimmick E2E', hp: 100 },
    boss: {
      x: 640,
      y: 100,
      hp: 100000,
      isGimmickActive: false,
      lastGimmickTriggerTime: Date.now() - 41000
    }
  }));

  await page.goto('/');
  await expect(page.locator('#gameContainer')).toBeVisible();
  await expect(page.locator('#stageNum')).toHaveText('10');

  await expect.poll(async () => page.evaluate(key => {
    const session = JSON.parse(sessionStorage.getItem(key));
    return Boolean(session?.boss?.isGimmickActive);
  }, SESSION_KEY)).toBe(true);

  await page.evaluate(() => window.__advanceMathFighterTime(41000));

  await expect.poll(async () => page.evaluate(key => {
    const session = JSON.parse(sessionStorage.getItem(key));
    return session?.combo;
  }, SESSION_KEY)).toBe(0);

  const failedState = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)), SESSION_KEY);
  expect(failedState.player.hp).toBeLessThanOrEqual(60);
  expect(failedState.boss.isGimmickActive).toBe(false);
});

test('completes the run after stage 50', async ({ page }) => {
  await seedShopSession(page, 50);

  await page.goto('/');
  await page.locator('#nextStageBtn').click();

  await expect(page.locator('#certScreen')).toBeVisible();
  await expect(page.locator('#certStageText')).toHaveText('50 STAGE');
});

test('discards a corrupted session and keeps the start screen usable', async ({ page }) => {
  await page.addInitScript(({ key }) => {
    sessionStorage.setItem(key, '{not-json');
  }, { key: SESSION_KEY });

  await page.goto('/');

  await expect(page.locator('#startScreen')).toBeVisible();
  await expect(page.locator('#startGameBtn')).toBeEnabled();
  const hasSession = await page.evaluate(key => sessionStorage.getItem(key) !== null, SESSION_KEY);
  expect(hasSession).toBe(false);
});

test('loads a custom Padlet quiz and starts the game', async ({ page }) => {
  await page.route('**/api/fetch-padlet?**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: '<html><head><meta name="description" content="●포유류, 고래, 박쥐, 호랑이 ●조류, 참새, 독수리, 펭귄"></head></html>'
    });
  });

  await page.goto('/');
  await page.locator('#customGameBtn').click();
  await expect(page.locator('#customUrlModal')).toBeVisible();
  await page.locator('#padletUrlInput').fill('https://padlet.com/teacher/board/wish/post1');
  await page.locator('#loadCustomGameBtn').click();

  await expect(page.locator('#customUrlModal')).toBeHidden();
  await expect(page.locator('#gameContainer')).toBeVisible();
  await expect(page.locator('#problemText')).toHaveText(/포유류|조류/);

  const savedQuiz = await page.evaluate(() => JSON.parse(localStorage.getItem('math_fighter_custom_quiz_data')));
  expect(savedQuiz).toHaveLength(2);
});
