// Skor tablosu — yayınlanan videoların GERÇEK performansını konu seçimine geri besler.
//
// Neden: bugüne kadar her video bir tahmindi. Hangi pillar, hangi düzen, hangi uzunluk,
// hangi ses tuttu bilmiyorduk (insight hattı da bozuktu, 29 postta sıfır veri). Ölçmediğimiz
// şeyi iyileştiremeyiz.
//
// Tasarım ilkesi: AZ VERİYLE AŞIRI TEPKİ VERME. 3 postluk bir örneklem "bu pillar harika"
// demez; skorlar global ortalamaya doğru büzülür (shrinkage) ve seçim yumuşak ağırlıkla
// yapılır — kazananlar öne çıkar ama hiçbir konu tamamen ölmez (keşif devam etmeli).
//
// PURE: dosya/ağ yok, sadece geçmiş kaydı → skor. Test edilebilir kalsın.

// Retention'a ağırlık: algoritmanın birincil sinyali izlenme süresi; kaydetme/paylaşma
// ikincil ama çok değerli (kalite sinyali), tekrar izleme (views/reach) üçüncül.
const W = {retention: 0.55, engagement: 0.30, rewatch: 0.15};
const PRIOR_N = 2.5;               // "sanki 2.5 ortalama post daha var" — az örneklemde frenler

const num = v => (typeof v === 'number' && isFinite(v) ? v : 0);

/**
 * Tek postun 0-1 arası skoru. Veri eksikse null (skorlamaya girmez).
 * @param entry posted-history.json kaydı: {insights, durSec}
 */
export function scorePost(entry) {
  const ins = entry?.insights;
  if (!ins || !num(ins.reach)) return null;

  const views = num(ins.views) || num(ins.reach);
  const durSec = num(entry.durSec) || 25;
  // Ortalama izleme / video süresi → izleyicinin ne kadarını izlediği (0-1+).
  const retention = Math.min(1.2, (num(ins.ig_reels_avg_watch_time) / 1000) / durSec);
  // Kaydetme + paylaşma, izlenme başına (paylaşım daha ağır: erişimi o büyütüyor).
  // Sert tavan yerine YUMUŞAK DOYUM (r/(r+k)): iyi bir post ile harika bir post aynı 1.0'a
  // yapışmasın — sıralama korunsun (ilk testte tam bu yüzden ikisi eşit çıkmıştı).
  const engRate = (num(ins.saved) + num(ins.shares) * 1.5) / Math.max(views, 1);
  const engagement = engRate / (engRate + 0.04);      // %4 kaydetme/paylaşma oranı ≈ 0.5 puan
  // Tekrar izleme: views/reach 1'in ne kadar üstünde.
  const rw = Math.max(0, views / Math.max(num(ins.reach), 1) - 1);
  const rewatch = rw / (rw + 0.5);

  return Math.round((W.retention * retention + W.engagement * engagement + W.rewatch * rewatch) * 1000) / 1000;
}

/** Kaydın bir boyuttaki değeri (pillar, layout, voice, uzunluk kovası…). */
export const DIMENSIONS = {
  pillar: e => e.pillar ?? null,
  layout: e => e.layout ?? null,
  voice: e => e.voiceName ?? null,
  length: e => (e.durSec ? (e.durSec < 18 ? 'kısa(<18s)' : e.durSec < 26 ? 'orta(18-26s)' : 'uzun(26s+)') : null),
  narrated: e => (e.voice ? 'sesli' : 'sessiz'),
};

/**
 * Boyut değerlerine göre büzülmüş ortalama skor.
 * @returns Map<değer, {n, mean, score}> — score = global ortalamaya büzülmüş hâli.
 */
export function aggregate(history, dimension) {
  const pick = DIMENSIONS[dimension] ?? (e => e[dimension] ?? null);
  const scored = history.map(e => ({key: pick(e), score: scorePost(e)}))
    .filter(x => x.key != null && x.score != null);
  const global = scored.length ? scored.reduce((a, x) => a + x.score, 0) / scored.length : 0;

  const groups = new Map();
  for (const {key, score} of scored) {
    const g = groups.get(key) ?? {n: 0, sum: 0};
    g.n++; g.sum += score;
    groups.set(key, g);
  }
  const out = new Map();
  for (const [key, g] of groups) {
    const mean = g.sum / g.n;
    // Bayes-vari büzülme: n küçükken skor global ortalamaya yakın kalır.
    const score = (g.sum + global * PRIOR_N) / (g.n + PRIOR_N);
    out.set(key, {n: g.n, mean: Math.round(mean * 1000) / 1000, score: Math.round(score * 1000) / 1000});
  }
  return {global: Math.round(global * 1000) / 1000, groups: out, sampleSize: scored.length};
}

/**
 * Adaylar arasından skora göre yumuşak seçim — kazanan öne çıkar ama keşif ölmez.
 * @param candidates seçilecek değerler
 * @param stats aggregate() çıktısı
 * @param opts.explore 0-1: yüksekse daha çok keşif (varsayılan 0.35)
 * @param opts.random 0-1 üreten fonksiyon (test için enjekte edilir)
 */
export function pickWeighted(candidates, stats, {explore = 0.35, random = Math.random} = {}) {
  if (!candidates.length) return null;
  if (!stats || stats.sampleSize < 3) return candidates[Math.floor(random() * candidates.length)];

  const base = stats.global || 0.01;
  const weights = candidates.map(c => {
    const s = stats.groups.get(c)?.score ?? base;   // hiç denenmemiş = ortalama kabul (keşfe açık)
    return Math.max(0.05, s) ** 2 + explore * base; // kare: iyi olanı belirgin öne çıkarır
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = random() * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

/** Konsola basılacak özet tablo (CI logunda her koşuda görünür). */
export function leaderboard(history, dimensions = ['pillar', 'layout', 'length', 'narrated', 'voice']) {
  const lines = [];
  for (const dim of dimensions) {
    const {groups, sampleSize, global} = aggregate(history, dim);
    if (!sampleSize) continue;
    const rows = [...groups.entries()].sort((a, b) => b[1].score - a[1].score).slice(0, 5);
    lines.push(`  ${dim} (n=${sampleSize}, ort=${global}): ` +
      rows.map(([k, v]) => `${k} ${v.score}${v.n < 3 ? `(n=${v.n})` : ''}`).join(' · '));
  }
  return lines.length ? lines.join('\n') : '  (henüz ölçülmüş post yok)';
}
