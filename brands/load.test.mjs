import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadBrand, credentials, listBrands, resolveBrandSlug} from './load.mjs';

test('the default brand loads and resolves its state paths', () => {
  const b = loadBrand('ciltkodu');
  assert.equal(b.handle, '@cilt.kodu');
  assert.ok(b.paths.history.endsWith('ciltkodu-history.json'));
  assert.ok(b.paths.seeds.endsWith('ciltkodu.json'), 'marka KENDİ seed havuzunu kullanmalı');
  assert.ok(b.themes.length >= 1 && b.narrationVoices.length >= 1);
});

test('an unknown brand fails loudly, listing what exists', () => {
  assert.throws(() => loadBrand('yok-boyle-bir-marka'), /marka bulunamadı.*ciltkodu/s);
});

test('brand slug comes from --brand, then env, then the default', () => {
  assert.equal(resolveBrandSlug(['node', 'x', '--brand=cutfx'], {}), 'cutfx');
  assert.equal(resolveBrandSlug(['node', 'x'], {BYTEFLOW_BRAND: 'other'}), 'other');
  assert.equal(resolveBrandSlug(['node', 'x'], {}), 'byteflow');
});

test('credentials map secret NAMES to values — the repo never holds a token', () => {
  const b = loadBrand('dolapkodu');
  const raw = JSON.stringify(b.publish);
  assert.doesNotMatch(raw, /EAA|IGQ|Bearer/, 'marka dosyasında token görünmemeli');
  const cred = credentials(b, {IG_USER_ID: '123', IG_ACCESS_TOKEN: 'tok', FB_PAGE_ID: '9'});
  assert.deepEqual(
    {u: cred.igUserId, t: cred.igToken, f: cred.fbPageId},
    {u: '123', t: 'tok', f: '9'});
  assert.equal(credentials(b, {}).igToken, undefined, 'secret yoksa undefined');
});

test('listBrands sees every brand file', () => {
  assert.ok(listBrands().includes('ciltkodu'));
  assert.ok(listBrands().includes('dolapkodu'));
});

// @byteflowlabs 2026-08-03'te @dolap.kodu'ya dönüştürüldü (20 post, 2 takipçi, medyan 118
// izlenme). Marka dosyası SİLİNDİ çünkü aynı IG hesabını/token'ını gösteriyordu: dosya kalsaydı
// --brand=byteflow ya da markasız bir koşu, İngilizce AI içeriğini YENİ sayfaya yayınlayabilirdi.
// Silinmiş olması, markasız çağrının sessizce yanlış sayfaya gitmek yerine patlamasını sağlıyor.
test('emekli marka geri gelmez ve markasız çağrı sessizce yayın yapamaz', () => {
  assert.ok(!listBrands().includes('byteflow'), 'byteflow markası emekli edildi');
  assert.throws(() => loadBrand(resolveBrandSlug(['node', 'x'], {})), /marka bulunamadı/);
});

test('each brand really uses its own pillar pool (not the engine default)', async () => {
  const {selectPillar, pillarsFor} = await import('../brain/pillars.mjs');
  const skin = pillarsFor('skincare-science');
  const ai = pillarsFor('ai-engineering');
  assert.ok(skin.length >= 8 && ai.length >= 8);
  assert.equal(skin.some(p => ai.some(a => a.key === p.key)), false, 'havuzlar karışmamalı');

  // Canlı hata: 5. argüman geçilmeyince cilt bakımı markası 'model-releases' üretmişti.
  for (let n = 0; n < 8; n++) {
    const picked = selectPillar([], n, null, null, skin);
    assert.ok(skin.some(p => p.key === picked.key), `${n}. postta yanlış havuz: ${picked.key}`);
  }
});

// Avatar simgesi markadan gelir. Varsayılan DAMLA olmalı: @dolap.kodu'ya etiket simgesi
// eklenirken kardeş sayfanın (@cilt.kodu) profil resminin sessizce değişmemesi buna bağlı.
test('avatar simgesi markadan gelir, varsayılanı damla', () => {
  assert.equal(loadBrand('ciltkodu').symbol, undefined, '@cilt.kodu damlada kalmalı');
  assert.equal(loadBrand('dolapkodu').symbol, 'etiket');
});
