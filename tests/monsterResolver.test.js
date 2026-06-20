import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveMonsterUpdates } from '../src/monsterResolver.js';

function createPlayer(overrides = {}) {
  return {
    x: 0,
    y: 0,
    radius: 10,
    hp: 100,
    damageTaken: [],
    takeDamage(amount) {
      this.damageTaken.push(amount);
      this.hp -= amount;
    },
    ...overrides
  };
}

function createMonster(overrides = {}) {
  return {
    x: 100,
    y: 0,
    radius: 10,
    hp: 100,
    atk: 20,
    lastContactDamageTime: 0,
    updateCalls: [],
    update(...args) {
      this.updateCalls.push(args);
    },
    ...overrides
  };
}

function resolve(overrides = {}) {
  const player = overrides.player ?? createPlayer();
  const monsters = overrides.monsters ?? [];
  const monsterProjectiles = overrides.monsterProjectiles ?? [];
  const deaths = [];

  resolveMonsterUpdates({
    monsters,
    player,
    monsterProjectiles,
    now: overrides.now ?? 1000,
    onPlayerDeath: () => deaths.push(player.hp)
  });

  return { player, deaths };
}

test('updates living monsters with the shared target and projectile list', () => {
  const living = createMonster();
  const dead = createMonster({ hp: 0 });
  const projectiles = [];

  resolve({ monsters: [living, dead], monsterProjectiles: projectiles });

  assert.equal(living.updateCalls.length, 1);
  assert.deepEqual(living.updateCalls[0][0], { x: 0, y: 0 });
  assert.equal(living.updateCalls[0][1][0], living);
  assert.equal(living.updateCalls[0][2], projectiles);
  assert.equal(dead.updateCalls.length, 0);
});

test('applies bomber damage only inside the explosion radius', () => {
  const near = createMonster({
    x: 79,
    update() {
      return 'explode';
    }
  });
  const far = createMonster({
    x: 80,
    update() {
      return 'explode';
    }
  });
  const nearPlayer = createPlayer();
  const farPlayer = createPlayer();

  resolve({ player: nearPlayer, monsters: [near] });
  resolve({ player: farPlayer, monsters: [far] });

  assert.deepEqual(nearPlayer.damageTaken, [30]);
  assert.deepEqual(farPlayer.damageTaken, []);
});

test('enforces the contact damage distance and cooldown boundaries', () => {
  const blocked = createMonster({ x: 19, lastContactDamageTime: 351 });
  const ready = createMonster({ x: 19, lastContactDamageTime: 350 });
  const touching = createMonster({ x: 20, lastContactDamageTime: 0 });
  const blockedPlayer = createPlayer();
  const readyPlayer = createPlayer();
  const touchingPlayer = createPlayer();

  resolve({ player: blockedPlayer, monsters: [blocked], now: 1000 });
  resolve({ player: readyPlayer, monsters: [ready], now: 1000 });
  resolve({ player: touchingPlayer, monsters: [touching], now: 1000 });

  assert.deepEqual(blockedPlayer.damageTaken, []);
  assert.deepEqual(readyPlayer.damageTaken, [3.2]);
  assert.equal(ready.lastContactDamageTime, 1000);
  assert.deepEqual(touchingPlayer.damageTaken, []);
});

test('reports lethal explosion and contact damage', () => {
  const monster = createMonster({
    x: 5,
    update() {
      return 'explode';
    }
  });
  const player = createPlayer({ hp: 10 });
  const result = resolve({ player, monsters: [monster], now: 1000 });

  assert.deepEqual(player.damageTaken, [30, 3.2]);
  assert.deepEqual(result.deaths, [-20, -23.2]);
});
