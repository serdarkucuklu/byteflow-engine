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

test('there are at least 2 timely (news) pillars and they mention headlines', () => {
  const timely = PILLARS.filter(p => p.timely);
  assert.ok(timely.length >= 2);
  for (const p of timely) assert.match(p.focus, /headline/i);
});

// %75 kuralı: 4 postluk pencerede 3 timely + 1 evergreen (Serdar direktifi 2026-07).
test('selectPillar picks a timely pillar for exactly 75% of posts', () => {
  let timelyCount = 0;
  for (let n = 0; n < 100; n++) {
    if (selectPillar([], n).timely) timelyCount++;
  }
  assert.equal(timelyCount, 75);
});

test('every 4th post (postCount % 4 === 3) is an evergreen pillar', () => {
  assert.ok(!selectPillar([], 3).timely);
  assert.ok(!selectPillar([], 7).timely);
  assert.ok(selectPillar([], 0).timely);
  assert.ok(selectPillar([], 4).timely);
});

test('selectPillar skips recently used pillars within the chosen group', () => {
  const timelyKeys = PILLARS.filter(p => p.timely).map(p => p.key);
  const picked = selectPillar(timelyKeys.slice(0, 2), 0);
  assert.ok(picked.timely);
  assert.ok(!timelyKeys.slice(0, 2).includes(picked.key));
});

test('selectPillar falls back to the oldest group key when the whole group is recent', () => {
  const timelyKeys = PILLARS.filter(p => p.timely).map(p => p.key);
  // grubun tamamı (ve araya karışmış evergreen'ler) yakın zamanda kullanılmış
  const recent = [timelyKeys[1], 'rag', timelyKeys[0], timelyKeys[2] ?? timelyKeys[0]].filter(Boolean);
  const picked = selectPillar(recent, 0);
  assert.ok(picked.timely);
  assert.equal(picked.key, timelyKeys[1]); // recentKeys içindeki en eski timely
});

test('evergreen slot rotates through non-timely pillars (LRU)', () => {
  const evergreen = PILLARS.filter(p => !p.timely).map(p => p.key);
  assert.equal(selectPillar([], 3).key, evergreen[0]);
  const picked = selectPillar([evergreen[0], evergreen[1]], 3);
  assert.ok(!picked.timely);
  assert.ok(![evergreen[0], evergreen[1]].includes(picked.key));
});
