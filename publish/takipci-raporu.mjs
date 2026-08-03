// publish/takipci-raporu.mjs
// "Hangi post takipçi getirdi?" — post geçmişini günlük takipçi anlık görüntüleriyle birleştirir.
//
// ZAMANLAMA SÖZLEŞMESİ (raporun doğruluğu buna bağlı):
// Günlük iş hesap ölçümünü koşunun BAŞINDA yapıyor, yayın ise koşunun SONUNDA oluyor.
// Yani D gününün anlık görüntüsü = o günkü post YAYINLANMADAN ÖNCEKİ takipçi sayısı.
// Bu yüzden D'de yayınlanan postun getirisi = takipçi(D + pencere) − takipçi(D).
// Serdar'ın "günde en fazla bir yayın" kuralı bu atfı temiz tutan şey: bir günde iki post
// olsaydı artışı hangisinin getirdiği ayrıştırılamazdı (bkz. publish/gunluk-kota.mjs).
import {readFileSync, existsSync} from 'node:fs';
import {loadBrand} from '../brands/load.mjs';

export const PENCERE = 2;   // gün — bir Reel'in erişimi ~48 saatte oturuyor

/**
 * SAF: her yayınlanmış posta takipçi artışı atar.
 * @param history marka geçmişi ({postedAt, title, pillar, twist, insights})
 * @param gunler  hesap anlık görüntüleri (tarihe göre artan)
 * @param pencere kaç gün sonrasına bakılacağı
 * @returns satırlar — ölçülemeyenler `delta: null` ile döner (uydurma sıfır YOK)
 */
export function takipciAtfi({history = [], gunler = [], pencere = PENCERE}) {
  const tarihe = new Map(gunler.map(g => [g.date, g]));
  const gunEkle = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000)
    .toISOString().slice(0, 10);

  return history
    .filter(h => h.postedAt)
    .map(h => {
      const gun = h.date ?? h.postedAt.slice(0, 10);
      const bas = tarihe.get(gun);
      // Tam gün yoksa pencere içindeki İLK ölçüme düş (koşu atlanmış olabilir).
      let son = null;
      for (let i = pencere; i <= pencere + 2 && !son; i++) son = tarihe.get(gunEkle(gun, i)) ?? null;
      const delta = bas?.followers != null && son?.followers != null
        ? son.followers - bas.followers : null;
      return {
        date: gun, title: h.title, pillar: h.pillar, twist: h.twist ?? null,
        views: h.insights?.views ?? null,
        saved: h.insights?.saved ?? null,
        delta,
        // Takip başına kaç izlenme gerekti — düşük olan içerik daha iyi dönüştürüyor.
        izlenmeBasina: delta > 0 && h.insights?.views ? Math.round(h.insights.views / delta) : null,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Bir eksende (pillar/twist) toplulaştırır — hangi açı takipçi getiriyor. */
export function eksenOzeti(satirlar, eksen = 'pillar') {
  const grup = new Map();
  for (const s of satirlar) {
    if (s.delta == null) continue;
    const k = s[eksen] ?? '—';
    const g = grup.get(k) ?? {anahtar: k, post: 0, takipci: 0, izlenme: 0};
    g.post++; g.takipci += s.delta; g.izlenme += s.views ?? 0;
    grup.set(k, g);
  }
  return [...grup.values()].sort((a, b) => b.takipci - a.takipci);
}

// ── CLI ────────────────────────────────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  const brand = loadBrand();
  const oku = p => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : []);
  const satirlar = takipciAtfi({history: oku(brand.paths.history), gunler: oku(brand.paths.hesap)});

  if (!satirlar.length) { console.log(`· ${brand.slug}: yayınlanmış post yok`); process.exit(0); }
  const olculen = satirlar.filter(s => s.delta != null);
  console.log(`▣ ${brand.handle} — ${satirlar.length} yayın, ${olculen.length} tanesinde takipçi ölçümü var\n`);
  console.log('tarih       takipçi  izlenme  kaydet  1 takip/izlenme  gaf            başlık');
  for (const s of satirlar) {
    const d = s.delta == null ? '   ?' : `${s.delta >= 0 ? '+' : ''}${s.delta}`.padStart(4);
    console.log(`${s.date}  ${d}  ${String(s.views ?? '?').padStart(7)}  ${String(s.saved ?? '?').padStart(6)}`
      + `  ${String(s.izlenmeBasina ?? '—').padStart(15)}  ${String(s.twist ?? '—').padEnd(14)} ${s.title}`);
  }
  if (!olculen.length) {
    console.log('\n· Henüz atıf yapılamıyor: hesap ölçümü yeni başladı, ilk sonuç ~2 gün sonra.');
    process.exit(0);
  }
  for (const eksen of ['twist', 'pillar']) {
    console.log(`\n— ${eksen} ekseni —`);
    for (const g of eksenOzeti(olculen, eksen)) {
      console.log(`  ${String(g.anahtar).padEnd(18)} ${String(g.post).padStart(2)} post  `
        + `${g.takipci >= 0 ? '+' : ''}${g.takipci} takipçi  (${g.izlenme} izlenme)`);
    }
  }
}
