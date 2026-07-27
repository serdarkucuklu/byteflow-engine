// publish/fetch-insights.mjs
// Bir IG medya (Reel) için insight metriklerini çeker. Best-effort — çağıran hataları yutabilir.
//
// ⚠ 2026-07-27: Meta `plays` metriğini kaldırmış; eski liste HTTP 400 döndürüyordu ve hata
// yutulduğu için 29 postun HİÇBİRİNDE insight birikmemişti (ölçüm hattı sessizce ölüydü).
// Doğru isimler canlı doğrulandı. `ig_reels_avg_watch_time` milisaniyedir ve retention'ın tek
// gerçek göstergesidir — skor tablosunun omurgası odur.
const GRAPH = 'https://graph.facebook.com/v21.0';
export const METRICS = [
  'views',                          // toplam izlenme (tekrarlar dahil)
  'reach',                          // kaç ayrı hesaba ulaştı
  'saved',                          // kaydetme — algoritmanın en güçlü kalite sinyali
  'shares',
  'total_interactions',
  'ig_reels_avg_watch_time',        // ms — ortalama izlenen süre
  'ig_reels_video_view_total_time', // ms — toplam izlenen süre
];

export async function fetchInsights({mediaId, token, fetchFn = fetch, metrics = METRICS}) {
  const url = `${GRAPH}/${mediaId}/insights?metric=${metrics.join(',')}&access_token=${token}`;
  const res = await fetchFn(url);
  if (!res.ok) throw new Error(`insights HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const out = {};
  for (const m of data.data ?? []) out[m.name] = m.values?.[0]?.value ?? 0;
  return out;
}
