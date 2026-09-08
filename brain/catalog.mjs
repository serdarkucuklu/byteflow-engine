// KONU KATALOĞU — her koşuda YENİ bir özne kilitlemek için.
//
// Gemini'ye "farklı bir şey anlat" demek yetmiyor: namedExamples kısa, soğuma 8 post,
// model ünlü kuzen konuya (retinol, polyester) sapıyor. Katalog, henüz işlenmemiş
// somut özneleri tutar; run-daily bir tanesini kilitler, prompt "TODAY'S SUBJECT IS LOCKED"
// diye yazar. Tükenince (hepsi soğumada) null döner — eski serbest üretim yolu durur.
//
// Kayıt: {subject, pillar, ipucu}. ipucu az bilinen mekanizmayı dayatır; Wikipedia'nın
// ilk paragrafı değil.

import {clashingSubject} from './subjects.mjs';

export function unusedCatalog(catalog = [], banned = []) {
  return (catalog ?? []).filter(e => e?.subject && !clashingSubject(e.subject, banned));
}

/**
 * Önce bugünkü pillar'a yazılmış taze özneler; o pillar bitmişse tüm taze katalog.
 * pick verilmezse belirlenimci: havuzun ilki.
 */
export function pickCatalogSubject(catalog = [], banned = [], pick = null, pillarKey = null) {
  const unused = unusedCatalog(catalog, banned);
  if (!unused.length) return null;
  const inPillar = pillarKey ? unused.filter(e => e.pillar === pillarKey) : unused;
  const pool = inPillar.length ? inPillar : unused;
  if (pick) {
    const hit = pick(pool);
    if (hit) return hit;
  }
  return pool[0];
}
