import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PILLARS, selectPillar} from './pillars.mjs';

test('every pillar has a key and a descriptive focus', () => {
  assert.ok(PILLARS.length >= 8);
  for (const p of PILLARS) {
    assert.ok(p.key && typeof p.key === 'string');
    assert.ok(p.focus && p.focus.length > 10);
  }
});

test('selectPillar returns the first pillar when history is empty', () => {
  assert.equal(selectPillar([]).key, PILLARS[0].key);
});

test('selectPillar skips recently used pillars', () => {
  const recent = [PILLARS[0].key, PILLARS[1].key];
  const picked = selectPillar(recent);
  assert.ok(!recent.includes(picked.key));
});

test('selectPillar falls back to the oldest key when all are recent', () => {
  const all = PILLARS.map(p => p.key);
  assert.equal(selectPillar(all).key, all[0]);
});
