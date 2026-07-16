import assert from 'node:assert/strict';
import test from 'node:test';
import { extractWholeNumberAnswer } from '../src/numericAnswer.js';

test('converts Korean large-number units to their full place values', () => {
  assert.equal(extractWholeNumberAnswer('30억'), '3000000000');
  assert.equal(extractWholeNumberAnswer('2,100만'), '21000000');
  assert.equal(extractWholeNumberAnswer('1조'), '1000000000000');
});

test('keeps ordinary whole-number measurements unscaled', () => {
  assert.equal(extractWholeNumberAnswer('1,200cm'), '1200');
  assert.equal(extractWholeNumberAnswer('90도'), '90');
});

test('rejects signed and decimal answers', () => {
  assert.equal(extractWholeNumberAnswer('-4'), null);
  assert.equal(extractWholeNumberAnswer('3.5'), null);
});
