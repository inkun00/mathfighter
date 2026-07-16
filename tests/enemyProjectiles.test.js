import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createEnemyProjectileVolley,
  ENEMY_PROJECTILE_PROFILES,
  MonsterProjectile
} from '../src/enemyProjectiles.js';
import { MONSTER_ROSTER } from '../src/monsterRoster.js';

const FIRING_MONSTERS = MONSTER_ROSTER.filter(monster => ['sniper', 'orbit'].includes(monster.pattern));

test('assigns every firing monster a unique projectile shape and firing form', () => {
  const profiles = FIRING_MONSTERS.map(monster => ENEMY_PROJECTILE_PROFILES[monster.id]);
  const shapes = profiles.map(profile => profile?.shape);
  const firingForms = profiles.map(profile => JSON.stringify({
    count: profile?.count,
    spread: profile?.spread || 0,
    fullCircle: Boolean(profile?.fullCircle),
    motion: profile?.motion,
    speedStep: profile?.speedStep || 0
  }));

  assert.equal(FIRING_MONSTERS.length, 8);
  assert.ok(profiles.every(Boolean));
  assert.equal(new Set(shapes).size, FIRING_MONSTERS.length);
  assert.equal(new Set(firingForms).size, FIRING_MONSTERS.length);
});

test('creates each monster volley from its own profile', () => {
  FIRING_MONSTERS.forEach(monster => {
    const profile = ENEMY_PROJECTILE_PROFILES[monster.id];
    const volley = createEnemyProjectileVolley(
      monster.id,
      { x: 100, y: 100 },
      { x: 200, y: 100 },
      20,
      1
    );

    assert.equal(volley.length, profile.count);
    assert.ok(volley.every(projectile => projectile.shape === profile.shape));
    assert.ok(volley.every(projectile => projectile.motion === profile.motion));
    assert.ok(volley.every(projectile => projectile.dmg > 0));
  });
});

test('supports homing and accelerating enemy projectile movement', () => {
  const homing = new MonsterProjectile(0, 0, 100, 0, 10, {
    motion: 'homing', speed: 3, turnRate: 0.1
  });
  homing.update(800, 600, { x: 0, y: 100 });
  assert.ok(homing.vy > 0);

  const accelerating = new MonsterProjectile(0, 0, 100, 0, 10, {
    motion: 'accelerate', speed: 3, acceleration: 1.1
  });
  const initialSpeed = Math.hypot(accelerating.vx, accelerating.vy);
  accelerating.update(800, 600);
  assert.ok(Math.hypot(accelerating.vx, accelerating.vy) > initialSpeed);
});
