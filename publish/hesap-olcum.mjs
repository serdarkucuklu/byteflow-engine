// publish/hesap-olcum.mjs
// HESAP DÜZEYİ ölçüm — günlük takipçi/profil anlık görüntüsü.
//
// Neden: motor bugüne kadar yalnız POST düzeyinde ölçüyordu (izlenme, kaydetme, tutunma).
// Ama hedef izlenme değil TAKİPÇİ. 1000 izlenen bir postun kaç takip getirdiğini bilmeden
// "hangi içerik sayfayı büyütüyor" sorusu cevaplanamaz; izlenmeyi optimize etmek bizi
// izlenmesi yüksek ama takip getirmeyen içeriğe sürükleyebilir.
//
// ⚠ TASARIM KARARI — metrikler TEK TEK çekilir: 2026-07'de Meta `plays` metriğini kaldırdı,
// tek istekte gönderilen listenin tamamı HTTP 400 döndü ve hata yutulduğu için 29 postun
// hiçbirinde insight birikmedi (ölçüm hattı aylarca sessizce ölüydü). Aynı tuzağa ikinci kez
// düşmemek için: her metrik ayrı istek, biri düşerse diğerleri yaşar, DÜŞEN LOG'A YAZILIR.
//
// Omurga `followers_count`: insight değil, temel node alanı — Meta'nın metrik adı
// değiştirmelerinden etkilenmez. Diğerleri bonus.
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {loadBrand, credentials} from '../brands/load.mjs';

const GRAPH = 'https://graph.facebook.com/v21.0';
const TZ = 'Europe/Istanbul';

// Adı/parametresi değişebilecek insight'lar. Düşen olursa koşu ölmez, uyarı basar.
//
// ⚠ Biçimler @byteflowlabs hesabında CANLI doğrulandı (2026-08-03) — ezberden yazılmadı:
//  · profile_views ve reach `metric_type=total_value` İSTİYOR. Onsuz HTTP 400 ("should be
//    specified with parameter metric_type"). reach onsuz da çalışıyor ama gün gün dizi
//    döndürüyor ve son eleman YARIM GÜN oluyordu (0 okunuyordu); total_value tek temiz sayı.
//  · follows_and_unfollows hata vermiyor, BOŞ dizi dönüyor (breakdown=follow_type ile de).
//    Meta küçük hesaplarda bu kırılımı vermiyor. Boş = "henüz yok", hata değil — bu ayrım
//    önemli: her koşuda sahte bir uyarı basarsa uyarılar gürültüye dönüşür ve gerçek
//    bozulmayı kimse fark etmez (bu sayfada ölçüm hattı tam bu yüzden aylarca ölü kaldı).
export const HESAP_METRIKLERI = [
  {ad: 'reach', params: 'period=day&metric_type=total_value'},
  {ad: 'views', params: 'period=day&metric_type=total_value'},
  {ad: 'profile_views', params: 'period=day&metric_type=total_value'},
  {ad: 'accounts_engaged', params: 'period=day&metric_type=total_value'},
  {ad: 'follows_and_unfollows', params: 'period=day&metric_type=total_value&breakdown=follow_type', bosOlabilir: true},
];

export function bugun(now = new Date(), tz = TZ) {
  return new Intl.DateTimeFormat('sv-SE', {timeZone: tz}).format(now);
}

/** Takipçi ve post sayısı — temel node alanları, insight değil. */
export async function hesapAnlik({igUserId, token, fetchFn = fetch}) {
  const url = `${GRAPH}/${igUserId}?fields=followers_count,media_count&access_token=${token}`;
  const res = await fetchFn(url);
  if (!res.ok) throw new Error(`hesap HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const d = await res.json();
  return {followers: d.followers_count ?? null, mediaCount: d.media_count ?? null};
}

/**
 * Insight metriklerini TEK TEK çeker. Düşenler `hatalar`a yazılır — sessizce yutulmaz.
 * @returns {{metrikler: Object, hatalar: string[]}}
 */
export async function hesapMetrikleri({igUserId, token, fetchFn = fetch, metrikler = HESAP_METRIKLERI}) {
  const out = {}, hatalar = [];
  for (const m of metrikler) {
    const url = `${GRAPH}/${igUserId}/insights?metric=${m.ad}&${m.params}&access_token=${token}`;
    try {
      const res = await fetchFn(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 120)}`);
      const d = await res.json();
      const kalem = d.data?.[0];
      // Meta bazı metrikleri küçük hesaplarda hiç doldurmuyor: boş dizi HATA DEĞİL.
      if (!kalem && m.bosOlabilir) continue;
      // metric_type=total_value → total_value.value; eski period=day biçimi → values[]
      const deger = kalem?.total_value?.value ?? kalem?.values?.at(-1)?.value ?? null;
      if (deger === null) throw new Error('değer yok (metrik adı ya da parametresi değişmiş olabilir)');
      out[m.ad] = deger;
    } catch (err) {
      hatalar.push(`${m.ad}: ${err.message}`);
    }
  }
  return {metrikler: out, hatalar};
}

/**
 * Günlük kaydı ekler/günceller (aynı gün iki kez koşarsa üzerine yazar). SAF.
 * Kayıtlar tarihe göre artan sırada tutulur — rapor tarafı sıralı olduğunu varsayıyor.
 */
export function gunuEkle(kayitlar = [], yeni) {
  const kalan = kayitlar.filter(k => k.date !== yeni.date);
  return [...kalan, yeni].sort((a, b) => a.date.localeCompare(b.date));
}

// ── CLI ────────────────────────────────────────────────────────────────────────
// node publish/hesap-olcum.mjs
if (import.meta.url === `file://${process.argv[1]}`) {
  const brand = loadBrand();
  const {igUserId, igToken} = credentials(brand);
  if (!igUserId || !igToken) {
    console.log(`· ${brand.slug}: IG kimliği yok, hesap ölçümü atlandı`);
    process.exit(0);
  }
  const path = brand.paths.hesap;
  const kayitlar = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : [];

  const anlik = await hesapAnlik({igUserId, token: igToken});
  const {metrikler, hatalar} = await hesapMetrikleri({igUserId, token: igToken});
  for (const h of hatalar) console.error(`⚠ hesap metriği alınamadı → ${h}`);

  const kayit = {date: bugun(), ...anlik, metrikler, olcumAt: new Date().toISOString()};
  const guncel = gunuEkle(kayitlar, kayit);
  writeFileSync(path, JSON.stringify(guncel, null, 2));

  const oncekiler = guncel.filter(k => k.date < kayit.date);
  const dun = oncekiler.at(-1);
  const fark = dun?.followers != null && kayit.followers != null ? kayit.followers - dun.followers : null;
  console.log(`▣ ${brand.handle}: ${kayit.followers} takipçi`
    + (fark === null ? ' (ilk ölçüm)' : ` (${fark >= 0 ? '+' : ''}${fark} / ${dun.date})`)
    + `, ${kayit.mediaCount} post`);
}
