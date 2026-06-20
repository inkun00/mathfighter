const SPLASH_PERSISTENT_BEHAVIORS = new Set(['throw_fire', 'shockwave', 'nova']);
const BOSS_PERSISTENT_BEHAVIORS = new Set(['pierce', 'boomerang', 'shockwave', 'nova']);

export function distanceBetween(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function circlesOverlap(a, b) {
  return distanceBetween(a, b) < a.radius + b.radius;
}

export function getDistanceToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const abLenSq = abx * abx + aby * aby;
  const t = abLenSq === 0 ? 0 : Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLenSq));
  const closestX = ax + abx * t;
  const closestY = ay + aby * t;
  return Math.hypot(px - closestX, py - closestY);
}

export function resolvePlayerProjectileUpdates({ projectiles, monsters, player }) {
  projectiles.forEach(projectile => {
    projectile.update(monsters, { x: player.x, y: player.y });
  });
  return projectiles.filter(projectile => !projectile.isDead);
}

export function applyProjectileImpact(target, projectile, damageScale = 1) {
  if (!target || target.hp <= 0) return;
  target.takeDamage(projectile.dmg * damageScale);
  if (typeof target.applyStatusEffect === 'function') {
    target.applyStatusEffect(projectile.statusEffect);
  }
}

function canDamageBoss(boss) {
  return Boolean(boss && (!boss.isGimmickActive || boss.stage !== 10));
}

function defeatMonsterIfNeeded(monster, onMonsterDefeat) {
  if (monster.hp <= 0) onMonsterDefeat(monster);
}

function applyMonsterSplash({
  monsters,
  projectile,
  excludedMonster = null,
  damageScale,
  hitEffectScale,
  onMonsterDefeat,
  onHitEffect
}) {
  monsters.forEach(monster => {
    if (monster === excludedMonster || monster.hp <= 0) return;
    if (distanceBetween(monster, projectile) >= projectile.splashRadius) return;

    applyProjectileImpact(monster, projectile, damageScale);
    onHitEffect(monster.x, monster.y, projectile, hitEffectScale);
    defeatMonsterIfNeeded(monster, onMonsterDefeat);
  });
}

function resolveRailLaser(projectile, monsters, boss, onMonsterDefeat, onHitEffect) {
  const endX = projectile.x + Math.cos(projectile.angle) * projectile.maxRange;
  const endY = projectile.y + Math.sin(projectile.angle) * projectile.maxRange;

  monsters.forEach(monster => {
    if (monster.hp <= 0 || projectile.hitTargets?.has(monster)) return;
    const distance = getDistanceToSegment(
      monster.x,
      monster.y,
      projectile.x,
      projectile.y,
      endX,
      endY
    );
    if (distance >= monster.radius + projectile.radius) return;

    projectile.hitTargets?.add(monster);
    applyProjectileImpact(monster, projectile, 1.08);
    onHitEffect(monster.x, monster.y, projectile, 0.85);
    defeatMonsterIfNeeded(monster, onMonsterDefeat);
  });

  if (!canDamageBoss(boss) || projectile.hitTargets?.has(boss)) return;
  const distance = getDistanceToSegment(
    boss.x,
    boss.y,
    projectile.x,
    projectile.y,
    endX,
    endY
  );
  if (distance >= boss.radius + projectile.radius) return;

  projectile.hitTargets?.add(boss);
  boss.takeDamage(projectile.dmg * 0.75);
  onHitEffect(boss.x, boss.y, projectile, 1.25);
}

function resolveFirePatch(projectile, monsters, boss, now, onMonsterDefeat, onHitEffect) {
  if (!projectile.canApplyAreaTick(now)) return;

  monsters.forEach(monster => {
    if (monster.hp <= 0) return;
    if (distanceBetween(monster, projectile) >= monster.radius + projectile.splashRadius) return;

    applyProjectileImpact(monster, projectile, projectile.id >= 22 ? 0.32 : 0.22);
    onHitEffect(monster.x, monster.y, projectile, 0.45);
    defeatMonsterIfNeeded(monster, onMonsterDefeat);
  });

  if (!canDamageBoss(boss)) return;
  if (distanceBetween(boss, projectile) >= boss.radius + projectile.splashRadius) return;

  boss.takeDamage(projectile.dmg * (projectile.id >= 22 ? 0.24 : 0.16));
  onHitEffect(boss.x, boss.y, projectile, 0.65);
}

function resolveMonsterHits(projectile, monsters, onMonsterDefeat, onHitEffect) {
  monsters.forEach(monster => {
    if (monster.hp <= 0 || projectile.isDead) return;
    if (projectile.isParabolic && projectile.z > 0) return;
    if (projectile.hitTargets?.has(monster)) return;
    if (!circlesOverlap(monster, projectile)) return;

    projectile.hitTargets?.add(monster);
    applyProjectileImpact(monster, projectile);
    onHitEffect(projectile.x, projectile.y, projectile);
    projectile.hitCount++;

    if (projectile.behavior === 'throw_fire') {
      projectile.activateFirePatch();
    }

    if (projectile.splashRadius > 0 && projectile.behavior !== 'fire_patch') {
      applyMonsterSplash({
        monsters,
        projectile,
        excludedMonster: monster,
        damageScale: projectile.id >= 21 ? 0.86 : 0.7,
        hitEffectScale: 0.65,
        onMonsterDefeat,
        onHitEffect
      });
      if (!SPLASH_PERSISTENT_BEHAVIORS.has(projectile.behavior)) projectile.isDead = true;
    }

    defeatMonsterIfNeeded(monster, onMonsterDefeat);

    if (
      projectile.hitCount >= projectile.pierceLimit &&
      !['throw_fire', 'fire_patch'].includes(projectile.behavior)
    ) {
      projectile.isDead = true;
    }
  });
}

function resolveBossHit(projectile, monsters, boss, onMonsterDefeat, onHitEffect) {
  if (!canDamageBoss(boss) || projectile.isDead) return;
  if (projectile.isParabolic && projectile.z > 0) return;
  if (projectile.hitTargets?.has(boss)) return;
  if (!circlesOverlap(boss, projectile)) return;

  projectile.hitTargets?.add(boss);
  boss.takeDamage(projectile.dmg);
  onHitEffect(projectile.x, projectile.y, projectile, 1.2);

  if (projectile.behavior === 'throw_fire') {
    projectile.activateFirePatch();
    return;
  }

  if (projectile.splashRadius > 0) {
    applyMonsterSplash({
      monsters,
      projectile,
      damageScale: projectile.id >= 21 ? 0.72 : 0.55,
      hitEffectScale: 0.65,
      onMonsterDefeat,
      onHitEffect
    });
  }

  if (!BOSS_PERSISTENT_BEHAVIORS.has(projectile.behavior)) {
    projectile.isDead = true;
  } else {
    projectile.hitCount++;
    if (projectile.hitCount >= projectile.pierceLimit) projectile.isDead = true;
  }
}

export function resolveProjectileCollisions({
  projectiles,
  monsters,
  boss,
  now = Date.now(),
  onMonsterDefeat,
  onHitEffect
}) {
  projectiles.forEach(projectile => {
    if (projectile.behavior === 'rail_laser') {
      resolveRailLaser(projectile, monsters, boss, onMonsterDefeat, onHitEffect);
      return;
    }

    if (projectile.behavior === 'fire_patch') {
      resolveFirePatch(projectile, monsters, boss, now, onMonsterDefeat, onHitEffect);
      return;
    }

    resolveMonsterHits(projectile, monsters, onMonsterDefeat, onHitEffect);
    resolveBossHit(projectile, monsters, boss, onMonsterDefeat, onHitEffect);
  });
}
