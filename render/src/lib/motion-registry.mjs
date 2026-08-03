// Kareografi kayıt defteri — PURE metadata. @motion-canvas import'u YOK, böylece
// run-daily.mjs (boru hattı) ve node --test bunu doğrudan okuyabiliyor.
// Hareketin kendisi scenes/choreo.tsx içinde; burası sadece "hangileri var ve
// sessiz koşuda süre hedefini ne kadar itiyorlar" sorusunu cevaplıyor.
//
// `weight` süre hedefini 25-30s bandı içinde ötelemek için (yalnızca SESSİZ yol;
// seslendirme varsa zamanlama beat'lerden gelir). Sıralı girişli kareografiler
// (buildup/cascade) doğaları gereği biraz daha uzun sürüyor.
// `stagger` kartlar arası gecikme katsayısı (kareografinin kendi içinde kullanılır).

export const MOTION_META = [
  {name: 'buildup', stagger: 0, weight: 1},      // kartlar sırayla aşağıdan süzülür
  {name: 'spotlight', stagger: 0.18, weight: 0}, // hepsi karanlıkta, ışık gezer
  {name: 'camera', stagger: 0.35, weight: 0},    // kamera aktif çifte kayar/yakınlaşır
  {name: 'cascade', stagger: 0, weight: 1.5},    // yukarıdan düşüş + çarpma
  {name: 'ripple', stagger: 0, weight: 0.5},     // merkezden açılma + halka dalgası
  // @kizlar.kodu hattı — "şekiller çizilerek/dönerek gelsin" (Serdar 2026-08-03):
  {name: 'sketch', stagger: 0.12, weight: 1.2},  // önce çizgiler çizilir, kartlar sonra oturur
  {name: 'flip', stagger: 0.2, weight: 0.8},     // kartlar soru-cevap gibi çevrilerek açılır
  {name: 'orbit', stagger: 0.15, weight: 1},     // merkez etrafında yay çizerek girer
];

// ── MARKA BAŞINA KAREOGRAFİ (Serdar, 2026-08-03) ──────────────────────────────
// "Bu sayfanın animasyonlarını cilt.kodu'ya göre farklılaştır." İki sayfa aynı beş
// kareografiyi paylaşırken keşfet akışında arka arkaya çıkan iki video aynı motordan
// çıkmış gibi görünüyordu. @kizlar.kodu artık KENDİ hareket dilini kullanıyor:
// kartlar çizilerek girer (sketch), soru-cevap gibi döner (flip), merkez etrafında
// yay çizerek gelir (orbit). Ortak üçlü (buildup/cascade/ripple) ikisinde de kalıyor
// ki tamamen kopuk iki ürün gibi durmasın.
const KIZLAR_MOTION = ['sketch', 'flip', 'orbit', 'buildup', 'cascade'];

// ⚠ 'ortak' AÇIKÇA sayılır — MOTION_META'dan türetilseydi @kizlar.kodu için eklenen her yeni
// kareografi sessizce @cilt.kodu'ya da geçer ve iki sayfayı ayırmak için yapılan iş boşa giderdi.
export const MOTION_SETS = {
  ortak: ['buildup', 'spotlight', 'camera', 'cascade', 'ripple'],
  kizlar: KIZLAR_MOTION,
};

/** Marka dosyasındaki motionSet adına karşılık gelen kareografi havuzu. */
export function motionsFor(setName) {
  const adlar = MOTION_SETS[setName] ?? MOTION_SETS.ortak;
  return adlar.map(ad => MOTION_META.find(m => m.name === ad)).filter(Boolean);
}

export const MOTION_NAMES = MOTION_META.map(m => m.name);

export function pickMotion(n) {
  const len = MOTION_META.length;
  return MOTION_META[((n % len) + len) % len];
}

/** Kareografinin süre ağırlığı; bilinmeyen ad varsayılana (buildup) düşer. */
export function weightOf(name) {
  return (MOTION_META.find(m => m.name === name) ?? MOTION_META[0]).weight;
}

/**
 * Sıradaki kareografi: son kullanılanlar hariç (LRU). Ardışık iki video aynı
 * hareket diliyle akmasın diye — Serdar 2026-08-02: "5 farklı kareografi olsun".
 */
export function selectMotion(recentNames = [], n = 0, havuz = MOTION_META) {
  const recent = new Set(recentNames);
  const taban = havuz.length ? havuz : MOTION_META;
  const fresh = taban.filter(m => !recent.has(m.name));
  const pool = fresh.length ? fresh : taban;
  return pool[((n % pool.length) + pool.length) % pool.length];
}

export function motionTarget(weight) {
  const t = 26.5 + weight;
  return Math.max(25, Math.min(30, t));
}
