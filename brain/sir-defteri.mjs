// SIR DEFTERİ — insider-sır derinleştirme döngüsünün (sir-derinlestir.mjs) hafızası.
//
// Neden: sabit turlu döngü her koşuda konuyu sıfırdan araştırıyor; aynı konuya günler sonra
// dönüldüğünde aynı mekanizmayı tekrar bulabilir. Defter, o konuda daha önce anlatılmış
// mekanizmaları saklar (bkz. sir-derinlestir.mjs 2.5) ve döngü "başka bir şey bul" diyebilir.
//
// K1-vade düzeltmesi: benzerlik karşılaştırması yalnız AYNI konudaki kayıtlara uygulanır
// (subjectsClash ile süzülür) — aksi hâlde defter büyüdükçe farklı öznelerin meşru
// mekanizmalarını da reddetmeye başlar (bkz. docs/plan/cilt-insider-sirlar.md Tuzaklar).
//
// Desen brain/red-defteri.mjs'i birebir izler: dosya okuma/yazma, kırpma, hata toleransı.
import {readFileSync, writeFileSync, existsSync, mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {foldTr, subjectsClash} from './subjects.mjs';

export function sirOku(path) {
  if (!path || !existsSync(path)) return [];
  try {
    const v = JSON.parse(readFileSync(path, 'utf8'));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];   // bozuk defter üretimi durdurmaz; kayıt en kötü ihtimalle bir gün kaybolur
  }
}

/** Kayıt çağıran tarafından tam kurulur (gun/konu/sir/neden/kullanildi/at). Son 200 tutulur. */
export function sirEkle(path, kayit) {
  if (!path || !kayit) return null;
  const defter = [...sirOku(path), kayit].slice(-200);
  mkdirSync(dirname(path), {recursive: true});
  writeFileSync(path, JSON.stringify(defter, null, 2));
  return kayit;
}

/** İki metin aynı mekanizmayı mı anlatıyor? foldTr token Jaccard ≥ 0.5. */
export function sirBenzerMi(a, b) {
  const tok = s => new Set(foldTr(s).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean));
  const A = tok(a), B = tok(b);
  if (!A.size || !B.size) return false;
  const kesisim = [...A].filter(t => B.has(t)).length;
  const birlesim = new Set([...A, ...B]).size;
  return kesisim / birlesim >= 0.5;
}

/**
 * Verilen konuda daha önce kullanılmış sır metinleri (en fazla limit adet). Farklı konudaki
 * kayıtlar subjectsClash ile elenir; kullanildi:false kayıtlar hiç girmez (video hiç yayınlanmadı).
 */
export function bilinenSirlar(defter = [], konu, limit = 40) {
  return defter
    .filter(k => k.kullanildi && subjectsClash(k.konu, konu))
    .slice(-limit)
    .map(k => k.sir);
}
