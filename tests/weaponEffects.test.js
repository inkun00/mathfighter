import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createWeaponFireEffect,
  getWeaponAccentColor,
  getWeaponEffectFamily
} from '../src/weaponEffects.js';

test('assigns distinct effect families to legendary weapon behaviors', () => {
  assert.equal(getWeaponEffectFamily('chain_lightning', 23), 'electric');
  assert.equal(getWeaponEffectFamily('gravity_well', 25), 'gravity');
  assert.equal(getWeaponEffectFamily('void_pierce', 26), 'void');
  assert.equal(getWeaponEffectFamily('elemental_bolt', 27, 'fire'), 'fire');
  assert.equal(getWeaponEffectFamily('nova', 30), 'nova');
});

test('creates stronger firing feedback for legendary weapons', () => {
  const create = weapon => createWeaponFireEffect({
    x: 0,
    y: 0,
    targetX: 100,
    targetY: 0,
    weapon,
    behavior: weapon.id === 30 ? 'nova' : 'straight',
    projectileCount: 1
  });
  const normal = create({ id: 1 });
  const legendary = create({ id: 30 });

  assert.ok(legendary.radius > normal.radius);
  assert.ok(legendary.particleCount > normal.particleCount);
  assert.ok(legendary.lifeTime > normal.lifeTime);
  assert.ok(legendary.shake > normal.shake);
  assert.notEqual(getWeaponAccentColor(25, 'gravity_well'), getWeaponAccentColor(23, 'chain_lightning'));
});
