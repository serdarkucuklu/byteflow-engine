// KONU (ÖZNE) KİLİDİ — aynı ürün/etken madde arka arkaya çıkmasın.
//
// ⚠ 2026-08-01 CANLI HATA: @cilt.kodu üst üste hyalüronik asit anlattı ("Hyalüronik Asit Neden
// Cildi Kurutur?" → "Hyalüronik Asit: Parayı Neye Ödüyoruz?"). Pillar rotasyonu ÇALIŞIYORDU
// (trend-mekanik → para-degeri); tekrarlayan şey pillar değil ÖZNE'ydi ve özneyi hiçbir şey
// takip etmiyordu. Başlık bloklisti de yakalayamaz: iki başlık birbirine benzemiyor.
// Serdar direktifi: "hep farklı cilt ürünleri ile ilgili olmalı."
//
// Çözüm: model her spec'te işlediği ÖZNEYİ (subject) beyan eder, geçmişe yazılır ve sonraki
// koşularda soğuma listesine girer — hem prompt'ta yasaklanır hem de üretim sonrası denetlenir.

// Soğumada 8 post = ~8 gün. Daha uzunu konu havuzunu daraltıyor (aynı nişteyiz), daha kısası
// "geçen hafta zaten anlatmıştık" hissini engellemiyor.
export const SUBJECT_COOLDOWN = 8;

// Türkçe aksanı ASCII'ye katla: "hyalüronik" ve "hyaluronik" AYNI özne (model iki yazımı da
// üretiyor). Ayrıca büyük İ/I farkını da bu adım siliyor.
const TR_MAP = {ç: 'c', ğ: 'g', ı: 'i', İ: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u'};

export function foldTr(text = '') {
  return String(text).toLowerCase().replace(/[çğıİöşüâîû]/g, ch => TR_MAP[ch] ?? ch);
}

// AYIRT ETMEYEN kelimeler: iki farklı özneyi çakıştırmasınlar. "hyalüronik asit" ile
// "salisilik asit" ortak "asit" yüzünden aynı sayılırsa motor kendi kendini kilitler.
const GENERIC = new Set([
  'asit', 'asidi', 'serum', 'serumu', 'krem', 'kremi', 'losyon', 'yag', 'yagi', 'jel',
  'urun', 'urunu', 'urunler', 'cilt', 'cildi', 'ciltte', 'bakim', 'bakimi', 'formul',
  'formulu', 'madde', 'maddesi', 'etken', 'icerik', 'icerigi', 'etkisi', 'kullanimi',
  've', 'ile', 'icin', 'bir', 'the', 'vs', 'neden', 'nasil', 'nedir', 'hangi', 'mi', 'mu',
]);

/** Özneyi ayırt edici köklere indirger: "Hyalüronik Asit Serumu" → ["hyaluronik"]. */
export function subjectTokens(subject = '') {
  return foldTr(subject)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 4 && !GENERIC.has(t));
}

// Tek kök eşleşmesi yeter: "niasinamid" ile "niasinamidin faydası" aynı öznedir. Ekleri
// tam çözmüyoruz (Türkçe için gereksiz karmaşık); önek eşleşmesi pratikte yetiyor.
export function tokensClash(a, b) {
  return a === b || (a.length >= 5 && b.startsWith(a)) || (b.length >= 5 && a.startsWith(b));
}

/** İki özne aynı şeyden mi bahsediyor? */
export function subjectsClash(a, b) {
  const A = subjectTokens(a), B = subjectTokens(b);
  if (!A.length || !B.length) return false;
  return A.some(x => B.some(y => tokensClash(x, y)));
}

/** Soğumadaki öznelerden HANGİSİYLE çakıştığı (yoksa null) — log ve retry mesajı için. */
export function clashingSubject(subject, banned = []) {
  return banned.find(b => subjectsClash(subject, b)) ?? null;
}

/**
 * Geçmişteki son özneler (yeniden eskiye). Yayınlanmış/yayınlanmamış AYRIMI YOK: tekrar,
 * yayınlansın ya da yayınlanmasın kötüdür ve bu liste modele "sayfa ne yazıyor" sinyali
 * olarak değil, çıplak yasak listesi olarak gider (bkz. generate-spec.mjs).
 */
export function recentSubjects(history = [], limit = SUBJECT_COOLDOWN) {
  const out = [];
  for (let i = history.length - 1; i >= 0 && out.length < limit; i--) {
    const s = history[i]?.subject;
    if (!s) continue;
    if (!out.some(x => subjectsClash(x, s))) out.push(s);
  }
  return out;
}
