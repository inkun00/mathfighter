import assert from 'node:assert/strict';
import test from 'node:test';

test('reuses one image object for repeated monster sprite paths', async () => {
  const OriginalImage = globalThis.Image;
  globalThis.Image = class MockImage {
    constructor() {
      this.src = '';
    }
  };

  try {
    const { getCachedMonsterImage } = await import('../src/monster.js');
    const first = getCachedMonsterImage('/assets/test-monster.webp');
    const second = getCachedMonsterImage('/assets/test-monster.webp');
    const different = getCachedMonsterImage('/assets/other-monster.webp');
    assert.equal(first, second);
    assert.notEqual(first, different);
  } finally {
    globalThis.Image = OriginalImage;
  }
});
