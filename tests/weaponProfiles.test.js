import assert from 'node:assert/strict';
import test from 'node:test';
import { WEAPONS_DB } from '../src/shop.js';
import {
  getWeaponBalanceMetrics,
  getWeaponBehavior,
  getWeaponFireStyleLabel,
  getWeaponVisualProfile
} from '../src/weaponProfiles.js';

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

test('keeps weapon prices ordered across all thirty weapons', () => {
  assert.equal(WEAPONS_DB.length, 30);
  WEAPONS_DB.slice(1).forEach((weapon, index) => {
    assert.ok(weapon.price > WEAPONS_DB[index].price);
  });
});

test('scales effective damage clearly across price bands', () => {
  const bands = [
    WEAPONS_DB.slice(0, 10),
    WEAPONS_DB.slice(10, 20),
    WEAPONS_DB.slice(20, 30)
  ].map(weapons => weapons.map(weapon => getWeaponBalanceMetrics(weapon).focusDps));

  assert.ok(Math.min(...bands[0]) >= 12);
  assert.ok(Math.min(...bands[1]) >= 50);
  assert.ok(Math.min(...bands[2]) >= 300);
  assert.ok(median(bands[1]) > median(bands[0]) * 3);
  assert.ok(median(bands[2]) > median(bands[1]) * 5);
});

test('gives every legendary weapon a distinct firing form', () => {
  const legendaryBehaviors = WEAPONS_DB.slice(20).map(weapon => (
    getWeaponBehavior(weapon.id, weapon.type)
  ));

  assert.equal(new Set(legendaryBehaviors).size, 10);
  assert.equal(new Set(WEAPONS_DB.map(weapon => (
    getWeaponBehavior(weapon.id, weapon.type)
  ))).size >= 16, true);
  legendaryBehaviors.forEach((behavior, index) => {
    const weapon = WEAPONS_DB[index + 20];
    assert.notEqual(getWeaponFireStyleLabel(weapon.id, weapon.type), '직선 발사');
    assert.ok(behavior.length > 0);
  });
});

test('increases projectile and impact spectacle with weapon price', () => {
  const profiles = WEAPONS_DB.map(weapon => getWeaponVisualProfile(weapon.id));

  profiles.slice(1).forEach((profile, index) => {
    const previous = profiles[index];
    assert.ok(profile.drawSize >= previous.drawSize);
    assert.ok(profile.glowBlur >= previous.glowBlur);
    assert.ok(profile.trailCount >= previous.trailCount);
    assert.ok(profile.impactScale > previous.impactScale);
    assert.ok(profile.lifeTime >= previous.lifeTime);
  });
  assert.ok(profiles.at(-1).drawSize >= profiles[0].drawSize * 1.7);
  assert.ok(profiles.at(-1).glowBlur >= profiles[0].glowBlur * 4);
});
