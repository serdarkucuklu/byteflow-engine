import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadBrand, credentials, listBrands, resolveBrandSlug} from './load.mjs';

test('the default brand loads and resolves its state paths', () => {
  const b = loadBrand('byteflow');
  assert.equal(b.handle, '@byteflowlabs');
  assert.ok(b.paths.history.endsWith('posted-history.json'));
  assert.ok(b.paths.seeds.endsWith('seed-backlog.json'));
  assert.ok(b.themes.length >= 1 && b.narrationVoices.length >= 1);
});

test('an unknown brand fails loudly, listing what exists', () => {
  assert.throws(() => loadBrand('yok-boyle-bir-marka'), /marka bulunamadı.*byteflow/s);
});

test('brand slug comes from --brand, then env, then the default', () => {
  assert.equal(resolveBrandSlug(['node', 'x', '--brand=cutfx'], {}), 'cutfx');
  assert.equal(resolveBrandSlug(['node', 'x'], {BYTEFLOW_BRAND: 'other'}), 'other');
  assert.equal(resolveBrandSlug(['node', 'x'], {}), 'byteflow');
});

test('credentials map secret NAMES to values — the repo never holds a token', () => {
  const b = loadBrand('byteflow');
  const raw = JSON.stringify(b.publish);
  assert.doesNotMatch(raw, /EAA|IGQ|Bearer/, 'marka dosyasında token görünmemeli');
  const cred = credentials(b, {IG_USER_ID: '123', IG_ACCESS_TOKEN: 'tok', FB_PAGE_ID: '9'});
  assert.deepEqual(
    {u: cred.igUserId, t: cred.igToken, f: cred.fbPageId},
    {u: '123', t: 'tok', f: '9'});
  assert.equal(credentials(b, {}).igToken, undefined, 'secret yoksa undefined');
});

test('listBrands sees every brand file', () => {
  assert.ok(listBrands().includes('byteflow'));
});
