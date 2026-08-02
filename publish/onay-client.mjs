// Onay Kutusu istemcisi — üretim hattının onay servisiyle konuştuğu tek yer.
//
// Servis: 38-onaybox (https://onay.temsor.com). Anahtar GH secret'ında (ONAY_INGEST_KEY).
// Hiçbir çağrı sırrı loglamaz; hata mesajları gövdeyi kısaltarak taşır.
import {readFileSync, statSync} from 'node:fs';

export class OnayIstemci {
  constructor({base = process.env.ONAY_BASE_URL, key = process.env.ONAY_INGEST_KEY, fetchFn = fetch} = {}) {
    this.base = (base ?? '').replace(/\/$/, '');
    this.key = key;
    this.fetchFn = fetchFn;
  }

  get aktifMi() { return Boolean(this.base && this.key); }

  async #iste(yol, {method = 'GET', json, govde, tip} = {}) {
    const r = await this.fetchFn(this.base + yol, {
      method,
      headers: {
        'x-onay-key': this.key,
        ...(json ? {'content-type': 'application/json'} : {}),
        ...(tip ? {'content-type': tip} : {}),
      },
      body: json ? JSON.stringify(json) : govde,
      // Node fetch, Buffer gövdeyi doğrudan alır; dosyayı belleğe okumak 30MB'da sorun değil.
    });
    const metin = await r.text();
    let veri = null;
    try { veri = metin ? JSON.parse(metin) : null; } catch { /* düz metin */ }
    if (!r.ok) {
      const hata = new Error(`onaybox ${method} ${yol} → ${r.status}: ${(veri?.hata ?? metin).slice(0, 200)}`);
      hata.kod = r.status;
      hata.veri = veri;
      throw hata;
    }
    return veri;
  }

  durum(marka) { return this.#iste(`/api/durum?marka=${encodeURIComponent(marka)}`); }

  kuyrugaAl(govde) { return this.#iste('/api/kuyruk', {method: 'POST', json: govde}); }

  // async: hata SENKRON fırlarsa çağıranın try/catch'i (ve testlerin assert.rejects'i)
  // kaçırıyor — bu istemcinin tüm hataları söz (promise) üzerinden akmalı.
  async medyaYukle(id, tip, dosya) {
    const boy = statSync(dosya).size;
    if (!boy) throw new Error(`boş dosya: ${dosya}`);
    return this.#iste(`/api/kuyruk/${id}/medya?tip=${tip}`, {
      method: 'PUT', govde: readFileSync(dosya),
      tip: tip === 'poster' ? 'image/jpeg' : 'video/mp4',
    });
  }

  hazir(id) { return this.#iste(`/api/kuyruk/${id}/hazir`, {method: 'POST', json: {}}); }

  kap(id, kim) { return this.#iste(`/api/kuyruk/${id}/kap`, {method: 'POST', json: {kim}}); }

  sonuc(id, govde) { return this.#iste(`/api/kuyruk/${id}/sonuc`, {method: 'POST', json: govde}); }
}
