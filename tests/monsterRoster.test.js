import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { MONSTER_FAMILIES, MONSTER_ROSTER } from '../src/monsterRoster.js';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));

test('defines six monster families with one monster at every rank', () => {
  assert.deepEqual(MONSTER_FAMILIES, ['slime', 'zombie', 'skeleton', 'golem', 'spirit', 'robot']);
  assert.equal(MONSTER_ROSTER.length, 30);

  MONSTER_FAMILIES.forEach(family => {
    const ranks = MONSTER_ROSTER
      .filter(monster => monster.family === family)
      .map(monster => monster.rank)
      .sort((a, b) => a - b);
    assert.deepEqual(ranks, [1, 2, 3, 4, 5]);
  });
});

test('uses unique monster ids and provides every sprite sheet', () => {
  const ids = MONSTER_ROSTER.map(monster => monster.id);
  assert.equal(new Set(ids).size, MONSTER_ROSTER.length);

  MONSTER_ROSTER.forEach(monster => {
    const assetPath = fileURLToPath(new URL(`../public${monster.sheet}`, import.meta.url));
    assert.equal(existsSync(assetPath), true, `${monster.id} is missing ${assetPath}`);
    assert.equal(monster.isElite === true, monster.rank >= 4);
  });
});

test('uses optimized WebP sheets for every roster monster', () => {
  assert.ok(MONSTER_ROSTER.every(monster => monster.sheet.endsWith('.webp')));
});
