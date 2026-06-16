/**
 * Shop and Upgrade System Store for Math Fighter
 * Manages player gold, purchased weapons (30 items), and stat upgrades.
 */

// 30 weapons definitions
export const WEAPONS_DB = [
  // 1-10: Normal Weapons (Low Cost)
  { id: 1, name: "훈련용 카타나", type: "hit", price: 1000, dmg: 15, cooldown: 800, desc: "전방으로 가벼운 검풍을 날립니다.", symbol: "⚔️" },
  { id: 2, name: "리볼버 피스톨", type: "hit", price: 1200, dmg: 25, cooldown: 1200, desc: "가까운 적 1명에게 강력한 한 발을 발사합니다.", symbol: "🔫" },
  { id: 3, name: "레트로 목검", type: "hit", price: 1500, dmg: 18, cooldown: 900, desc: "부채꼴 범위 내의 적을 밀어냅니다.", symbol: "🪵" },
  { id: 4, name: "낡은 정원가위", type: "pierce", price: 1800, dmg: 12, cooldown: 1500, desc: "정면으로 날아갔다 돌아오는 회전 칼날을 던집니다.", symbol: "✂️" },
  { id: 5, name: "가벼운 수리검", type: "pierce", price: 2200, dmg: 10, cooldown: 600, desc: "적들을 관통하는 작은 표창을 빠르게 투척합니다.", symbol: "✳️" },
  { id: 6, name: "파이프 화염병", type: "splash", price: 2500, dmg: 8, cooldown: 2000, desc: "지면에 2초간 유지되는 화염 장판을 생성합니다.", symbol: "🧪" },
  { id: 7, name: "스쿠버 작살건", type: "pierce", price: 3000, dmg: 35, cooldown: 1800, desc: "한 선상의 적들을 일직선으로 뚫고 갑니다.", symbol: "🔱" },
  { id: 8, name: "소형 크레모아", type: "splash", price: 3500, dmg: 40, cooldown: 2500, desc: "전방 부채꼴 범위에 고각 폭발을 일으킵니다.", symbol: "📦" },
  { id: 9, name: "자력 추적구슬", type: "homing", price: 4000, dmg: 16, cooldown: 1000, desc: "가장 가까운 몬스터를 자동으로 쫓아갑니다.", symbol: "🔮" },
  { id: 10, name: "고무줄 새총", type: "hit", price: 4500, dmg: 20, cooldown: 700, desc: "화면 경계에 닿으면 튕기는 고무탄을 쏩니다.", symbol: "🎯" },

  // 11-20: Rare Weapons (Medium Cost)
  { id: 11, name: "에너지 세이버", type: "hit", price: 12000, dmg: 55, cooldown: 700, desc: "전방 180도를 넓게 베어 넘기며 강력하게 밀쳐냅니다.", symbol: "⚡" },
  { id: 12, name: "더블 샷건", type: "splash", price: 15000, dmg: 80, cooldown: 1600, desc: "전방으로 산탄을 퍼뜨려 근접 시 폭발 피해를 줍니다.", symbol: "💥" },
  { id: 13, name: "전자기 소총", type: "pierce", price: 18000, dmg: 40, cooldown: 1100, desc: "화면 끝까지 닿는 관통 레이저 빔을 방출합니다.", symbol: "🗼" },
  { id: 14, name: "연막 유탄기", type: "splash", price: 22000, dmg: 45, cooldown: 1800, desc: "폭발과 함께 적들을 느리게 만드는 연막을 만듭니다.", symbol: "💨" },
  { id: 15, name: "중력 화살궁", type: "homing", price: 26000, dmg: 60, cooldown: 1300, desc: "유도 화살이 대상을 맞추면 주변 적을 끌어당깁니다.", symbol: "🏹" },
  { id: 16, name: "정전기 차크람", type: "pierce", price: 30000, dmg: 32, cooldown: 1400, desc: "주변을 나선형으로 돌며 통과하는 고리 칼날을 던집니다.", symbol: "💿" },
  { id: 17, name: "융해 물질 투척기", type: "splash", price: 35000, dmg: 38, cooldown: 1700, desc: "산성 물질을 투척해 지속 데미지를 주고 둔화시킵니다.", symbol: "☣️" },
  { id: 18, name: "초음파 파동기", type: "hit", price: 42000, dmg: 50, cooldown: 1000, desc: "주변 360도 전체에 강력한 밀치기 파동을 퍼뜨립니다.", symbol: "🔊" },
  { id: 19, name: "다중 탄환석궁", type: "pierce", price: 50000, dmg: 48, cooldown: 800, desc: "3갈래로 날아가는 관통 화살을 넓게 쏩니다.", symbol: "✖️" },
  { id: 20, name: "하이퍼 부메랑", type: "pierce", price: 60000, dmg: 35, cooldown: 1200, desc: "돌아올 때 속도가 훨씬 빨라지는 특수 날개를 날립니다.", symbol: "🌀" },

  // 21-30: Legendary Weapons (High Cost)
  { id: 21, name: "용잡이 검기", type: "hit", price: 150000, dmg: 180, cooldown: 600, desc: "전방으로 화면 절반 크기의 거대 검기를 격발합니다.", symbol: "🐉" },
  { id: 22, name: "네이팜 런처", type: "splash", price: 180000, dmg: 200, cooldown: 2200, desc: "거대 유탄 폭발 후 넓은 화염 지대를 5초간 남긴다.", symbol: "🔥" },
  { id: 23, name: "테슬라 퓨전건", type: "homing", price: 220000, dmg: 110, cooldown: 800, desc: "가까운 적 최대 10명에게 번개를 튕기며 감전시킵니다.", symbol: "⚡" },
  { id: 24, name: "플라스마 레일건", type: "pierce", price: 270000, dmg: 250, cooldown: 2000, desc: "지나가는 자리에 궤적 폭발을 남기는 광선을 발사합니다.", symbol: "🌐" },
  { id: 25, name: "블랙홀 바운서", type: "homing", price: 320000, dmg: 90, cooldown: 2500, desc: "적들을 모아서 분쇄하는 블랙홀 중력장을 소환합니다.", symbol: "🕳️" },
  { id: 26, name: "보이드 나이프", type: "pierce", price: 380000, dmg: 140, cooldown: 500, desc: "적을 관통할 때마다 보라색 차원 폭발을 연쇄 격발합니다.", symbol: "🔪" },
  { id: 27, name: "원소 마법 포털", type: "splash", price: 450000, dmg: 160, cooldown: 1500, desc: "빙결, 화염, 전격 마법 탄환을 전방위로 무차별 방출합니다.", symbol: "🌀" },
  { id: 28, name: "발키리 미사일", type: "homing", price: 520000, dmg: 100, cooldown: 900, desc: "8발의 마이크로 미사일을 소환해 화면의 적을 자동 격추합니다.", symbol: "🚀" },
  { id: 29, name: "타키온 블레이드", type: "pierce", price: 600000, dmg: 300, cooldown: 2400, desc: "플레이어가 순간 전방 대시하며 선상의 적을 모두 벱니다.", symbol: "🌌" },
  { id: 30, name: "인피니티 슈터", type: "splash", price: 800000, dmg: 400, cooldown: 3000, desc: "최종 결전 무기. 화면 전체를 뒤덮는 수식의 폭발을 일으킵니다.", symbol: "♾️" }
];

// Stat upgrades configuration
export const UPGRADES_DB = [
  { key: "maxHp", name: "최대 체력 증가", desc: "체력이 증가하여 더 많이 버틸 수 있습니다.", baseCost: 500, costMultiplier: 1.5, statAdd: 20, maxLevel: 10, symbol: "❤️" },
  { key: "atk", name: "공격력 증가", desc: "모든 무기 공격의 공격력을 상승시킵니다.", baseCost: 600, costMultiplier: 1.6, statAdd: 5, maxLevel: 10, symbol: "✊" },
  { key: "def", name: "방어력 증가", desc: "몬스터로부터 받는 충돌 및 피격 데미지를 경감시킵니다.", baseCost: 500, costMultiplier: 1.5, statAdd: 2, maxLevel: 10, symbol: "🛡️" },
  { key: "magnet", name: "자석 흡입 범위", desc: "보석과 회복 아이템을 흡수하는 거리를 늘립니다.", baseCost: 400, costMultiplier: 1.4, statAdd: 15, maxLevel: 10, symbol: "🧲" },
  { key: "goldBonus", name: "보너스 골드 획득", desc: "정답 획득 및 클리어 보너스 골드 비율이 오릅니다.", baseCost: 800, costMultiplier: 1.7, statAdd: 0.1, maxLevel: 10, symbol: "🪙" } // +10% per level
];

// Default Save State
const DEFAULT_STATE = {
  gold: 0,
  equippedWeaponIds: [1], // Up to 3 equipped weapons
  ownedWeaponIds: [1], // Has training katana
  weaponLevels: { 1: 1 },
  upgrades: {
    maxHp: 0,     // Level 0
    atk: 0,
    def: 0,
    magnet: 0,
    goldBonus: 0
  },
  wrongAreas: [] // Cumulative weak math areas
};

// Global Store State
let state = { ...DEFAULT_STATE };

function isDebugMode() {
  return typeof window !== 'undefined' && window.location.search.includes('debug=true');
}

function applyDebugState() {
  state.ownedWeaponIds = WEAPONS_DB.map(w => w.id);
  state.equippedWeaponIds = [1, 2, 5]; // Katana, Revolver, Shuriken
  state.weaponLevels = Object.fromEntries(WEAPONS_DB.map(w => [w.id, 1]));
  state.gold = 999999;
}

// Load state from LocalStorage
export function loadState() {
  const data = localStorage.getItem("math_fighter_save");
  if (data) {
    try {
      state = JSON.parse(data);
      // Fallback check in case of structure changes
      if (!state.ownedWeaponIds) state.ownedWeaponIds = [1];
      state.ownedWeaponIds = state.ownedWeaponIds.map(Number);

      if (!state.equippedWeaponIds) {
        state.equippedWeaponIds = [state.equippedWeaponId || 1];
      }
      state.equippedWeaponIds = state.equippedWeaponIds
        .map(Number)
        .filter(id => state.ownedWeaponIds.includes(id))
        .slice(0, 3);
      if (state.equippedWeaponIds.length === 0) state.equippedWeaponIds = [1];
      delete state.equippedWeaponId;
      if (!state.upgrades) state.upgrades = { ...DEFAULT_STATE.upgrades };
      if (!state.wrongAreas) state.wrongAreas = [];
      if (!state.weaponLevels) state.weaponLevels = {};
      state.ownedWeaponIds.forEach(id => {
        const numericId = Number(id);
        state.weaponLevels[numericId] = Math.max(1, Math.min(10, Number(state.weaponLevels[numericId]) || 1));
      });
    } catch (e) {
      state = { ...DEFAULT_STATE };
    }
  } else {
    state = { ...DEFAULT_STATE };
  }
  
  // Debug Override Mode
  if (isDebugMode()) {
    applyDebugState();
  }

  if (typeof window !== 'undefined') {
    window.gameStateStore = state;
  }
  return state;
}

// Save state to LocalStorage
export function saveState() {
  localStorage.setItem("math_fighter_save", JSON.stringify(state));
}

// Reset state
export function resetState() {
  state = JSON.parse(JSON.stringify(DEFAULT_STATE));
  if (isDebugMode()) {
    applyDebugState();
  }
  if (typeof window !== 'undefined') {
    window.gameStateStore = state;
  }
  saveState();
  return state;
}

// Getters
export function getGold() { return state.gold; }
export function addGold(amount) {
  const bonus = 1 + getStatValue("goldBonus");
  state.gold += Math.floor(amount * bonus);
  saveState();
}
export function subtractGold(amount) {
  if (state.gold >= amount) {
    state.gold -= amount;
    saveState();
    return true;
  }
  return false;
}

export function getEquippedWeapon() {
  return getEquippedWeapons()[0] || WEAPONS_DB[0];
}

export function getEquippedWeapons() {
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem("math_fighter_save");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.equippedWeaponIds) {
          state.equippedWeaponIds = parsed.equippedWeaponIds.map(Number);
        }
      } catch (e) {}
    }
  }

  const ids = state.equippedWeaponIds || [state.equippedWeaponId || 1];
  return ids
    .map(id => {
      const numericId = Number(id);
      return WEAPONS_DB.find(w => w.id === numericId);
    })
    .filter(Boolean)
    .slice(0, 3);
}

export function equipWeapon(id) {
  const numericId = Number(id);
  if (!state.ownedWeaponIds.map(Number).includes(numericId)) return false;

  if (!state.equippedWeaponIds) state.equippedWeaponIds = [state.equippedWeaponId || 1];
  state.equippedWeaponIds = state.equippedWeaponIds.map(Number);

  const currentIndex = state.equippedWeaponIds.indexOf(numericId);
  if (currentIndex >= 0) {
    if (state.equippedWeaponIds.length <= 1) return false;
    state.equippedWeaponIds.splice(currentIndex, 1);
  } else if (state.equippedWeaponIds.length < 3) {
    state.equippedWeaponIds.push(numericId);
  } else {
    state.equippedWeaponIds[2] = numericId;
  }

  state.equippedWeaponIds = state.equippedWeaponIds.slice(0, 3);
  delete state.equippedWeaponId;
  saveState();
  return true;
}

export function getOwnedWeapons() {
  return state.ownedWeaponIds;
}

export function getWeaponLevel(id) {
  const numericId = Number(id);
  if (!state.weaponLevels) state.weaponLevels = {};
  return Math.max(1, Math.min(10, Number(state.weaponLevels[numericId]) || 1));
}

export function getWeaponUpgradeCost(id) {
  const numericId = Number(id);
  const weapon = WEAPONS_DB.find(w => w.id === numericId);
  if (!weapon) return Infinity;
  const level = getWeaponLevel(numericId);
  if (level >= 10) return Infinity;
  const baseCost = Math.max(350, weapon.price * 0.42) * Math.pow(1.62, level - 1);
  return Math.floor(baseCost * 0.5);
}

export function getWeaponUpgradeSummary(id) {
  const level = getWeaponLevel(id);
  const bonus = level - 1;
  return {
    level,
    maxLevel: 10,
    damagePercent: bonus * 10,
    sizePercent: bonus * 6,
    projectileBonus: Math.floor(bonus / 3),
    splashPercent: bonus * 8
  };
}

// Purchase weapon
export function purchaseWeapon(id) {
  const numericId = Number(id);
  const weapon = WEAPONS_DB.find(w => w.id === numericId);
  if (!weapon) return false;
  if (state.ownedWeaponIds.map(Number).includes(numericId)) return false;

  if (subtractGold(weapon.price)) {
    state.ownedWeaponIds = state.ownedWeaponIds.map(Number);
    state.ownedWeaponIds.push(numericId);
    if (!state.weaponLevels) state.weaponLevels = {};
    state.weaponLevels[numericId] = 1;
    if (!state.equippedWeaponIds) state.equippedWeaponIds = [state.equippedWeaponId || 1];
    state.equippedWeaponIds = state.equippedWeaponIds.map(Number);
    
    if (!state.equippedWeaponIds.includes(numericId)) {
      if (state.equippedWeaponIds.length < 3) {
        state.equippedWeaponIds.push(numericId);
      } else {
        state.equippedWeaponIds[2] = numericId;
      }
    }
    delete state.equippedWeaponId;
    saveState();
    return true;
  }
  return false;
}

export function upgradeWeapon(id) {
  const numericId = Number(id);
  if (!state.ownedWeaponIds.map(Number).includes(numericId)) return false;
  if (!state.weaponLevels) state.weaponLevels = {};
  const currentLevel = getWeaponLevel(numericId);
  if (currentLevel >= 10) return false;

  const cost = getWeaponUpgradeCost(numericId);
  if (subtractGold(cost)) {
    state.weaponLevels[numericId] = currentLevel + 1;
    saveState();
    return true;
  }
  return false;
}

// Get cost of upgrades
export function getUpgradeCost(key) {
  const dbItem = UPGRADES_DB.find(u => u.key === key);
  const currentLvl = state.upgrades[key] || 0;
  if (currentLvl >= dbItem.maxLevel) return Infinity;
  return Math.floor(dbItem.baseCost * Math.pow(dbItem.costMultiplier, currentLvl));
}

// Get stat current level
export function getUpgradeLevel(key) {
  return state.upgrades[key] || 0;
}

// Get total added stat value
export function getStatValue(key) {
  const dbItem = UPGRADES_DB.find(u => u.key === key);
  const currentLvl = state.upgrades[key] || 0;
  return currentLvl * dbItem.statAdd;
}

// Purchase Upgrade
export function purchaseUpgrade(key) {
  const dbItem = UPGRADES_DB.find(u => u.key === key);
  const currentLvl = state.upgrades[key] || 0;
  
  if (currentLvl >= dbItem.maxLevel) return false;
  
  const cost = getUpgradeCost(key);
  if (subtractGold(cost)) {
    state.upgrades[key] = currentLvl + 1;
    saveState();
    return true;
  }
  return false;
}

// Record wrong area answer for exam evaluation
export function recordWrongArea(areaId) {
  if (!state.wrongAreas.includes(areaId)) {
    state.wrongAreas.push(areaId);
    // Limit store size to 3 unique weak areas
    if (state.wrongAreas.length > 3) {
      state.wrongAreas.shift();
    }
    saveState();
  }
}

// Clear wrong areas after exam completion
export function clearWrongAreas() {
  state.wrongAreas = [];
  saveState();
}

export function getWrongAreas() {
  return state.wrongAreas;
}
