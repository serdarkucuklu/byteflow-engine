import {test} from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync, mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {OnayIstemci} from './onay-client.mjs';

function sahteFetch(yanitlar) {
  const cagrilar = [];
  const fetchFn = async (url, sec) => {
    cagrilar.push({url, method: sec.method ?? 'GET', headers: sec.headers, body: sec.body});
    const y = yanitlar.shift() ?? {ok: true, govde: {}};
    return {ok: y.ok !== false, status: y.status ?? (y.ok === false ? 500 : 200),
      text: async () => JSON.stringify(y.govde ?? {})};
  };
  return {fetchFn, cagrilar};
}

test('her istek anahtarı başlıkta taşır, adresi normalize eder', async () => {
  const {fetchFn, cagrilar} = sahteFetch([{govde: {bekleyenVar: false}}]);
  const i = new OnayIstemci({base: 'https://onay.temsor.com/', key: 'gizli', fetchFn});
  await i.durum('ciltkodu');
  assert.equal(cagrilar[0].url, 'https://onay.temsor.com/api/durum?marka=ciltkodu');
  assert.equal(cagrilar[0].headers['x-onay-key'], 'gizli');
});

test('hata gövdesi mesaja taşınır ve kod korunur (409 → başka koşucu aldı)', async () => {
  const {fetchFn} = sahteFetch([{ok: false, status: 409, govde: {hata: 'kapılamaz (durum: uygulaniyor)'}}]);
  const i = new OnayIstemci({base: 'https://x', key: 'k', fetchFn});
  await assert.rejects(i.kap('abc123', 'gh'), e => {
    assert.equal(e.kod, 409);
    assert.match(e.message, /kapılamaz/);
    return true;
  });
});

test('medya yükleme ikili gövdeyi ve doğru içerik tipini gönderir', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'onayc-'));
  const dosya = join(dir, 'v.mp4');
  writeFileSync(dosya, Buffer.from('MP4-VERI'));
  const {fetchFn, cagrilar} = sahteFetch([{govde: {ok: true}}]);
  const i = new OnayIstemci({base: 'https://x', key: 'k', fetchFn});
  await i.medyaYukle('abc123', 'video', dosya);
  assert.equal(cagrilar[0].method, 'PUT');
  assert.match(cagrilar[0].url, /\/api\/kuyruk\/abc123\/medya\?tip=video$/);
  assert.equal(cagrilar[0].headers['content-type'], 'video/mp4');
  assert.equal(cagrilar[0].body.toString(), 'MP4-VERI');
});

test('boş video dosyası yüklenmez (yarım render yayına gitmesin)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'onayc-'));
  const dosya = join(dir, 'bos.mp4');
  writeFileSync(dosya, '');
  const i = new OnayIstemci({base: 'https://x', key: 'k', fetchFn: async () => ({ok: true, text: async () => '{}'})});
  await assert.rejects(i.medyaYukle('abc123', 'video', dosya), /boş dosya/);
});

test('anahtar/adres yoksa istemci pasif sayılır', () => {
  assert.equal(new OnayIstemci({base: '', key: '', fetchFn: () => {}}).aktifMi, false);
  assert.equal(new OnayIstemci({base: 'https://x', key: 'k', fetchFn: () => {}}).aktifMi, true);
});
