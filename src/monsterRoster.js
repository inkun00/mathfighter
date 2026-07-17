const FAMILY_ROSTERS = {
  slime: [
    { id: 'acid_slime', name: 'Acid Slime', pattern: 'debuff', rank: 1, speed: 1.25, maxHp: 34, atk: 9, color: '#8cff4a', spriteSize: 58, radius: 15 },
    { id: 'frost_slime', name: 'Frost Slime', pattern: 'sniper', rank: 2, speed: 1.05, maxHp: 58, atk: 13, color: '#8ee8ff', spriteSize: 60, radius: 16 },
    { id: 'void_slime', name: 'Void Slime', pattern: 'zigzag', rank: 3, speed: 1.65, maxHp: 82, atk: 18, color: '#9b5cff', spriteSize: 64, radius: 17 },
    { id: 'magma_slime', name: 'Magma Slime', pattern: 'bomb', rank: 4, speed: 1.25, maxHp: 120, atk: 30, color: '#ff6a2a', spriteSize: 68, radius: 19, isElite: true },
    { id: 'storm_slime', name: 'Storm Slime', pattern: 'orbit', rank: 5, speed: 1.45, maxHp: 170, atk: 30, color: '#5ac8ff', spriteSize: 72, radius: 21, isElite: true }
  ],
  zombie: [
    { id: 'grunt_zombie', name: 'Grunt Zombie', pattern: 'charge', rank: 1, speed: 1.15, maxHp: 48, atk: 12, color: '#8fb36a', spriteSize: 64, radius: 16 },
    { id: 'plague_zombie', name: 'Plague Zombie', pattern: 'regen', rank: 2, speed: 0.95, maxHp: 90, atk: 16, color: '#b0d957', spriteSize: 66, radius: 17 },
    { id: 'runner_zombie', name: 'Runner Zombie', pattern: 'rush', rank: 3, speed: 1.9, maxHp: 78, atk: 20, color: '#ff9a38', spriteSize: 66, radius: 17 },
    { id: 'armored_zombie', name: 'Armored Zombie', pattern: 'shield', rank: 4, speed: 0.85, maxHp: 210, atk: 28, color: '#6fb2d8', spriteSize: 76, radius: 22, isElite: true },
    { id: 'berserker_zombie', name: 'Berserker Zombie', pattern: 'rush', rank: 5, speed: 1.55, maxHp: 260, atk: 40, color: '#ff2d5f', spriteSize: 80, radius: 24, isElite: true }
  ],
  skeleton: [
    { id: 'bone_scout', name: 'Bone Scout', pattern: 'charge', rank: 1, speed: 1.45, maxHp: 42, atk: 11, color: '#e8ddc4', spriteSize: 62, radius: 15 },
    { id: 'bone_archer', name: 'Bone Archer', pattern: 'sniper', rank: 2, speed: 1.1, maxHp: 62, atk: 15, color: '#8edcff', spriteSize: 64, radius: 16 },
    { id: 'rune_skeleton_mage', name: 'Rune Skeleton Mage', pattern: 'orbit', rank: 3, speed: 1.0, maxHp: 88, atk: 19, color: '#7666ff', spriteSize: 68, radius: 18 },
    { id: 'bone_guardian', name: 'Bone Guardian', pattern: 'shield', rank: 4, speed: 0.8, maxHp: 190, atk: 26, color: '#596575', spriteSize: 78, radius: 22, isElite: true },
    { id: 'bone_reaper', name: 'Crimson Bone Reaper', pattern: 'rush', rank: 5, speed: 1.5, maxHp: 230, atk: 38, color: '#a62942', spriteSize: 82, radius: 24, isElite: true }
  ],
  golem: [
    { id: 'pebble_golem', name: 'Pebble Golem', pattern: 'charge', rank: 1, speed: 0.8, maxHp: 60, atk: 10, color: '#8c9079', spriteSize: 64, radius: 17 },
    { id: 'crystal_golem', name: 'Crystal Golem', pattern: 'sniper', rank: 2, speed: 0.75, maxHp: 95, atk: 16, color: '#35c9ee', spriteSize: 68, radius: 19 },
    { id: 'moss_golem', name: 'Moss Guardian Golem', pattern: 'regen', rank: 3, speed: 0.65, maxHp: 150, atk: 20, color: '#65a947', spriteSize: 74, radius: 21 },
    { id: 'iron_golem', name: 'Iron Bastion Golem', pattern: 'shield', rank: 4, speed: 0.6, maxHp: 260, atk: 30, color: '#525c68', spriteSize: 82, radius: 25, isElite: true },
    { id: 'lava_golem', name: 'Lava Colossus Golem', pattern: 'bomb', rank: 5, speed: 0.8, maxHp: 300, atk: 45, color: '#ff6728', spriteSize: 86, radius: 27, isElite: true }
  ],
  spirit: [
    { id: 'mist_wisp', name: 'Mist Wisp', pattern: 'zigzag', rank: 1, speed: 1.75, maxHp: 30, atk: 10, color: '#bdf7ff', spriteSize: 58, radius: 14 },
    { id: 'frost_wraith', name: 'Frost Wraith', pattern: 'sniper', rank: 2, speed: 1.35, maxHp: 55, atk: 15, color: '#74bfff', spriteSize: 64, radius: 16 },
    { id: 'venom_specter', name: 'Venom Specter', pattern: 'zigzag', rank: 3, speed: 1.5, maxHp: 80, atk: 19, color: '#8fe83f', spriteSize: 68, radius: 17 },
    { id: 'tempest_djinn', name: 'Tempest Djinn', pattern: 'orbit', rank: 4, speed: 1.6, maxHp: 130, atk: 28, color: '#38a8ff', spriteSize: 78, radius: 21, isElite: true },
    { id: 'void_revenant', name: 'Void Revenant', pattern: 'rush', rank: 5, speed: 1.7, maxHp: 200, atk: 42, color: '#7f3dff', spriteSize: 82, radius: 23, isElite: true }
  ],
  robot: [
    { id: 'scrap_drone', name: 'Scrap Drone', pattern: 'charge', rank: 1, speed: 1.5, maxHp: 40, atk: 12, color: '#8fa8b8', spriteSize: 60, radius: 15 },
    { id: 'bolt_turret', name: 'Bolt Turret', pattern: 'sniper', rank: 2, speed: 0.8, maxHp: 70, atk: 17, color: '#55bfff', spriteSize: 66, radius: 17 },
    { id: 'repair_automaton', name: 'Repair Automaton', pattern: 'regen', rank: 3, speed: 1.1, maxHp: 105, atk: 20, color: '#63d66b', spriteSize: 70, radius: 19 },
    { id: 'blast_mech', name: 'Blast Mech', pattern: 'bomb', rank: 4, speed: 0.9, maxHp: 180, atk: 32, color: '#f05b32', spriteSize: 78, radius: 22, isElite: true },
    { id: 'titan_automaton', name: 'Titan Automaton', pattern: 'shield', rank: 5, speed: 0.75, maxHp: 300, atk: 44, color: '#d7a53a', spriteSize: 86, radius: 26, isElite: true }
  ]
};

export const MONSTER_ROSTER = Object.entries(FAMILY_ROSTERS).flatMap(([family, monsters]) =>
  monsters.map(monster => ({
    ...monster,
    family,
    sheet: `/assets/monsters/monster_${monster.id}_sheet.webp`
  }))
);

export const MONSTER_FAMILIES = Object.freeze(Object.keys(FAMILY_ROSTERS));
