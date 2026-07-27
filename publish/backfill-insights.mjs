// publish/backfill-insights.mjs
// Geçmişteki, mediaId'si olan ama insights'ı henüz olmayan ve >20s (saat) yaşındaki
// postların insight'larını doldurur. Yayını bloklamaz — best-effort.
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {fetchInsights} from './fetch-insights.mjs';
import {loadBrand, credentials} from '../brands/load.mjs';

// MARKAYA DUYARLI: her sayfanın kendi geçmişi ve kendi token'ı var. Sabit yol kullanılırsa
// ikinci sayfanın skor tablosu hiç dolmaz (ve birinci sayfanınki yanlış token'la denenir).
const brand = loadBrand();
const token = credentials(brand).igToken;
const histPath = brand.paths.history;
if (!existsSync(histPath)) {
  console.log(`· ${brand.slug}: geçmiş dosyası yok, doldurulacak insight yok`);
  process.exit(0);
}
if (!token) {
  console.log(`· ${brand.slug}: IG token yok, insight atlandı`);
  process.exit(0);
}
const hist = JSON.parse(readFileSync(histPath));
const MIN_AGE_MS = 20 * 3600 * 1000;
const REFRESH_WINDOW_MS = 14 * 24 * 3600 * 1000;   // 2 hafta boyunca sayılar büyümeye devam eder
const REFRESH_AFTER_MS = 20 * 3600 * 1000;

let changed = false;
for (const e of hist) {
  if (!e.mediaId) continue;
  const age = e.postedAt ? Date.now() - new Date(e.postedAt).getTime() : Infinity;
  if (age < MIN_AGE_MS) continue;
  // İlk ölçümden sonra da tazele: erişim günlerce büyüyor, tek snapshot yanıltıyor.
  if (e.insights) {
    const measuredAgo = e.insightsAt ? Date.now() - new Date(e.insightsAt).getTime() : Infinity;
    if (age > REFRESH_WINDOW_MS || measuredAgo < REFRESH_AFTER_MS) continue;
  }
  try {
    e.insights = await fetchInsights({mediaId: e.mediaId, token});
    e.insightsAt = new Date().toISOString();
    console.log(`✓ insights ${e.mediaId}`, e.insights);
    changed = true;
  } catch (err) {
    console.error(`⚠ insights ${e.mediaId}:`, err.message);
  }
}
if (changed) writeFileSync(histPath, JSON.stringify(hist, null, 2));
else console.log('· doldurulacak yeni insight yok');
