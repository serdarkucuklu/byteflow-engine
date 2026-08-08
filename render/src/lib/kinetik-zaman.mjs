// Kinetik biçimin ZAMAN MATEMATİĞİ — TEK KAYNAK.
//
// Neden ayrı modül: kapak karesinin (`thumb_offset`) doğru anı, sahnedeki kelime
// girişinin ne zaman bittiğine bağlı. Bu hesap iki yerde birden lazım:
//   · render/src/scenes/explainer.tsx → renderKinetik (kelimeleri o hızda açar)
//   · run-daily.mjs                   → spec.thumbOffset (kapak anını yazar)
// İki yerde ayrı ayrı yazılırsa biri değişince diğeri sessizce kayar ve kapak yine
// yarım cümle gösterir. .mjs (TS değil) çünkü .tsx ve .mjs'den birlikte import ediliyor
// — depoda kanıtlanmış desen (bkz. render/src/lib/motion-registry.mjs).
//
// GERÇEK OLAY (2026-08-09): kinetik biçme geçilince kapak
//   "Yumuşatıcı yazlık giysini tek"
// diye cümlenin ortasından kesik çıkıyordu. Eski `thumbOffset` hesabı
// (`beats[0].start + min(1.1, dur*0.5)`) hook'un TEK SEFERDE ekrana geldiği eski biçime
// göreydi; kinetikte hook kelime kelime geliyor ve o anda cümle henüz yarım.
// Keşfet'te ve profil ızgarasında görünen tek kare bu.

// renderKinetik'teki kelime döngüsünün kelime BAŞINA harcadığı süre:
//   all(opacity, y) → perKelime * 1.6   sonra   waitFor(perKelime * 0.6)
// Toplam çarpan 2.2. ⚠ explainer.tsx'teki döngü değişirse BU SABİT DE değişmeli.
export const GIRIS_CARPAN = 2.2;

// Kısa cümlede kelimeler sürünmesin (tek tek damlayan yazı yavaş hissettiriyor).
export const PER_KELIME_TAVAN = 0.13;

// Yalnızca sıfıra/negatife düşmeyi engelleyen emniyet. Anlamlı bir taban (ör. 0,045)
// konulamıyor: 22 kelime / 2,6sn beat'te girişi beat'in yarısının ötesine taşıyor ve
// kapak yine yarım cümle gösteriyor. Kapak doğruluğu > animasyonun tek tek görünmesi.
export const PER_KELIME_TABAN = 0.01;

// renderKinetik beat sonunda bloğu 0.22s'de söndürüyor — kapak o pencereye girmemeli.
export const SONME_SN = 0.22;

// Kapak, giriş bittikten hemen sonra değil kısa bir pay sonra alınır: son kelimenin
// tween'i tam oturmuş, blok yerine yerleşmiş olsun.
export const KAPAK_PAYI = 0.25;

const kis = (v, alt, ust) => Math.max(alt, Math.min(ust, v));

/** Kelime başına temel süre (sn). SAF. */
export function perKelime(kelimeSayisi, beatSuresi) {
  const n = Math.max(1, kelimeSayisi);
  // Bütçe: beat'in ilk YARISI. Giriş orada bitsin ki cümlenin tamamı beat'in ikinci
  // yarısı boyunca ekranda dursun — hem okunur hem kapak alınabilir.
  const butce = Math.max(0, beatSuresi) * 0.5;
  return kis(butce / (GIRIS_CARPAN * n), PER_KELIME_TABAN, PER_KELIME_TAVAN);
}

/** Girişin beat BAŞINDAN itibaren kaçıncı saniyede bittiği. SAF. */
export function girisBitis(kelimeSayisi, beatSuresi) {
  const n = Math.max(1, kelimeSayisi);
  return n * perKelime(n, beatSuresi) * GIRIS_CARPAN;
}

const kelimeSay = t => String(t ?? '').split(/\s+/).filter(Boolean).length;

/**
 * Kapak karesinin MUTLAK anı (sn). Hook beat'inin girişi bittikten sonra, sönme
 * penceresinden önce. SAF.
 * Sığmıyorsa (patolojik uzun cümle) sönmeden hemen önceye kırpılır — o noktada gösterilecek
 * en tam kare odur.
 */
export function kapakAni(beats, {pay = KAPAK_PAYI, sonme = SONME_SN} = {}) {
  const b = Array.isArray(beats) ? beats[0] : null;
  if (!b || typeof b.start !== 'number' || typeof b.dur !== 'number') return 1.3;
  const bitis = girisBitis(kelimeSay(b.text), b.dur);
  const enGec = b.start + b.dur - sonme;
  const istenen = b.start + bitis + pay;
  // Alt sınır: beat başlangıcından sonra olsun (dur çok kısaysa enGec başlangıcın altına düşebilir).
  return Math.max(b.start + 0.05, Math.min(istenen, enGec));
}
