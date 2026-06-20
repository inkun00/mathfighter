import { expect, test } from '@playwright/test';

const SESSION_KEY = 'math_fighter_active_session';

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

  await page.keyboard.press('Escape');
  await expect(page.locator('#pauseModal')).toBeVisible();
  await page.locator('#pauseResumeBtn').click();
  await expect(page.locator('#pauseModal')).toBeHidden();
});

test('restores an active session into the shop', async ({ page }) => {
  await page.addInitScript(({ key }) => {
    sessionStorage.setItem(key, JSON.stringify({
      gameState: 'shop',
      currentStage: 2,
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
    }));
  }, { key: SESSION_KEY });

  await page.goto('/');

  await expect(page.locator('#shopScreen')).toBeVisible();
  await expect(page.locator('#shopPlayerName')).toHaveText('E2E Shopper');
  await expect(page.locator('#nextStageBtn')).toBeVisible();
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
