import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveColor, nodeXPositions, layoutPositions, THEMES, LAYOUTS, COLORS} from './spec.ts';

test('resolveColor maps tokens', () => {
  assert.equal(resolveColor('accent'), COLORS.accent);
  assert.equal(resolveColor('good'), COLORS.good);
});

test('resolveColor accent uses video theme when given', () => {
  assert.equal(resolveColor('accent', '#ff0000'), '#ff0000');
  assert.equal(resolveColor('good', '#ff0000'), COLORS.good); // good sabit
});

test('resolveColor falls back to accent', () => {
  assert.equal(resolveColor('nope'), COLORS.accent);
});

test('layoutPositions returns count positions for every layout, all on-canvas', () => {
  for (const layout of LAYOUTS) {
    for (const count of [2, 3, 4]) {
      const pts = layoutPositions(layout, count);
      assert.equal(pts.length, count, `${layout}/${count}`);
      for (const p of pts) {
        assert.ok(Math.abs(p.x) <= 540 && Math.abs(p.y) <= 820, `${layout}/${count} off-canvas ${JSON.stringify(p)}`);
      }
    }
  }
});

test('vertical-stack aligns nodes on x=0', () => {
  for (const p of layoutPositions('vertical-stack', 3)) assert.equal(p.x, 0);
});

test('THEMES has multiple distinct accents', () => {
  assert.ok(THEMES.length >= 4);
  assert.equal(new Set(THEMES).size, THEMES.length);
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
