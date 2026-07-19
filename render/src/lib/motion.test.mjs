import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MOTION_META, MOTION_NAMES, pickMotion, motionTarget} from './motion-registry.mjs';

test('single build-up preset', () => {
  assert.equal(MOTION_META.length, 1);
  assert.equal(MOTION_NAMES.length, 1);
  assert.equal(MOTION_NAMES[0], 'buildup');
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

test('pickMotion always returns buildup (single preset), any index', () => {
  assert.equal(pickMotion(0).name, 'buildup');
  assert.equal(pickMotion(5).name, 'buildup');
  assert.equal(pickMotion(12).name, 'buildup');
  assert.equal(pickMotion(-1).name, 'buildup');
});

test('motionTarget stays inside the 25-30s band', () => {
  for (const m of MOTION_META) {
    const t = motionTarget(m.weight);
    assert.ok(t >= 25 && t <= 30, `${m.name} → ${t}`);
  }
  assert.equal(motionTarget(-100), 25);
  assert.equal(motionTarget(100), 30);
});
