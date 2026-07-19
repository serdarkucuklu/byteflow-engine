import {test} from 'node:test';
import assert from 'node:assert/strict';
import {graphCall, TRANSIENT} from './instagram-publish.mjs';

const ok = (json) => ({json: async () => json});

test('graphCall retries on a transient error (code 2) then succeeds', async () => {
  let calls = 0;
  const fetchFn = async () => {
    calls++;
    if (calls < 3) return ok({error: {code: 2, message: 'An unexpected error has occurred. Please retry your request later.'}});
    return ok({id: '123'});
  };
  const d = await graphCall('http://x', {}, {baseMs: 0, fetchFn});
  assert.equal(d.id, '123');
  assert.equal(calls, 3); // 2 transient fails + 1 success
});

test('graphCall throws immediately on a permanent error (code 190) — no retry', async () => {
  let calls = 0;
  const fetchFn = async () => { calls++; return ok({error: {code: 190, message: 'Invalid OAuth access token'}}); };
  await assert.rejects(() => graphCall('http://x', {}, {baseMs: 0, fetchFn}), /190\/.*Invalid OAuth/);
  assert.equal(calls, 1); // permanent → tried once, no retry
});

test('graphCall gives up after exhausting retries on persistent transient error', async () => {
  let calls = 0;
  const fetchFn = async () => { calls++; return ok({error: {code: 2, message: 'retry later'}}); };
  await assert.rejects(() => graphCall('http://x', {}, {retries: 3, baseMs: 0, fetchFn}), /2\/.*retry later/);
  assert.equal(calls, 4); // initial + 3 retries
});

test('graphCall retries on a network-level failure then succeeds', async () => {
  let calls = 0;
  const fetchFn = async () => { calls++; if (calls < 2) throw new Error('ECONNRESET'); return ok({id: 'net'}); };
  const d = await graphCall('http://x', {}, {baseMs: 0, fetchFn});
  assert.equal(d.id, 'net');
  assert.equal(calls, 2);
});

test('graphCall with retries:0 tries exactly once even on a transient error (media_publish safety)', async () => {
  let calls = 0;
  const fetchFn = async () => { calls++; return ok({error: {code: 2, message: 'retry later'}}); };
  await assert.rejects(() => graphCall('http://x', {}, {retries: 0, baseMs: 0, fetchFn}), /2\/.*retry later/);
  assert.equal(calls, 1); // no retry → no double-publish risk
});

test('TRANSIENT set includes Meta transient/throttle codes but not auth (190)', () => {
  assert.ok(TRANSIENT.has(1) && TRANSIENT.has(2) && TRANSIENT.has(4));
  assert.ok(!TRANSIENT.has(190));
});
