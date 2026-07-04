import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveColor, nodeXPositions, COLORS} from './spec.ts';

test('resolveColor maps tokens', () => {
  assert.equal(resolveColor('accent'), COLORS.accent);
  assert.equal(resolveColor('good'), COLORS.good);
});

test('resolveColor falls back to accent', () => {
  assert.equal(resolveColor('nope'), COLORS.accent);
});

test('nodeXPositions centers 2 nodes', () => {
  const xs = nodeXPositions(2);
  assert.equal(xs.length, 2);
  assert.equal(xs[0], -xs[1]); // symmetric around 0
});

test('nodeXPositions centers 3 nodes with middle at 0', () => {
  const xs = nodeXPositions(3);
  assert.equal(xs[1], 0);
});

test('nodeXPositions keeps 4 nodes on-canvas (box half-width 150)', () => {
  const xs = nodeXPositions(4);
  assert.equal(xs.length, 4);
  for (const x of xs) {
    assert.ok(Math.abs(x) + 150 <= 540, `x=${x} pushes box off the 1080-wide canvas`);
  }
});
