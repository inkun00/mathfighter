import assert from 'node:assert/strict';
import test from 'node:test';
import { WEAPONS_DB } from '../src/shop.js';
import {
  getWeaponBalanceMetrics,
  getWeaponBehavior,
  getWeaponFireStyleLabel,
  getWeaponPatternProfile,
  getWeaponRange,
  getWeaponRangeLabel,
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

test('uses a multi-projectile parabolic pattern for the smoke grenade launcher', () => {
  const behavior = getWeaponBehavior(14, 'splash');
  const pattern = getWeaponPatternProfile(14, behavior, 3);

  assert.equal(behavior, 'smoke_grenade');
  assert.equal(pattern.count, 4);
  assert.equal(pattern.damageScale, 0.85);
});

test('caps sustained projectile counts while preserving total shot power', () => {
  const shockwave = getWeaponPatternProfile(18, 'shockwave', 3);
  const orbit = getWeaponPatternProfile(16, 'orbit', 3);
  const nova = getWeaponPatternProfile(30, 'nova', 3);

  assert.equal(shockwave.count, 8);
  assert.equal(orbit.count, 4);
  assert.equal(nova.count, 10);
  assert.ok(Math.abs(shockwave.count * shockwave.damageScale - 18 * 0.62) < 0.001);
  assert.ok(Math.abs(orbit.count * orbit.damageScale - 6 * 0.7) < 0.001);
  assert.ok(Math.abs(nova.count * nova.damageScale - 20 * 0.8) < 0.001);
});

test('uses long range targeting for the Valkyrie missile launcher', () => {
  assert.equal(getWeaponBehavior(28, 'homing'), 'missile_swarm');
  assert.equal(getWeaponRange(28, 'missile_swarm'), 520);
  assert.equal(getWeaponRangeLabel(28, 'homing'), '장거리');
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
