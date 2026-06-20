import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchPadletPostHtml } from '../api/padlet-service.js';
import { parsePadletText } from '../src/customQuiz.js';

test('parsePadletText converts category text into quiz data', () => {
  const result = parsePadletText('●포유류, 고래, 박쥐, 호랑이🐾 ●조류, 참새, 독수리, 펭귄');

  assert.deepEqual(result, [
    { name: '포유류', items: ['고래', '박쥐', '호랑이'] },
    { name: '조류', items: ['참새', '독수리', '펭귄'] }
  ]);
});

test('fetchPadletPostHtml rejects missing credentials and invalid URLs', async () => {
  await assert.rejects(
    fetchPadletPostHtml('https://padlet.com/teacher/board/wish/post1', ''),
    /PADLET_API_KEY/
  );

  await assert.rejects(
    fetchPadletPostHtml('https://example.com/teacher/board/wish/post1', 'test-key'),
    error => error.statusCode === 400
  );
});

test('fetchPadletPostHtml returns escaped post content from Padlet API data', async () => {
  let requestedUrl = '';
  let requestedKey = '';
  const fetchStub = async (url, options) => {
    requestedUrl = url;
    requestedKey = options.headers['X-Api-Key'];
    return {
      ok: true,
      json: async () => ({
        included: [
          {
            type: 'post',
            id: 'post_post1',
            attributes: {
              content: {
                bodyHtml: '<p>●포유류, 고래, "박쥐" & 호랑이</p>'
              }
            }
          }
        ]
      })
    };
  };

  const html = await fetchPadletPostHtml(
    'https://padlet.com/teacher/padlet-board123/wish/post1',
    'test-key',
    fetchStub
  );

  assert.equal(requestedUrl, 'https://api.padlet.dev/v1/boards/board123?include=posts');
  assert.equal(requestedKey, 'test-key');
  assert.match(html, /&quot;박쥐&quot; &amp; 호랑이/);
});

test('fetchPadletPostHtml reports missing posts', async () => {
  const fetchStub = async () => ({
    ok: true,
    json: async () => ({ included: [] })
  });

  await assert.rejects(
    fetchPadletPostHtml(
      'https://padlet.com/teacher/board123/posts/post1',
      'test-key',
      fetchStub
    ),
    error => error.statusCode === 404
  );
});
