const SPECIAL_BEHAVIORS = new Map([
  [4, 'boomerang'],
  [6, 'throw_fire'],
  [8, 'cone_blast'],
  [11, 'cone_blast'],
  [13, 'rail_laser'],
  [14, 'mine'],
  [16, 'orbit'],
  [17, 'throw_fire'],
  [18, 'shockwave'],
  [19, 'spread'],
  [20, 'boomerang'],
  [21, 'cone_blast'],
  [22, 'throw_fire'],
  [23, 'chain_lightning'],
  [24, 'plasma_rail'],
  [25, 'gravity_well'],
  [26, 'void_pierce'],
  [27, 'elemental_burst'],
  [28, 'missile_swarm'],
  [29, 'dash_wave'],
  [30, 'nova']
]);

const VISUAL_COLORS = ['#00ffff', '#39ff14', '#ff3df2', '#ffd166', '#ff7a00', '#ffffff'];

export function getWeaponBehavior(id, type) {
  if (SPECIAL_BEHAVIORS.has(id)) return SPECIAL_BEHAVIORS.get(id);
  if (id === 3 || id === 12) return 'spread';
  if ([5, 7].includes(id) || type === 'pierce') return 'pierce';
  if ([2, 9, 15].includes(id) || type === 'homing') return 'homing';
  if (type === 'splash') return 'explosive';
  return 'straight';
}

export function getWeaponPowerScale(id) {
  if (id >= 30) return 2.4;
  if (id >= 27) return 2;
  if (id >= 24) return 1.75;
  if (id >= 21) return 1.55;
  if (id >= 18) return 1.35;
  if (id >= 11) return 1.18;
  return 1;
}

export function getWeaponTierMultiplier(id) {
  if (id >= 21) return 1.18;
  if (id >= 11) return 1.08;
  return 1;
}

export function getWeaponPatternProfile(id, behavior, projectileBonus = 0) {
  if (['cone_blast', 'dash_wave'].includes(behavior)) {
    return {
      count: (id >= 21 ? 9 : id >= 11 ? 7 : 5) + projectileBonus,
      damageScale: id >= 21 ? 0.7 : 0.62
    };
  }
  if (['spread', 'elemental_burst', 'missile_swarm'].includes(behavior)) {
    return {
      count: (id >= 28 ? 8 : id >= 19 ? 5 : 3) + projectileBonus,
      damageScale: id === 12 ? 0.82 : id >= 28 ? 0.72 : 0.65
    };
  }
  if (behavior === 'shockwave') return { count: 12 + projectileBonus * 2, damageScale: 0.62 };
  if (behavior === 'nova') return { count: 14 + projectileBonus * 2, damageScale: 0.8 };
  if (behavior === 'orbit') return { count: 3 + projectileBonus, damageScale: 0.7 };
  if (behavior === 'mine') return { count: 1 + projectileBonus, damageScale: 0.85 };
  if (behavior === 'throw_fire') {
    return { count: (id >= 22 ? 3 : 1) + projectileBonus, damageScale: id >= 22 ? 0.95 : 1 };
  }
  return { count: 1, damageScale: 1 };
}

function getFocusFactor(id, behavior) {
  if (['cone_blast', 'dash_wave'].includes(behavior)) return 0.36;
  if (['spread', 'elemental_burst'].includes(behavior)) return 0.46;
  if (behavior === 'missile_swarm') return 0.88;
  if (['shockwave', 'nova'].includes(behavior)) return 0.18;
  if (behavior === 'orbit') return 0.55;
  return 1;
}

function getUtilityMultiplier(id, behavior) {
  if (behavior === 'boomerang') return id >= 20 ? 1.8 : 1.55;
  if (behavior === 'throw_fire') return id >= 22 ? 2.2 : 1.9;
  if (behavior === 'chain_lightning') return 2.6;
  if (behavior === 'plasma_rail') return 1.65;
  if (behavior === 'gravity_well') return 3;
  if (behavior === 'void_pierce') return 1.55;
  return 1;
}

export function getWeaponBalanceMetrics(weapon, level = 1) {
  const behavior = getWeaponBehavior(weapon.id, weapon.type);
  const projectileBonus = Math.floor((Math.max(1, level) - 1) / 3);
  const pattern = getWeaponPatternProfile(weapon.id, behavior, projectileBonus);
  const levelScale = 1 + (Math.max(1, level) - 1) * 0.1;
  const baseShotDamage = weapon.dmg
    * getWeaponPowerScale(weapon.id)
    * getWeaponTierMultiplier(weapon.id)
    * levelScale;
  const areaDps = baseShotDamage
    * pattern.count
    * pattern.damageScale
    * getUtilityMultiplier(weapon.id, behavior)
    * 1000
    / weapon.cooldown;
  const focusDps = areaDps * getFocusFactor(weapon.id, behavior);

  return {
    behavior,
    projectileCount: pattern.count,
    focusDps: Math.round(focusDps),
    areaDps: Math.round(areaDps),
    priceEfficiency: Number((focusDps / Math.max(1, weapon.price) * 1000).toFixed(2))
  };
}

export function getWeaponVisualProfile(id) {
  const progress = Math.max(0, Math.min(1, (id - 1) / 29));
  const rank = Math.min(6, 1 + Math.floor(progress * 6));
  return {
    rank,
    color: VISUAL_COLORS[rank - 1],
    drawSize: Math.round(28 + progress * 22),
    glowBlur: Math.round(7 + progress * 27),
    trailCount: Math.floor(progress * 6),
    impactScale: Number((0.8 + progress * 1.35).toFixed(2)),
    lifeTime: Math.round(250 + progress * 430)
  };
}

export function getWeaponRange(id, behavior) {
  if (['rail_laser', 'plasma_rail'].includes(behavior)) return 1600;
  if (behavior === 'gravity_well') return 280;
  if (behavior === 'throw_fire') return id >= 22 ? 240 : 180;
  if (['cone_blast', 'dash_wave'].includes(behavior)) return id >= 21 ? 250 : 210;
  if (behavior === 'shockwave') return 250;
  if (behavior === 'nova') return 340;
  if (['spread', 'elemental_burst', 'missile_swarm'].includes(behavior)) return 280;
  if (behavior === 'orbit') return 170;
  if (behavior === 'mine') return 150;
  if (['pierce', 'void_pierce'].includes(behavior)) return id >= 24 ? 560 : 450;
  if (['homing', 'chain_lightning'].includes(behavior)) return 460;
  return 380;
}

export function getWeaponFireStyleLabel(id, type) {
  const labels = {
    straight: '직선 발사',
    homing: '유도탄',
    spread: '다중 산탄',
    boomerang: '왕복 회전',
    throw_fire: '투척 화염장',
    cone_blast: '부채꼴 파동',
    rail_laser: '화면 관통 레이저',
    mine: '지연 폭발 지뢰',
    orbit: '회전 궤도탄',
    shockwave: '전방위 충격파',
    chain_lightning: '연쇄 번개',
    plasma_rail: '궤적 폭발 광선',
    gravity_well: '지속 중력장',
    void_pierce: '차원 폭발 관통',
    elemental_burst: '원소 부채 산탄',
    missile_swarm: '전방위 유도 군집',
    dash_wave: '초대형 대시 파동',
    nova: '화면 전역 노바',
    pierce: '관통탄',
    explosive: '충돌 폭발'
  };
  return labels[getWeaponBehavior(id, type)] || '직선 발사';
}

export function getWeaponRangeLabel(id, type) {
  const behavior = getWeaponBehavior(id, type);
  if (['rail_laser', 'plasma_rail'].includes(behavior)) return '화면 끝';
  if (['throw_fire', 'cone_blast', 'dash_wave', 'mine', 'gravity_well', 'nova'].includes(behavior)) return '근거리';
  if (['spread', 'elemental_burst', 'missile_swarm', 'orbit', 'shockwave'].includes(behavior)) return '중거리';
  return '장거리';
}
