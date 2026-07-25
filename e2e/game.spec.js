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
  await page.locator('#playerGradeSelect').selectOption('4-1');
  await expect(page.locator('#playerGradeSelect')).toHaveValue('4-1');
  await page.locator('#startGameBtn').click();

  await expect(page.locator('#gameContainer')).toBeVisible();
  await expect.poll(() => page.evaluate(key => JSON.parse(sessionStorage.getItem(key)).player.curriculum, SESSION_KEY)).toBe('4-1');
  await expect.poll(() => page.evaluate(key => JSON.parse(sessionStorage.getItem(key)).currentProblem.type, SESSION_KEY)).toBe('curriculum_choice');
  await expect.poll(() => page.evaluate(async key => {
    const session = JSON.parse(sessionStorage.getItem(key));
    const { GRADE_FOUR_SEMESTER_ONE_QUESTION_BANK } = await import('/src/grade4Semester1QuestionBank.js');
    return GRADE_FOUR_SEMESTER_ONE_QUESTION_BANK.some(question => question.text === session.currentProblem.text);
  }, SESSION_KEY)).toBe(true);
  const remainingQuestionIds = await page.evaluate(
    key => JSON.parse(sessionStorage.getItem(key)).curriculumQuestionBankState.remainingQuestionIds,
    SESSION_KEY
  );
  expect(remainingQuestionIds).toHaveLength(99);
  await expect(page.locator('#stageNum')).toHaveText('1');
  await expect(page.locator('#problemText')).not.toHaveText('로딩 중...');

  const initialX = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)).player.x, SESSION_KEY);
  await page.keyboard.down('d');
  await page.waitForTimeout(250);
  await page.keyboard.up('d');
  await expect.poll(async () => {
    return page.evaluate(key => JSON.parse(sessionStorage.getItem(key)).player.x, SESSION_KEY);
  }, { timeout: 7000 }).toBeGreaterThan(initialX);

  await page.reload();
  await expect(page.locator('#gameContainer')).toBeVisible();
  await expect(page.locator('#stageNum')).toHaveText('1');
  await expect.poll(() => page.evaluate(
    key => JSON.parse(sessionStorage.getItem(key)).curriculumQuestionBankState.remainingQuestionIds,
    SESSION_KEY
  )).toEqual(remainingQuestionIds);

  await page.keyboard.press('Escape');
  await expect(page.locator('#pauseModal')).toBeVisible();
  await page.locator('#pauseResumeBtn').click();
  await expect(page.locator('#pauseModal')).toBeHidden();
});

test('shop test mode grants full purchase funds while keeping weapons unowned', async ({ page }) => {
  await page.goto('/?debug=true&shopTest=true');

  const initialState = await page.evaluate(() => ({
    gold: window.gameStateStore.gold,
    ownedWeaponIds: window.gameStateStore.ownedWeaponIds,
    equippedWeaponIds: window.gameStateStore.equippedWeaponIds
  }));
  expect(initialState.gold).toBe(1e25);
  expect(initialState.ownedWeaponIds).toEqual([1]);
  expect(initialState.equippedWeaponIds).toEqual([1]);

  await page.locator('#playerNameInput').fill('Shop Tester');
  await page.locator('#startGameBtn').click();
  await expect(page.locator('#goldText')).toHaveText('10000000000000000000000000');

  const purchaseResult = await page.evaluate(async () => {
    const shop = await import('/src/shop.js');
    return {
      purchased: shop.purchaseWeapon(30),
      owned: shop.getOwnedWeapons().includes(30),
      remainingGold: shop.getGold()
    };
  });
  expect(purchaseResult.purchased).toBe(true);
  expect(purchaseResult.owned).toBe(true);
  expect(purchaseResult.remainingGold).toBeGreaterThan(1e24);
});

test('batches rapid combat gold rewards into one browser storage write', async ({ page }) => {
  await page.goto('/');
  const writes = await page.evaluate(async () => {
    const shop = await import('/src/shop.js');
    const originalSetItem = Storage.prototype.setItem;
    let saveWrites = 0;
    Storage.prototype.setItem = function setItem(key, value) {
      if (key === 'math_fighter_save') saveWrites++;
      return originalSetItem.call(this, key, value);
    };

    for (let index = 0; index < 50; index++) shop.addGold(1);
    const immediate = saveWrites;
    await new Promise(resolve => setTimeout(resolve, 260));
    const afterBatch = saveWrites;
    Storage.prototype.setItem = originalSetItem;
    return { immediate, afterBatch };
  });

  expect(writes.immediate).toBe(0);
  expect(writes.afterBatch).toBe(1);
});

test('opens the certificate registration board from the start screen', async ({ page, context }) => {
  await context.route('https://samboard.vivasam.com/**', route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><title>Certificate board</title>'
  }));
  await page.goto('/');

  const popupPromise = page.waitForEvent('popup');
  await page.locator('#registerCertificateBtn').click();
  const popup = await popupPromise;
  await popup.waitForLoadState('domcontentloaded');

  expect(popup.url()).toBe('https://samboard.vivasam.com/studentEntry/?brdId=brd-0QR3C3WJN6RYH');
  await popup.close();
});

test('creates a floating analog joystick at the mobile touch position', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('#playerNameInput').fill('Mobile Player');
  await page.locator('#startGameBtn').click();
  await expect(page.locator('#gameContainer')).toBeVisible();

  const canvas = page.locator('#gameCanvas');
  const control = page.locator('#mobileMoveControl');
  await canvas.dispatchEvent('pointerdown', {
    pointerId: 17,
    pointerType: 'touch',
    clientX: 210,
    clientY: 500,
    bubbles: true
  });

  await expect(control).toHaveClass(/active/);
  await expect(control).toHaveCSS('left', '210px');
  await expect(control).toHaveCSS('top', '500px');

  await canvas.dispatchEvent('pointermove', {
    pointerId: 17,
    pointerType: 'touch',
    clientX: 272,
    clientY: 531,
    bubbles: true
  });
  const knobTransform = await page.locator('#mobileStickKnob').evaluate(element => element.style.transform);
  expect(knobTransform).toContain('px');
  expect(knobTransform).not.toContain('+ 0px');

  await canvas.dispatchEvent('pointerup', {
    pointerId: 17,
    pointerType: 'touch',
    clientX: 272,
    clientY: 531,
    bubbles: true
  });
  await expect(control).not.toHaveClass(/active/);
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

test('keeps the shop profile sprite square in a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await seedShopSession(page, 2);
  await page.goto('/');

  const preview = page.locator('#shopPlayerPreview');
  const box = await preview.boundingBox();
  const typography = await page.locator('#shopPlayerStats .status-row').first().evaluate(element => ({
    lineHeight: getComputedStyle(element).lineHeight,
    listGap: getComputedStyle(element.parentElement).rowGap
  }));

  expect(box.width).toBe(132);
  expect(box.height).toBe(132);
  expect(typography.lineHeight).toBe('14.82px');
  expect(typography.listGap).toBe('6.65px');
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
    player: {
      name: 'Boss Gimmick E2E',
      hp: 100,
      grade: 4,
      curriculum: '4-1'
    },
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
  await expect(page.locator('#problemText')).not.toContainText('36의 약수');

  await page.evaluate(() => window.__advanceMathFighterTime(41000));

  await expect.poll(async () => page.evaluate(key => {
    const session = JSON.parse(sessionStorage.getItem(key));
    return session?.combo;
  }, SESSION_KEY)).toBe(0);

  const failedState = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)), SESSION_KEY);
  expect(failedState.player.hp).toBeLessThanOrEqual(60);
  expect(failedState.boss.isGimmickActive).toBe(false);
});

test('runs a legendary chain, gravity, and nova loadout', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('math_fighter_save', JSON.stringify({
      gold: 999999,
      equippedWeaponIds: [23, 25, 30],
      ownedWeaponIds: Array.from({ length: 30 }, (_, index) => index + 1),
      weaponLevels: Object.fromEntries(Array.from(
        { length: 30 },
        (_, index) => [index + 1, 1]
      )),
      upgrades: { maxHp: 0, atk: 0, def: 0, magnet: 0, goldBonus: 0 },
      wrongAreas: []
    }));
  });
  await seedShopSession(page, 9);

  await page.goto('/');
  const finalWeaponCard = page.locator('#weaponShopList .shop-card').nth(29);
  await expect(finalWeaponCard.locator('.card-desc')).toContainText('화면 전역 노바');
  await expect(finalWeaponCard.locator('.card-desc')).toContainText('광역 잠재력');

  await page.locator('#nextStageBtn').click();
  await expect(page.locator('#stageNum')).toHaveText('10');
  await page.waitForTimeout(1800);

  const canvasImage = await page.locator('#gameCanvas').screenshot();
  expect(canvasImage.byteLength).toBeGreaterThan(10000);
  expect(pageErrors).toEqual([]);
});

test('starts grade 5 semester 1 from its uploaded 120-question bank', async ({ page }) => {
  await page.goto('/');
  await page.locator('#playerNameInput').fill('Grade 5 Player');
  await page.locator('#playerGradeSelect').selectOption('5-1');
  await page.locator('#startGameBtn').click();

  await expect(page.locator('#gameContainer')).toBeVisible();
  await expect.poll(() => page.evaluate(async key => {
    const session = JSON.parse(sessionStorage.getItem(key));
    const { GRADE_FIVE_SEMESTER_ONE_QUESTION_BANK } = await import('/src/grade5Semester1QuestionBank.js');
    return {
      curriculum: session.player.curriculum,
      fromBank: GRADE_FIVE_SEMESTER_ONE_QUESTION_BANK.some(question => question.text === session.currentProblem.text),
      remaining: session.curriculumQuestionBankState.remainingQuestionIds.length
    };
  }, SESSION_KEY)).toEqual({ curriculum: '5-1', fromBank: true, remaining: 119 });
});

test('starts grade 6 semester 1 from its uploaded 120-question bank', async ({ page }) => {
  await page.goto('/');
  await page.locator('#playerNameInput').fill('Grade 6 Player');
  await page.locator('#playerGradeSelect').selectOption('6-1');
  await page.locator('#startGameBtn').click();

  await expect(page.locator('#gameContainer')).toBeVisible();
  await expect.poll(() => page.evaluate(async key => {
    const session = JSON.parse(sessionStorage.getItem(key));
    const { GRADE_SIX_SEMESTER_ONE_QUESTION_BANK } = await import('/src/grade6Semester1QuestionBank.js');
    return {
      curriculum: session.player.curriculum,
      fromBank: GRADE_SIX_SEMESTER_ONE_QUESTION_BANK.some(question => question.text === session.currentProblem.text),
      remaining: session.curriculumQuestionBankState.remainingQuestionIds.length
    };
  }, SESSION_KEY)).toEqual({ curriculum: '6-1', fromBank: true, remaining: 119 });
});

test('renders distinct projectile shapes for every firing monster', async ({ page }) => {
  await page.goto('/');
  const signatures = await page.evaluate(async () => {
    const {
      createEnemyProjectileVolley,
      ENEMY_PROJECTILE_PROFILES
    } = await import('/src/enemyProjectiles.js');
    const canvas = document.createElement('canvas');
    canvas.id = 'enemyProjectileShowcase';
    canvas.width = 1080;
    canvas.height = 640;
    canvas.style.cssText = 'position:fixed;left:20px;top:20px;z-index:9999;background:#07101d;border:1px solid #38a8ff';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const entries = Object.entries(ENEMY_PROJECTILE_PROFILES);

    ctx.fillStyle = '#07101d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    entries.forEach(([id, profile], row) => {
      const y = 48 + row * 74;
      ctx.fillStyle = '#d9ffff';
      ctx.font = '15px monospace';
      ctx.fillText(id, 18, y + 5);
      const volley = createEnemyProjectileVolley(
        id,
        { x: 235, y },
        { x: 930, y },
        20,
        1
      );
      for (let frame = 0; frame < 10; frame++) {
        volley.forEach(projectile => projectile.update(canvas.width, canvas.height, { x: 930, y }));
      }
      volley.forEach(projectile => projectile.draw(ctx));
    });

    return entries.map(([id, profile]) => ({
      id,
      shape: profile.shape,
      motion: profile.motion,
      count: profile.count
    }));
  });

  expect(new Set(signatures.map(item => item.shape)).size).toBe(signatures.length);
  await expect(page.locator('#enemyProjectileShowcase')).toBeVisible();
  const image = await page.locator('#enemyProjectileShowcase').screenshot();
  expect(image.byteLength).toBeGreaterThan(10000);
});

test('holds an idle monster pose and advances frames only while moving', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const [{ Monster }, { MONSTER_ROSTER }] = await Promise.all([
      import('/src/monster.js'),
      import('/src/monsterRoster.js')
    ]);
    const template = MONSTER_ROSTER.find(monster => monster.id === 'grunt_zombie');
    const monster = new Monster(64, 64, template, 1);
    if (!monster.sheetImg.complete) {
      await new Promise((resolve, reject) => {
        monster.sheetImg.addEventListener('load', resolve, { once: true });
        monster.sheetImg.addEventListener('error', reject, { once: true });
      });
    }

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const capture = (isMoving, distance) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      monster.isMoving = isMoving;
      monster.animationDistance = distance;
      monster.draw(ctx);
      return ctx.getImageData(0, 0, canvas.width, canvas.height).data.slice();
    };
    const countPixelChanges = (first, second) => {
      let changed = 0;
      for (let index = 0; index < first.length; index += 4) {
        if (
          first[index] !== second[index] ||
          first[index + 1] !== second[index + 1] ||
          first[index + 2] !== second[index + 2] ||
          first[index + 3] !== second[index + 3]
        ) changed++;
      }
      return changed;
    };

    const idleStart = capture(false, 0);
    const idleLater = capture(false, 900);
    const movingStart = capture(true, 0);
    const movingLater = capture(true, 10);
    return {
      idleChanges: countPixelChanges(idleStart, idleLater),
      movingChanges: countPixelChanges(movingStart, movingLater)
    };
  });

  expect(result.idleChanges).toBeLessThanOrEqual(10);
  expect(result.movingChanges).toBeGreaterThan(500);
});

test('renders mixed numbers as stacked fractions in problem text', async ({ page }) => {
  await page.goto('/');
  const layout = await page.evaluate(async () => {
    const { renderMathText } = await import('/src/mathTextFormatter.js');
    const preview = document.createElement('div');
    preview.id = 'fractionPreview';
    preview.className = 'problem-text-container';
    preview.style.cssText = 'position:fixed;left:20px;top:20px;z-index:9999;background:#080312;padding:20px';
    document.body.append(preview);
    renderMathText(preview, '길이가 1 4/5m인 끈');

    const fraction = preview.querySelector('.math-fraction');
    const numerator = preview.querySelector('.math-numerator');
    const denominator = preview.querySelector('.math-denominator');
    const numeratorRect = numerator.getBoundingClientRect();
    const denominatorRect = denominator.getBoundingClientRect();
    return {
      whole: preview.querySelector('.math-whole')?.textContent,
      numerator: numerator.textContent,
      denominator: denominator.textContent,
      numeratorTop: numeratorRect.top,
      denominatorTop: denominatorRect.top,
      fractionLabel: fraction.getAttribute('aria-label'),
      fractionLine: getComputedStyle(numerator).borderBottomWidth
    };
  });

  expect(layout).toMatchObject({
    whole: '1',
    numerator: '4',
    denominator: '5',
    fractionLabel: '5분의 4'
  });
  expect(layout.numeratorTop).toBeLessThan(layout.denominatorTop);
  expect(parseFloat(layout.fractionLine)).toBeGreaterThan(0);
});

test('renders the electromagnetic rifle without a magenta sprite background', async ({ page }) => {
  await page.goto('/');
  const pixels = await page.evaluate(async () => {
    const [{ Projectile }, { WEAPONS_DB }] = await Promise.all([
      import('/src/player.js'),
      import('/src/shop.js')
    ]);
    await new Promise(resolve => setTimeout(resolve, 200));

    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 260;
    const ctx = canvas.getContext('2d');
    const weapon = WEAPONS_DB.find(item => item.id === 13);
    const projectile = new Projectile(
      70,
      canvas.height / 2,
      canvas.width - 40,
      canvas.height / 2,
      weapon,
      { atkMultiplier: 1 },
      { maxRange: 760 }
    );
    projectile.createdTime = Date.now() - projectile.lifeTime / 2;
    projectile.draw(ctx);

    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let visible = 0;
    let magenta = 0;
    for (let i = 0; i < data.length; i += 4) {
      const [red, green, blue, alpha] = data.subarray(i, i + 4);
      if (alpha > 10) visible++;
      if (alpha > 10 && red > 180 && blue > 180 && green < 80) magenta++;
    }
    return { visible, magenta };
  });

  expect(pixels.visible).toBeGreaterThan(1000);
  expect(pixels.magenta).toBe(0);
});

test('throws smoke grenades and omits circular projectile outlines', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const [{ Projectile }, { WEAPONS_DB }, { getWeaponBehavior }] = await Promise.all([
      import('/src/player.js'),
      import('/src/shop.js'),
      import('/src/weaponProfiles.js')
    ]);
    await new Promise(resolve => setTimeout(resolve, 250));

    const player = { x: 100, y: 100, atkMultiplier: 1 };
    const smokeWeapon = WEAPONS_DB.find(weapon => weapon.id === 14);
    const smoke = new Projectile(
      player.x,
      player.y,
      330,
      player.y,
      smokeWeapon,
      player,
      { behavior: getWeaponBehavior(smokeWeapon.id, smokeWeapon.type), maxRange: 230 }
    );
    smoke.update([], player);
    const airborne = {
      behavior: smoke.behavior,
      isParabolic: smoke.isParabolic,
      movedForward: smoke.x > player.x,
      height: smoke.z
    };
    for (let frame = 0; frame < 80 && smoke.behavior !== 'mine'; frame++) {
      smoke.update([], player);
    }

    const canvas = document.createElement('canvas');
    canvas.width = 420;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    const originalArc = ctx.arc.bind(ctx);
    const originalBeginPath = ctx.beginPath.bind(ctx);
    const originalStroke = ctx.stroke.bind(ctx);
    let currentPathHasFullCircle = false;
    let circularOutlineStrokes = 0;
    ctx.beginPath = (...args) => {
      currentPathHasFullCircle = false;
      return originalBeginPath(...args);
    };
    ctx.arc = (...args) => {
      const [, , , startAngle, endAngle] = args;
      if (Math.abs(endAngle - startAngle) >= Math.PI * 1.99) {
        currentPathHasFullCircle = true;
      }
      return originalArc(...args);
    };
    ctx.stroke = (...args) => {
      if (currentPathHasFullCircle) circularOutlineStrokes++;
      currentPathHasFullCircle = false;
      return originalStroke(...args);
    };

    WEAPONS_DB.forEach((weapon, index) => {
      const behavior = getWeaponBehavior(weapon.id, weapon.type);
      const projectile = new Projectile(
        40 + (index % 10) * 38,
        40 + Math.floor(index / 10) * 70,
        380,
        120,
        weapon,
        player,
        { behavior }
      );
      projectile.draw(ctx);
    });

    return {
      airborne,
      landedBehavior: smoke.behavior,
      landedHeight: smoke.z,
      circularOutlineStrokes
    };
  });

  expect(result.airborne.behavior).toBe('smoke_grenade');
  expect(result.airborne.isParabolic).toBe(true);
  expect(result.airborne.movedForward).toBe(true);
  expect(result.airborne.height).toBeGreaterThan(0);
  expect(result.landedBehavior).toBe('mine');
  expect(result.landedHeight).toBe(0);
  expect(result.circularOutlineStrokes).toBe(0);
});

test('coalesces and expires sustained orbit and shockwave impact animations', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { createGameRenderer } = await import('/src/gameRenderer.js');
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    const state = {
      canvas,
      ctx,
      worldWidth: 800,
      worldHeight: 600,
      currentStage: 1,
      gameState: 'playing',
      player: null,
      boss: null,
      monsters: [],
      monsterProjectiles: [],
      dropItems: [],
      projectiles: []
    };
    const renderer = createGameRenderer({
      getCameraOffset: () => ({ x: 0, y: 0 }),
      getState: () => state
    });
    const createProjectile = (id, behavior, index) => ({
      id,
      behavior,
      x: 300 + index,
      y: 300,
      angle: 0,
      radius: 18,
      splashRadius: behavior === 'shockwave' ? 80 : 0
    });

    const impacts = [
      ...Array.from({ length: 12 }, (_, index) => createProjectile(16, 'orbit', index)),
      ...Array.from({ length: 24 }, (_, index) => createProjectile(18, 'shockwave', index))
    ];
    state.projectiles = impacts;
    impacts.forEach(projectile => {
      renderer.spawnHitEffect(projectile.x, projectile.y, projectile);
    });
    const activeAfterBurst = renderer.getEffectCounts().hitEffects;

    state.projectiles = [];
    await new Promise(resolve => setTimeout(resolve, 350));
    renderer.draw();
    return {
      activeAfterBurst,
      activeAfterExpiry: renderer.getEffectCounts().hitEffects
    };
  });

  expect(result.activeAfterBurst).toBe(2);
  expect(result.activeAfterExpiry).toBe(0);
});

test('keeps max smoke, orbit, and shockwave fire-hit bursts inside one frame budget', async ({ page }) => {
  await page.goto('/');
  const benchmark = await page.evaluate(async () => {
    const [
      { Player, preloadProjectileAssets },
      shop,
      { resolveProjectileCollisions },
      { createGameRenderer }
    ] = await Promise.all([
      import('/src/player.js'),
      import('/src/shop.js'),
      import('/src/combatResolver.js'),
      import('/src/gameRenderer.js')
    ]);
    localStorage.setItem('math_fighter_save', JSON.stringify({
      gold: 1e9,
      equippedWeaponIds: [14, 16, 18],
      ownedWeaponIds: [1, 14, 16, 18],
      weaponLevels: { 1: 1, 14: 10, 16: 10, 18: 10 },
      upgrades: { maxHp: 0, atk: 0, def: 0, magnet: 0, goldBonus: 0 },
      wrongAreas: []
    }));
    shop.loadState();
    await preloadProjectileAssets();

    const canvas = document.createElement('canvas');
    canvas.width = 960;
    canvas.height = 640;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const player = new Player(480, 320, 'Performance Tester');
    const state = {
      canvas,
      ctx,
      worldWidth: 960,
      worldHeight: 640,
      currentStage: 40,
      gameState: 'playing',
      player: null,
      boss: null,
      monsters: [],
      monsterProjectiles: [],
      dropItems: [],
      projectiles: []
    };
    const renderer = createGameRenderer({
      getCameraOffset: () => ({ x: 0, y: 0 }),
      getState: () => state
    });
    const monsters = Array.from({ length: 80 }, (_, index) => ({
      x: 620 + (index % 8) * 2,
      y: 320 + Math.floor(index / 8) * 2,
      radius: 18,
      hp: 1e12,
      takeDamage(amount) {
        this.hp -= amount;
      },
      applyStatusEffect() {}
    }));
    const durations = [];
    let projectileCount = 0;

    for (let iteration = 0; iteration < 20; iteration++) {
      const startedAt = performance.now();
      const projectiles = [];
      player.lastShotTimes = {};
      player.shoot(monsters, projectiles);
      projectileCount = projectiles.length;
      projectiles.forEach(projectile => {
        projectile.x = monsters[0].x;
        projectile.y = monsters[0].y;
        projectile.z = 0;
        projectile.isParabolic = false;
      });
      state.projectiles = projectiles;
      resolveProjectileCollisions({
        projectiles,
        monsters,
        boss: null,
        onMonsterDefeat() {},
        onHitEffect: renderer.spawnHitEffect
      });
      renderer.draw();
      durations.push(performance.now() - startedAt);
      renderer.resetEffects();
    }

    return {
      projectileCount,
      averageBurstMs: durations.reduce((sum, duration) => sum + duration, 0) / durations.length,
      slowestBurstMs: Math.max(...durations)
    };
  });

  expect(benchmark.projectileCount).toBe(16);
  expect(benchmark.averageBurstMs).toBeLessThan(12);
  expect(benchmark.slowestBurstMs).toBeLessThan(20);
});

test('renders every max-pattern weapon together within a stable browser frame budget', async ({ page }) => {
  await page.goto('/');
  const benchmark = await page.evaluate(async () => {
    const [
      { Projectile, preloadProjectileAssets },
      { WEAPONS_DB },
      { getWeaponBehavior, getWeaponPatternProfile },
      { getCombatRenderQuality },
      { createWeaponImpactEffect, drawWeaponImpactEffect }
    ] = await Promise.all([
      import('/src/player.js'),
      import('/src/shop.js'),
      import('/src/weaponProfiles.js'),
      import('/src/gameRenderer.js'),
      import('/src/weaponEffects.js')
    ]);
    await preloadProjectileAssets();

    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    const player = { x: 640, y: 360, atkMultiplier: 1 };
    const projectiles = [];

    WEAPONS_DB.forEach((weapon, weaponIndex) => {
      const behavior = getWeaponBehavior(weapon.id, weapon.type);
      const pattern = getWeaponPatternProfile(weapon.id, behavior, 3);
      for (let index = 0; index < pattern.count; index++) {
        const angle = (Math.PI * 2 * (weaponIndex + index / pattern.count)) / WEAPONS_DB.length;
        const radius = 90 + (weaponIndex % 5) * 55;
        const x = player.x + Math.cos(angle) * radius;
        const y = player.y + Math.sin(angle) * radius;
        const projectile = new Projectile(
          x,
          y,
          player.x + Math.cos(angle) * 500,
          player.y + Math.sin(angle) * 500,
          weapon,
          player,
          { behavior, angleOffset: angle, maxRange: 520 }
        );
        projectile.createdTime = Date.now() - Math.min(180, projectile.lifeTime / 2);
        projectile.trailPositions = Array.from({ length: 15 }, (_, trailIndex) => ({
          x: x - Math.cos(angle) * trailIndex * 6,
          y: y - Math.sin(angle) * trailIndex * 6,
          z: 0
        }));
        projectiles.push(projectile);
      }
    });

    const effects = projectiles.slice(0, 48).map(projectile => (
      createWeaponImpactEffect(projectile.x, projectile.y, projectile)
    ));
    const quality = getCombatRenderQuality(projectiles.length, effects.length);
    const durations = [];

    for (let frame = 0; frame < 12; frame++) {
      const startedAt = performance.now();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      projectiles.forEach(projectile => projectile.draw(ctx, { quality }));
      const now = Date.now();
      effects.forEach(effect => drawWeaponImpactEffect(ctx, effect, now, quality));
      durations.push(performance.now() - startedAt);
    }

    return {
      weaponCount: WEAPONS_DB.length,
      projectileCount: projectiles.length,
      quality,
      averageFrameMs: durations.reduce((sum, duration) => sum + duration, 0) / durations.length,
      slowestFrameMs: Math.max(...durations)
    };
  });

  expect(benchmark.weaponCount).toBe(30);
  expect(benchmark.projectileCount).toBeGreaterThan(100);
  expect(benchmark.quality).toBe(0.45);
  expect(benchmark.averageFrameMs).toBeLessThan(12);
  expect(benchmark.slowestFrameMs).toBeLessThan(20);
});

test('keeps Korean units on large-number game drops but expands brain answers', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const {
      applyCurriculumToPlayer,
      generateCurriculumBrainTrainingQuestions,
      generateCurriculumProblem
    } = await import('/src/curriculumProblems.js');
    const { getRandomNumberPool } = await import('/src/mathEngine.js');
    const { DropItem } = await import('/src/monster.js');

    applyCurriculumToPlayer({}, '4-1');
    let problem = null;
    for (let i = 0; i < 1000 && !problem; i++) {
      const candidate = generateCurriculumProblem();
      if (candidate.text.includes('10억씩')) problem = candidate;
    }

    let brainQuestion = null;
    for (let i = 0; i < 1000 && !brainQuestion; i++) {
      brainQuestion = generateCurriculumBrainTrainingQuestions()
        .find(question => question.text.includes('10억씩')) || null;
    }

    const pool = getRandomNumberPool(problem);
    const canvas = document.createElement('canvas');
    canvas.id = 'largeNumberDropShowcase';
    canvas.width = 640;
    canvas.height = 180;
    canvas.style.cssText = 'position:fixed;left:20px;top:20px;z-index:9999;background:#11182b';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#11182b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    pool.forEach((value, index) => {
      new DropItem(85 + index * 155, 90, 'number', value, String(value)).draw(ctx);
    });

    return {
      answer: problem.options[0],
      pool,
      brainAnswer: brainQuestion.answer
    };
  });

  expect(result.answer).toMatch(/^\d+억$/);
  expect(result.pool.every(value => /^\d+억$/.test(value))).toBe(true);
  expect(result.brainAnswer).toMatch(/^\d{10}$/);
  const image = await page.locator('#largeNumberDropShowcase').screenshot();
  expect(image.byteLength).toBeGreaterThan(2000);
});

test('completes the run after stage 50', async ({ page }) => {
  const session = createShopSession(50);
  session.player.curriculum = '4-1';
  session.player.grade = 4;
  session.correctAnswers = { 1: 3, 2: 1, 3: 0, 4: 0, 5: 0 };
  session.totalAnswers = { 1: 4, 2: 3, 3: 0, 4: 0, 5: 0 };
  session.wrongQuestionStats = {
    angle: {
      text: '삼각형의 세 각의 합은?', area: 2, answers: [180],
      distractors: [90, 270, 360], wrongCount: 2, lastWrongAt: 1
    }
  };
  await seedSession(page, session);

  await page.goto('/');
  await page.locator('#nextStageBtn').click();

  await expect(page.locator('#certScreen')).toBeVisible();
  await expect(page.locator('#certStageText')).toHaveText('50 STAGE');
  await expect(page.locator('#certContainer .cert-header')).toBeInViewport();
  const desktopLayout = await page.evaluate(() => {
    const screen = document.getElementById('certScreen');
    const container = document.getElementById('certContainer');
    const chart = document.getElementById('certChartCanvas');
    return {
      scrollTop: screen.scrollTop,
      screenTop: screen.getBoundingClientRect().top,
      containerTop: container.getBoundingClientRect().top,
      chartWidth: chart.width,
      chartHeight: chart.height
    };
  });
  expect(desktopLayout.scrollTop).toBe(0);
  expect(desktopLayout.containerTop).toBeGreaterThanOrEqual(desktopLayout.screenTop);
  expect(desktopLayout.chartWidth).toBe(320);
  expect(desktopLayout.chartHeight).toBe(240);
  await expect(page.locator('#unitAccuracyList')).toContainText('각도');
  await expect(page.locator('#unitAccuracyList')).toContainText('33%');
  await expect(page.locator('#frequentWrongList')).toContainText('삼각형의 세 각의 합은?');
  await expect(page.locator('#printWorksheetBtn')).toBeEnabled();

  const popupPromise = page.waitForEvent('popup');
  await page.locator('#printWorksheetBtn').click();
  const worksheet = await popupPromise;
  await expect(worksheet.locator('.page')).toHaveCount(2);
  await expect(worksheet.locator('.page').first().locator('.choice').first()).toContainText('①');
  await expect(worksheet.locator('.page').nth(1)).toContainText('① 180');
  await worksheet.close();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#certContainer .cert-header')).toBeInViewport();
  const mobileLayout = await page.evaluate(() => {
    const screen = document.getElementById('certScreen');
    const chart = document.getElementById('certChartCanvas');
    return {
      scrollTop: screen.scrollTop,
      chartWidth: chart.getBoundingClientRect().width,
      screenWidth: screen.getBoundingClientRect().width
    };
  });
  expect(mobileLayout.scrollTop).toBe(0);
  expect(mobileLayout.chartWidth).toBeLessThanOrEqual(mobileLayout.screenWidth - 24);
});

test('uses grade 4 semester 1 content for brain training', async ({ page }) => {
  const session = createShopSession(1);
  session.player.grade = 4;
  session.player.curriculum = '4-1';
  await seedSession(page, session);
  await page.goto('/');

  await page.locator('#brainTrainingBtn').click();
  await expect(page.locator('#brainTrainingModal')).toBeVisible();
  await expect(page.locator('#brainTrainingQuestionList .exam-item')).toHaveCount(3);
  await expect(page.locator('#brainTrainingQuestionList input[type="number"]')).toHaveCount(3);
  await expect(page.locator('#brainTrainingQuestionList input[type="radio"]')).toHaveCount(0);
  await expect(page.locator('#brainTrainingQuestionList input[type="number"]').first()).toHaveAttribute('step', '1');

  const bankResult = await page.evaluate(async () => {
    const { GRADE_FOUR_SEMESTER_ONE_BRAIN_QUESTION_BANK } = await import('/src/grade4Semester1BrainQuestionBank.js');
    const { getCurriculumGameQuestionBankState } = await import('/src/curriculumProblems.js');
    const displayedTexts = [...document.querySelectorAll('#brainTrainingQuestionList .exam-q')]
      .map(element => element.textContent.replace(/^Q\d+\.\s*/, ''));
    return {
      allFromBank: displayedTexts.every(text => (
        GRADE_FOUR_SEMESTER_ONE_BRAIN_QUESTION_BANK.some(question => question.text === text)
      )),
      remaining: getCurriculumGameQuestionBankState().remainingBrainQuestionIds.length
    };
  });
  expect(bankResult).toEqual({ allFromBank: true, remaining: 97 });
});

test('uses numeric subjective grade 5 semester 1 bank questions for brain training', async ({ page }) => {
  const session = createShopSession(1);
  session.player.grade = 5;
  session.player.curriculum = '5-1';
  await seedSession(page, session);
  await page.goto('/');

  await page.locator('#brainTrainingBtn').click();
  await expect(page.locator('#brainTrainingModal')).toBeVisible();
  await expect(page.locator('#brainTrainingQuestionList .exam-item')).toHaveCount(3);
  await expect(page.locator('#brainTrainingQuestionList input[type="number"]')).toHaveCount(3);
  await expect(page.locator('#brainTrainingQuestionList input[type="radio"]')).toHaveCount(0);
  await expect(page.locator('#brainTrainingQuestionList input[type="number"]').first()).toHaveAttribute('step', 'any');
  await page.locator('#brainTrainingQuestionList input[type="number"]').first().fill('0.45');
  await expect(page.locator('#brainTrainingQuestionList input[type="number"]').first()).toHaveValue('0.45');

  const bankResult = await page.evaluate(async () => {
    const { GRADE_FIVE_SEMESTER_ONE_BRAIN_QUESTION_BANK } = await import('/src/grade5Semester1BrainQuestionBank.js');
    const { getCurriculumGameQuestionBankState } = await import('/src/curriculumProblems.js');
    const displayedTexts = [...document.querySelectorAll('#brainTrainingQuestionList .exam-q')]
      .map(element => element.textContent.replace(/^Q\d+\.\s*/, ''));
    return {
      allFromBank: displayedTexts.every(text => (
        GRADE_FIVE_SEMESTER_ONE_BRAIN_QUESTION_BANK.some(question => question.text === text)
      )),
      remaining: getCurriculumGameQuestionBankState().remainingBrainQuestionIds.length
    };
  });
  expect(bankResult).toEqual({ allFromBank: true, remaining: 57 });
});

test('uses numeric subjective grade 6 semester 1 bank questions for brain training', async ({ page }) => {
  const session = createShopSession(1);
  session.player.grade = 6;
  session.player.curriculum = '6-1';
  await seedSession(page, session);
  await page.goto('/');

  await page.locator('#brainTrainingBtn').click();

  await expect(page.locator('#brainTrainingModal')).toBeVisible();
  await expect(page.locator('#brainTrainingQuestionList .exam-item')).toHaveCount(3);
  await expect(page.locator('#brainTrainingQuestionList input[type="number"]')).toHaveCount(3);
  await expect(page.locator('#brainTrainingQuestionList input[type="radio"]')).toHaveCount(0);
  await expect(page.locator('#brainTrainingQuestionList input[type="number"]').first()).toHaveAttribute('step', 'any');

  const result = await page.evaluate(async () => {
    const { GRADE_SIX_SEMESTER_ONE_BRAIN_QUESTION_BANK } = await import('/src/grade6Semester1BrainQuestionBank.js');
    const { getCurriculumGameQuestionBankState } = await import('/src/curriculumProblems.js');
    const displayedTexts = [...document.querySelectorAll('#brainTrainingQuestionList .exam-q')]
      .map(element => element.textContent.replace(/^Q\d+\.\s*/, '').trim());
    return {
      allFromBank: displayedTexts.every(text => (
        GRADE_SIX_SEMESTER_ONE_BRAIN_QUESTION_BANK.some(question => question.text === text)
      )),
      remaining: getCurriculumGameQuestionBankState().remainingBrainQuestionIds.length
    };
  });

  expect(result).toEqual({ allFromBank: true, remaining: 64 });
});

test('uses grade 4 semester 1 content for the weakness review exam', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const { applyCurriculumToPlayer } = await import('/src/curriculumProblems.js');
    const { openExamModal } = await import('/src/exam.js');
    applyCurriculumToPlayer({}, '4-1');
    openExamModal();
  });

  const questions = page.locator('#examQuestionList .exam-item');
  await expect(page.locator('#examModal')).toBeVisible();
  await expect(questions).toHaveCount(3);
  await expect(questions.nth(0)).toContainText(/10,000|나타내는 값|10억|1조|100만/);
  await expect(questions.nth(1)).toContainText(/도|삼각형|평각|시계/);
  await expect(questions.nth(2)).toContainText(/×|÷|나누어|쪽씩/);
  await expect(page.locator('#examQuestionList')).not.toContainText(/최대공약수|최소공배수/);
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
