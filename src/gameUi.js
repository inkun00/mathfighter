import {
  WEAPONS_DB,
  UPGRADES_DB,
  equipWeapon,
  getEquippedWeapons,
  getGold,
  getOwnedWeapons,
  getStatValue,
  getUpgradeCost,
  getUpgradeLevel,
  getWeaponLevel,
  getWeaponUpgradeCost,
  getWeaponUpgradeSummary,
  purchaseUpgrade,
  purchaseWeapon,
  upgradeWeapon
} from './shop.js';
import {
  getWeaponBalanceMetrics,
  getWeaponFireStyleLabel,
  getWeaponRangeLabel
} from './weaponProfiles.js';
import { renderMathText } from './mathTextFormatter.js';

export function isVisibleGameplayScreen(player, currentProblem) {
  const gameContainer = document.getElementById('gameContainer');
  const levelUpModal = document.getElementById('levelUpModal');
  const pauseModal = document.getElementById('pauseModal');
  return Boolean(
    player
    && currentProblem
    && gameContainer
    && !gameContainer.classList.contains('hidden')
    && (!levelUpModal || levelUpModal.classList.contains('hidden'))
    && (!pauseModal || pauseModal.classList.contains('hidden'))
  );
}

export function createGameUi({
  getState,
  setGameState,
  blurActiveControl,
  hidePauseMenu,
  hideStartScreen,
  saveSessionSnapshot
}) {
  function getWeaponDps(weapon) {
    return getWeaponBalanceMetrics(weapon, getWeaponLevel(weapon.id)).focusDps;
  }

  function getWeaponDisplayDamage(weapon) {
    const level = getWeaponLevel(weapon.id);
    return Math.round(weapon.dmg * (1 + (level - 1) * 0.1));
  }

  function getCurrentStatSummary() {
    const { player } = getState();
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

  function updateHUD() {
    const { player, currentProblem, boss, stageTimer, problemProgress, combo } = getState();
    if (!player || !currentProblem) return;

    renderMathText(document.getElementById('problemText'), currentProblem.text);
    document.getElementById('problemTimer').innerText = boss ? 'BOSS' : stageTimer;

    const activeProgress = boss?.isGimmickActive ? boss.gimmickAnswerCount : problemProgress;
    const gaugePercent = (activeProgress / currentProblem.requiredCount) * 100;
    document.getElementById('problemGauge').style.width = `${Math.min(100, gaugePercent)}%`;

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

  function renderPauseLounge() {
    const { player } = getState();
    if (!player) return;

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

    const weaponList = document.getElementById('pauseWeaponList');
    if (!weaponList) return;

    weaponList.innerHTML = '';
    const ownedWeapons = getOwnedWeapons();
    const equippedWeaponIds = getEquippedWeapons().map(weapon => weapon.id);

    WEAPONS_DB.forEach(weapon => {
      if (!ownedWeapons.includes(weapon.id)) return;

      const isEquipped = equippedWeaponIds.includes(weapon.id);
      const card = document.createElement('div');
      card.className = `pause-weapon-card ${isEquipped ? 'equipped' : ''}`;

      let actionButton;
      if (isEquipped) {
        const canUnequip = equippedWeaponIds.length > 1;
        actionButton = `<button class="buy-btn pause-weapon-btn equip-toggle-btn" data-id="${weapon.id}" ${canUnequip ? '' : 'disabled'}>장착 해제</button>`;
      } else {
        const label = equippedWeaponIds.length >= 3 ? '교체 장착' : '장착하기';
        actionButton = `<button class="buy-btn pause-weapon-btn equip-toggle-btn" data-id="${weapon.id}">${label}</button>`;
      }

      card.innerHTML = `
        <div class="pause-weapon-card-header">
          <img class="pause-weapon-card-icon" src="/assets/weapons/weapon_${String(weapon.id).padStart(2, '0')}.png" alt="${weapon.name}">
          <h4>${weapon.name}</h4>
        </div>
        <p class="pause-weapon-desc">피해: ${weapon.dmg} / 범위: ${getWeaponRangeLabel(weapon.id, weapon.type)}</p>
        ${actionButton}
      `;
      weaponList.appendChild(card);
    });

    weaponList.querySelectorAll('.equip-toggle-btn').forEach(button => {
      button.addEventListener('click', event => {
        const id = Number.parseInt(event.currentTarget.dataset.id, 10);
        if (!equipWeapon(id)) return;
        renderPauseLounge();
        updateHUD();
        saveSessionSnapshot();
      });
    });
  }

  function getLevelUpChoices() {
    const skillPool = [
      { name: '무기 화력 강화', desc: '모든 무기 피해량이 12% 증가합니다.', icon: '⚔️', type: 'attack' },
      { name: '연사력 향상', desc: '자동 공격 간격이 12% 짧아집니다.', icon: '⚡', type: 'fireRate' },
      { name: '방어력 향상', desc: '받는 피해를 줄이는 방어력이 3 증가합니다.', icon: '🛡️', type: 'defense' },
      { name: '최대 체력 강화', desc: '최대 HP가 20 증가하고 즉시 20 회복합니다.', icon: '❤️', type: 'maxHp' },
      { name: '이동 속도 향상', desc: '이동 속도가 10% 증가합니다.', icon: '👟', type: 'speed' },
      { name: '자석 범위 확장', desc: '숫자와 보석을 끌어오는 범위가 35 증가합니다.', icon: '🧲', type: 'magnet' },
      { name: '학습 집중력', desc: '경험치 획득량이 15% 증가합니다.', icon: '📘', type: 'exp' },
      { name: '체력 향상', desc: '전체 체력이 10%증가합니다.', icon: '❤️', type: 'hpPercent' }
    ];
    return skillPool.sort(() => Math.random() - 0.5).slice(0, 3);
  }

  function applyEnhancedLevelUpChoice(choice) {
    const { player } = getState();
    if (choice.type === 'attack') player.atkMultiplier *= 1.12;
    else if (choice.type === 'fireRate') player.fireRateMultiplier *= 1.12;
    else if (choice.type === 'defense') {
      player.bonusDefense += 3;
      player.refreshStats();
    } else if (choice.type === 'maxHp') {
      player.bonusMaxHp += 20;
      player.refreshStats();
      player.heal(20);
    } else if (choice.type === 'speed') player.baseSpeed *= 1.1;
    else if (choice.type === 'magnet') {
      player.bonusMagnet += 35;
      player.refreshStats();
    } else if (choice.type === 'exp') player.expMultiplier *= 1.15;
    else if (choice.type === 'hpPercent') {
      player.bonusMaxHp += Math.max(1, Math.floor(player.maxHp * 0.1));
      player.refreshStats();
    }
    updateHUD();
  }

  function triggerLevelUpEnhanced() {
    setGameState('levelUp');
    document.getElementById('levelUpModal').classList.remove('hidden');
    const container = document.getElementById('skillCardContainer');
    container.innerHTML = '';

    getLevelUpChoices().forEach(choice => {
      const card = document.createElement('div');
      card.className = 'skill-card';
      card.innerHTML = `
        <span class="skill-icon">${choice.icon}</span>
        <div class="skill-info"><h4>${choice.name}</h4><p>${choice.desc}</p></div>
      `;
      card.addEventListener('click', () => {
        applyEnhancedLevelUpChoice(choice);
        document.getElementById('levelUpModal').classList.add('hidden');
        setGameState('play');
      });
      container.appendChild(card);
    });
  }

  function renderShopStatusPanel() {
    const { player } = getState();
    const panel = document.getElementById('playerStatusPanel');
    if (!panel || !player) return;

    const stats = getCurrentStatSummary();
    document.getElementById('shopPlayerPreview').classList.toggle('female', player.gender === 'female');
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
        <div class="equipped-weapon-row"><span>${index + 1}. ${weapon.name} LV.${getWeaponLevel(weapon.id)}</span><strong>${getWeaponDisplayDamage(weapon)}</strong></div>
      `).join('') || '<div class="equipped-weapon-row"><span>없음</span><strong>-</strong></div>'}
    `;
  }

  function getWeaponChangeText(weapon, isOwned, isEquipped, equippedWeaponIds) {
    const equippedWeapons = getEquippedWeapons();
    const currentDamage = equippedWeapons.reduce((sum, item) => sum + getWeaponDisplayDamage(item), 0);
    const currentDps = equippedWeapons.reduce((sum, item) => sum + getWeaponDps(item), 0);
    let nextWeapons = [...equippedWeapons];

    if (!isOwned && !nextWeapons.some(item => item.id === weapon.id)) {
      if (nextWeapons.length < 3) nextWeapons.push(weapon);
      else nextWeapons[2] = weapon;
    } else if (isEquipped && nextWeapons.length > 1) {
      nextWeapons = nextWeapons.filter(item => item.id !== weapon.id);
    } else if (!isEquipped && nextWeapons.length < 3) nextWeapons.push(weapon);
    else if (!isEquipped) nextWeapons[2] = weapon;

    const nextDamage = nextWeapons.reduce((sum, item) => sum + getWeaponDisplayDamage(item), 0);
    const nextDps = nextWeapons.reduce((sum, item) => sum + getWeaponDps(item), 0);
    const deltaDamage = nextDamage - currentDamage;
    const deltaDps = nextDps - currentDps;

    if (isEquipped && equippedWeaponIds.length <= 1) return '최소 1개 장착 필요';
    return `변화: 피해 ${deltaDamage >= 0 ? '+' : ''}${deltaDamage}, 초당 화력 ${deltaDps >= 0 ? '+' : ''}${deltaDps}`;
  }

  function getWeaponUpgradeEffectText(weapon, summary) {
    const nextBonus = Math.min(summary.maxLevel, summary.level + 1) - 1;
    const parts = [`공격력 +${nextBonus * 10}%`];
    if (['hit', 'pierce', 'homing'].includes(weapon.type)) parts.push(`크기 +${nextBonus * 6}%`);
    if ([3, 8, 11, 12, 18, 19, 21, 27, 28, 30].includes(weapon.id)) parts.push(`발사체 +${Math.floor(nextBonus / 3)}`);
    if (weapon.type === 'splash' || [6, 8, 11, 12, 15, 17, 21, 22, 25, 27, 30].includes(weapon.id)) parts.push(`범위 +${nextBonus * 8}%`);
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

  function openShopScreen() {
    const { player, currentStage, brainTrainingCompletedStages } = getState();
    setGameState('shop');
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

    const weaponList = document.getElementById('weaponShopList');
    weaponList.innerHTML = '';
    const ownedWeapons = getOwnedWeapons();
    const equippedWeaponIds = getEquippedWeapons().map(weapon => weapon.id);

    WEAPONS_DB.forEach(weapon => {
      const card = document.createElement('div');
      const isOwned = ownedWeapons.includes(weapon.id);
      const isEquipped = equippedWeaponIds.includes(weapon.id);
      const weaponLevel = getWeaponLevel(weapon.id);
      const upgradeSummary = getWeaponUpgradeSummary(weapon.id);
      const weaponUpgradeCost = getWeaponUpgradeCost(weapon.id);
      const isWeaponMax = weaponLevel >= upgradeSummary.maxLevel;
      const canUpgradeWeapon = isOwned && !isWeaponMax && getGold() >= weaponUpgradeCost;
      card.className = `shop-card ${isOwned ? 'purchased' : ''}`;

      let actionButton;
      if (isEquipped) {
        const canUnequip = equippedWeaponIds.length > 1;
        actionButton = `<button class="buy-btn equip-action-btn" data-id="${weapon.id}" ${canUnequip ? '' : 'disabled'}>${canUnequip ? '장착 해제' : '장착중'}</button>`;
      } else if (isOwned) {
        actionButton = `<button class="buy-btn equip-action-btn" data-id="${weapon.id}">${equippedWeaponIds.length >= 3 ? '교체 장착' : '장착하기'}</button>`;
      } else {
        actionButton = `<button class="buy-btn buy-action-btn" data-id="${weapon.id}" ${getGold() >= weapon.price ? '' : 'disabled'}>구매 (🪙 ${weapon.price})</button>`;
      }

      card.innerHTML = `
        <div class="card-header">
          <img class="weapon-card-icon" src="/assets/weapons/weapon_${String(weapon.id).padStart(2, '0')}.png" alt="${weapon.name}" loading="lazy">
          <div class="card-title"><h3>${weapon.name}</h3><span class="card-type ${weapon.type}">${weapon.type.toUpperCase()} · LV.${weaponLevel}/10</span></div>
        </div>
        <p class="card-desc">${weapon.desc}</p>
        <div class="card-price-row"><span class="price">피해량: ${weapon.dmg}</span>${actionButton}</div>
      `;
      if (isOwned) {
        card.insertAdjacentHTML('beforeend', `
          <div class="weapon-upgrade-row">
            <span class="weapon-upgrade-info">${isWeaponMax ? '강화 MAX' : `강화비 ${weaponUpgradeCost}G`}</span>
            <button class="buy-btn weapon-upgrade-action-btn" data-id="${weapon.id}" ${canUpgradeWeapon ? '' : 'disabled'}>${isWeaponMax ? 'MAX' : '무기 강화'}</button>
          </div>
          <div class="weapon-upgrade-effect">${isWeaponMax ? '최대 강화 완료' : getWeaponUpgradeEffectText(weapon, upgradeSummary)}</div>
        `);
      }
      const balanceMetrics = getWeaponBalanceMetrics(weapon, weaponLevel);
      card.querySelector('.price').textContent = isEquipped
        ? `장착 슬롯 ${equippedWeaponIds.indexOf(weapon.id) + 1}/3`
        : `피해 ${getWeaponDisplayDamage(weapon)} · DPS ${balanceMetrics.focusDps}`;
      card.querySelector('.card-desc').textContent = `${weapon.desc} 발사 방식: ${getWeaponFireStyleLabel(weapon.id, weapon.type)} / 사정거리: ${getWeaponRangeLabel(weapon.id, weapon.type)} / 광역 잠재력: ${balanceMetrics.areaDps}`;
      card.insertAdjacentHTML('beforeend', `<div class="change-row"><span>${getWeaponChangeText(weapon, isOwned, isEquipped, equippedWeaponIds)}</span></div>`);
      weaponList.appendChild(card);
    });

    const upgradeList = document.getElementById('upgradeShopList');
    upgradeList.innerHTML = '';
    UPGRADES_DB.forEach(upgrade => {
      const card = document.createElement('div');
      const level = getUpgradeLevel(upgrade.key);
      const cost = getUpgradeCost(upgrade.key);
      const isMax = level >= upgrade.maxLevel;
      card.className = 'shop-card';
      card.innerHTML = `
        <div class="card-header"><span class="card-icon">${upgrade.symbol}</span><div class="card-title"><h3>${upgrade.name}</h3><span class="card-type homing">LV. ${level}/${upgrade.maxLevel}</span></div></div>
        <p class="card-desc">${upgrade.desc}</p>
        <div class="card-price-row"><span class="price">${isMax ? 'MAX' : `비용: 🪙 ${cost}`}</span><button class="buy-btn upgrade-action-btn" data-key="${upgrade.key}" ${getGold() >= cost && !isMax ? '' : 'disabled'}>${isMax ? '강화 완료' : '강화하기'}</button></div>
      `;
      card.insertAdjacentHTML('beforeend', `<div class="change-row"><span>${getUpgradeChangeText(upgrade, isMax)}</span></div>`);
      upgradeList.appendChild(card);
    });

    document.querySelectorAll('.buy-action-btn').forEach(button => button.addEventListener('click', event => {
      if (purchaseWeapon(Number.parseInt(event.currentTarget.dataset.id, 10))) {
        player.gold = getGold();
        openShopScreen();
      }
    }));
    document.querySelectorAll('.equip-action-btn').forEach(button => button.addEventListener('click', event => {
      if (equipWeapon(Number.parseInt(event.currentTarget.dataset.id, 10))) {
        player.gold = getGold();
        openShopScreen();
      }
    }));
    document.querySelectorAll('.weapon-upgrade-action-btn').forEach(button => button.addEventListener('click', event => {
      if (upgradeWeapon(Number.parseInt(event.currentTarget.dataset.id, 10))) {
        player.gold = getGold();
        openShopScreen();
      }
    }));
    document.querySelectorAll('.upgrade-action-btn').forEach(button => button.addEventListener('click', event => {
      if (purchaseUpgrade(event.currentTarget.dataset.key)) {
        player.refreshStats();
        player.gold = getGold();
        openShopScreen();
      }
    }));
    saveSessionSnapshot();
  }

  return { openShopScreen, renderPauseLounge, triggerLevelUpEnhanced, updateHUD };
}
