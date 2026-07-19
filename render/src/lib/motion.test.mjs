import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MOTION_META, MOTION_NAMES, pickMotion, motionTarget} from './motion-registry.mjs';

test('exactly 12 presets, names unique', () => {
  assert.equal(MOTION_META.length, 12);
  assert.equal(MOTION_NAMES.length, 12);
  assert.equal(new Set(MOTION_NAMES).size, 12);
});

test('classic exists (fallback preset)', () => {
  assert.ok(MOTION_NAMES.includes('classic'));
});

test('every meta entry has name/stagger/weight of correct types', () => {
  for (const m of MOTION_META) {
    assert.equal(typeof m.name, 'string');
    assert.ok(m.name.length > 0);
    assert.equal(typeof m.stagger, 'number');
    assert.ok(m.stagger >= 0);
    assert.equal(typeof m.weight, 'number');
  }
});

test('pickMotion rotates by index and wraps', () => {
  assert.equal(pickMotion(0).name, MOTION_NAMES[0]);
  assert.equal(pickMotion(12).name, MOTION_NAMES[0]);
  assert.equal(pickMotion(13).name, MOTION_NAMES[1]);
});

test('pickMotion handles negative/zero indices safely', () => {
  assert.equal(pickMotion(-1).name, MOTION_NAMES[11]);
  assert.equal(typeof pickMotion(0).name, 'string');
});

test('motionTarget stays inside the 25-30s band', () => {
  for (const m of MOTION_META) {
    const t = motionTarget(m.weight);
    assert.ok(t >= 25 && t <= 30, `${m.name} → ${t}`);
  }
});
