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
];

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
export function selectMotion(recentNames = [], n = 0) {
  const recent = new Set(recentNames);
  const fresh = MOTION_META.filter(m => !recent.has(m.name));
  const pool = fresh.length ? fresh : MOTION_META;
  return pool[((n % pool.length) + pool.length) % pool.length];
}

export function motionTarget(weight) {
  const t = 26.5 + weight;
  return Math.max(25, Math.min(30, t));
}
