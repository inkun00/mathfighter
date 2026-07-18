import assert from 'node:assert/strict';
import test from 'node:test';
import { parseMathTextSegments } from '../src/mathTextFormatter.js';

test('parses a mixed number without changing its following unit', () => {
  assert.deepEqual(parseMathTextSegments('길이가 1 4/5m인 끈'), [
    { type: 'text', value: '길이가 ' },
    { type: 'fraction', whole: '1', numerator: '4', denominator: '5' },
    { type: 'text', value: 'm인 끈' }
  ]);
});

test('parses ordinary fractions throughout a math sentence', () => {
  assert.deepEqual(parseMathTextSegments('4/5와 2/3를 비교하세요.'), [
    { type: 'fraction', whole: '', numerator: '4', denominator: '5' },
    { type: 'text', value: '와 ' },
    { type: 'fraction', whole: '', numerator: '2', denominator: '3' },
    { type: 'text', value: '를 비교하세요.' }
  ]);
});

test('keeps text without fractions unchanged', () => {
  assert.deepEqual(parseMathTextSegments('12를 3으로 나누세요.'), [
    { type: 'text', value: '12를 3으로 나누세요.' }
  ]);
});
