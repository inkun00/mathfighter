import assert from 'node:assert/strict';
import test from 'node:test';
import { getAnalogStickVector } from '../src/inputController.js';

test('keeps the joystick inside its dead zone at rest', () => {
  assert.deepEqual(getAnalogStickVector(3, 4, 40), { x: 0, y: 0, strength: 0 });
});

test('preserves arbitrary joystick angles instead of snapping to eight directions', () => {
  const vector = getAnalogStickVector(80, 40, 40);

  assert.equal(vector.strength, 1);
  assert.ok(Math.abs(vector.x - 0.894427) < 0.000001);
  assert.ok(Math.abs(vector.y - 0.447214) < 0.000001);
});

test('scales joystick speed between the dead zone and its outer edge', () => {
  const vector = getAnalogStickVector(20, 0, 40);

  assert.ok(vector.strength > 0 && vector.strength < 1);
  assert.equal(vector.x, vector.strength);
  assert.equal(vector.y, 0);
});
