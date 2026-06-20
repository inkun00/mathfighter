import assert from 'node:assert/strict';
import test from 'node:test';
import {
  circlesOverlap,
  distanceBetween,
  getDistanceToSegment,
  resolveProjectileCollisions
} from '../src/combatResolver.js';

function createTarget(overrides = {}) {
  return {
    x: 0,
    y: 0,
    radius: 10,
    hp: 100,
    damageTaken: [],
    statusEffects: [],
    takeDamage(amount) {
      this.damageTaken.push(amount);
      this.hp -= amount;
    },
    applyStatusEffect(effect) {
      this.statusEffects.push(effect);
    },
    ...overrides
  };
}

function createProjectile(overrides = {}) {
  return {
    id: 1,
    x: 0,
    y: 0,
    radius: 4,
    dmg: 10,
    behavior: 'straight',
    angle: 0,
    maxRange: 100,
    splashRadius: 0,
    hitTargets: new WeakSet(),
    hitCount: 0,
    pierceLimit: 1,
    isDead: false,
    isParabolic: false,
    z: 0,
    statusEffect: { type: 'burn' },
    ...overrides
  };
}

function resolve({ projectile, monsters = [], boss = null }) {
  const defeated = [];
  const effects = [];
  resolveProjectileCollisions({
    projectiles: [projectile],
    monsters,
    boss,
    now: 1000,
    onMonsterDefeat: monster => defeated.push(monster),
    onHitEffect: (...args) => effects.push(args)
  });
  return { defeated, effects };
}

test('calculates point, circle, and segment distances', () => {
  assert.equal(distanceBetween({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
  assert.equal(circlesOverlap(
    { x: 0, y: 0, radius: 5 },
    { x: 9, y: 0, radius: 5 }
  ), true);
  assert.equal(circlesOverlap(
    { x: 0, y: 0, radius: 5 },
    { x: 10, y: 0, radius: 5 }
  ), false);
  assert.equal(getDistanceToSegment(5, 3, 0, 0, 10, 0), 3);
});

test('applies a standard projectile hit and defeat exactly once', () => {
  const monster = createTarget({ hp: 5 });
  const projectile = createProjectile();
  const result = resolve({ projectile, monsters: [monster] });

  assert.equal(monster.hp, -5);
  assert.deepEqual(monster.statusEffects, [{ type: 'burn' }]);
  assert.equal(projectile.hitCount, 1);
  assert.equal(projectile.isDead, true);
  assert.deepEqual(result.defeated, [monster]);
  assert.equal(result.effects.length, 1);
});

test('applies explosive splash damage to nearby monsters', () => {
  const primary = createTarget({ x: 0, hp: 100 });
  const nearby = createTarget({ x: 20, hp: 100 });
  const outside = createTarget({ x: 80, hp: 100 });
  const projectile = createProjectile({
    id: 21,
    behavior: 'explosive',
    splashRadius: 50
  });

  resolve({ projectile, monsters: [primary, nearby, outside] });

  assert.equal(primary.damageTaken[0], 10);
  assert.equal(nearby.damageTaken[0], 8.6);
  assert.equal(outside.damageTaken.length, 0);
  assert.equal(projectile.isDead, true);
});

test('rail laser hits monsters on its segment but respects the stage 10 boss shield', () => {
  const monster = createTarget({ x: 50, y: 5, radius: 5 });
  const boss = createTarget({
    x: 60,
    y: 0,
    radius: 20,
    stage: 10,
    isGimmickActive: true
  });
  const projectile = createProjectile({
    behavior: 'rail_laser',
    radius: 1,
    maxRange: 100
  });

  resolve({ projectile, monsters: [monster], boss });

  assert.equal(monster.damageTaken[0], 10.8);
  assert.equal(boss.damageTaken.length, 0);
});

test('fire patches tick against monsters and an unshielded boss', () => {
  const monster = createTarget({ x: 20, hp: 100 });
  const boss = createTarget({ x: 20, hp: 100, stage: 20, isGimmickActive: false });
  const projectile = createProjectile({
    id: 22,
    behavior: 'fire_patch',
    dmg: 100,
    splashRadius: 30,
    canApplyAreaTick: now => now === 1000
  });

  resolve({ projectile, monsters: [monster], boss });

  assert.equal(monster.damageTaken[0], 32);
  assert.equal(boss.damageTaken[0], 24);
});
