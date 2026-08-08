// publish/retansiyon-denetci.mjs
// GÖRSEL DEĞİŞİM DENETÇİSİ — "bu bir video mu, yoksa 30 saniye ekranda duran bir slayt mı?"
//
// NEDEN (2026-08-08 ölçümü):
// İki sayfanın 13 yayınlanmış reel'inin TAMAMINDA ortalama izlenme 3,4-11,2 sn; video süresi
// 40-45 sn → izlenme oranı %7-25. Sektör ölçütü 30 sn altı reel için %50 üstü. Bu bir varyans
// değil SEVİYE sorunu (13 videonun 13'ü de aynı bandda; n=13'te tüm korelasyonlar ~0, yani
// "hangi video neden tuttu" sorusu bu veriyle CEVAPLANAMAZ — ama seviyenin nedeni ölçülebilir).
//
// ÖLÇÜM: ffmpeg `scdet` filtresi her kare için `mafd` (ortalama mutlak kare farkı) verir —
// ekranın o an ne kadar değiştiğinin sürekli ölçüsü. Sahne-skoru eşiğiyle "kesme sayma"
// YETMİYOR: sürekli hareket eden bir video hiç kesme içermeden de canlıdır. Bu yüzden iki
// sağlıklı desen de kabul edilir:
//
//   canlı kare oranı yüksek  → ekran sürekli değişiyor (kamera hareketi, akan animasyon)
//   olay sıklığı yüksek      → sık sık büyük değişimler var (kesme, kart değişimi)
//
// Kalibrasyon (aynı ölçüm, dört video):
//   sert kesmeli kontrol : en uzun donuk 1,5s · canlı kare %2   · 0,63 olay/sn   ✓
//   sürekli hareket kontr: en uzun donuk 0,0s · canlı kare %100 · —              ✓
//   kizlarkodu-latest    : en uzun donuk 4,2s · canlı kare %3   · 0,35 olay/sn   ✗
//   ciltkodu-latest      : en uzun donuk 12,6s· canlı kare %1   · 0,15 olay/sn   ✗
//
// Yani videolarımız ölçülen her şeyin EN DONUĞU: ekran karelerin %97-99'unda donmuş VE
// üstünde olan hiçbir şey "olay" sayılacak kadar büyük değil. ciltkodu'nda donukluk 0,2s'de
// başlıyor — yani hook'un tamamı ve ilk kart tek bir donmuş görüntü.
//
// ÖLÇEN ARAÇ DA ÖLÇÜLMELİ: eşikler yukarıdaki dört videoyla İKİ YÖNLÜ sınandı — iki sağlıklı
// desen geçer, iki gerçek videomuz kalır. Eşik değiştiren, bu dört ölçümü tekrar koştursun.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const calistir = promisify(execFile);

// mafd eşikleri (kalibrasyon yukarıda).
export const CANLI_ESIK = 0.5;  // bu kareyi "ekran gözle görülür değişti" saymak için
export const OLAY_ESIK = 1.0;   // bunu "izleyicinin fark ettiği bir olay" saymak için

// Kabul sınırları — ürün iddiası, tahmin değil.
export const SINIR = {
  enUzunDonukSn: 3.0,     // hiçbir görsel olayın olmadığı en uzun aralık
  acilisDonukSn: 1.2,     // ilk canlı kareye kadar geçen süre (hook donması)
  canliKareOrani: 0.25,   // VEYA ↓
  olayHizi: 0.5,          // saniyede olay — ikisinden biri karşılanmalı
  maxSureSn: 32,          // metin+b-roll formatı için üst sınır
};

/** `ffmpeg`/`ffprobe` yollarını çözer — WSL'de ~/bin altında duruyorlar. */
export function araclar(env = process.env) {
  return {
    ffmpeg: env.FFMPEG_PATH || 'ffmpeg',
    ffprobe: env.FFPROBE_PATH || 'ffprobe',
  };
}

/** Her kare için `[zamanSn, mafd]` serisi. */
export async function mafdSerisi(video, {ffmpeg} = araclar()) {
  const {stdout, stderr} = await calistir(ffmpeg, [
    '-v', 'error', '-i', video,
    '-vf', 'scdet=threshold=0,metadata=print:file=-',
    '-an', '-f', 'null', '-',
  ], {maxBuffer: 256 * 1024 * 1024});
  return ayiklaSeri(`${stdout}\n${stderr}`);
}

/**
 * SAF — `metadata=print` çıktısını `[zaman, mafd]` çiftlerine ayırır.
 * İlk kare atılır: önceki karesi olmadığı için mafd'si anlamsız (hep 0).
 */
export function ayiklaSeri(cikti) {
  const seri = [];
  let t = null;
  for (const satir of String(cikti).split('\n')) {
    const zaman = /pts_time:([0-9.]+)/.exec(satir);
    if (zaman) { t = Number(zaman[1]); continue; }
    const m = /scd\.mafd=([0-9.]+)/.exec(satir);
    if (m && t != null) seri.push([t, Number(m[1])]);
  }
  return seri.slice(1);
}

/**
 * SAF — mafd serisinden donukluk profili çıkarır.
 * Videonun sonundaki kuyruk da donuk aralıktır (kapanış kartı çakılı kalıyorsa burada görünür).
 */
export function profil(seri, {canliEsik = CANLI_ESIK, olayEsik = OLAY_ESIK} = {}) {
  if (!seri.length) return null;
  const sure = seri[seri.length - 1][0];
  let enUzun = 0, enUzunBas = 0, sonCanli = 0, ilkCanli = null;
  let canliKare = 0, olay = 0;
  for (const [t, m] of seri) {
    if (m >= olayEsik) olay++;
    if (m >= canliEsik) {
      canliKare++;
      if (ilkCanli == null) ilkCanli = t;
      if (t - sonCanli > enUzun) { enUzun = t - sonCanli; enUzunBas = sonCanli; }
      sonCanli = t;
    }
  }
  if (sure - sonCanli > enUzun) { enUzun = sure - sonCanli; enUzunBas = sonCanli; }
  return {
    sureSn: yuvarla(sure),
    enUzunDonukSn: yuvarla(enUzun),
    enUzunDonukBaslangic: yuvarla(enUzunBas),
    acilisDonukSn: yuvarla(ilkCanli == null ? sure : ilkCanli),
    canliKareOrani: yuvarla(canliKare / seri.length),
    olayHizi: yuvarla(olay / Math.max(sure, 0.001)),
    olayAdedi: olay,
    ortancaMafd: yuvarla(ortanca(seri.map(s => s[1]))),
  };
}

/** SAF — profili sınırlara vurur, bulgu listesi döner. */
export function bulgular(p, sinir = SINIR) {
  const b = [];
  if (!p) return ['video okunamadı (kare yok)'];
  if (p.enUzunDonukSn > sinir.enUzunDonukSn) {
    b.push(`en uzun donuk aralık ${p.enUzunDonukSn}s (sınır ${sinir.enUzunDonukSn}s) — ` +
      `${p.enUzunDonukBaslangic}s'de başlıyor`);
  }
  if (p.acilisDonukSn > sinir.acilisDonukSn) {
    b.push(`açılış ${p.acilisDonukSn}s donuk (sınır ${sinir.acilisDonukSn}s) — hook kilitleniyor`);
  }
  // İki sağlıklı desenden BİRİ yeterli: ya ekran sürekli canlı, ya da sık olay var.
  if (p.canliKareOrani < sinir.canliKareOrani && p.olayHizi < sinir.olayHizi) {
    b.push(`ne sürekli hareket ne de olay var: canlı kare %${(p.canliKareOrani * 100).toFixed(0)} ` +
      `(sınır %${sinir.canliKareOrani * 100}) ve saniyede ${p.olayHizi} olay (sınır ${sinir.olayHizi})`);
  }
  if (p.sureSn > sinir.maxSureSn) b.push(`süre ${p.sureSn}s (sınır ${sinir.maxSureSn}s)`);
  return b;
}

/** Bir videoyu ölçer ve karar verir. */
export async function denetle(video, {sinir = SINIR, ara = araclar()} = {}) {
  const p = profil(await mafdSerisi(video, ara));
  const b = bulgular(p, sinir);
  return {video, profil: p, bulgular: b, gecti: b.length === 0};
}

/** İnsan okuyacak rapor. */
export function rapor(s) {
  const p = s.profil;
  const satir = [`${s.gecti ? '✓' : '✗'} ${s.video} — ${p ? p.sureSn + 's' : '?'}`];
  if (p) {
    satir.push(`   en uzun donuk ${p.enUzunDonukSn}s (@${p.enUzunDonukBaslangic}s) · ` +
      `açılış donuk ${p.acilisDonukSn}s`);
    satir.push(`   canlı kare %${(p.canliKareOrani * 100).toFixed(0)} · ` +
      `saniyede ${p.olayHizi} olay (${p.olayAdedi}) · ortanca mafd ${p.ortancaMafd}`);
  }
  for (const x of s.bulgular) satir.push(`   ✗ ${x}`);
  return satir.join('\n');
}

function ortanca(a) {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
}
function yuvarla(v) { return Math.round(v * 1000) / 1000; }

if (import.meta.url === `file://${process.argv[1]}`) {
  const videolar = process.argv.slice(2);
  if (!videolar.length) {
    console.error('kullanım: node publish/retansiyon-denetci.mjs <video.mp4> [...]');
    process.exit(2);
  }
  let hepsi = true;
  for (const v of videolar) {
    const s = await denetle(v);
    console.log(rapor(s));
    if (!s.gecti) hepsi = false;
  }
  process.exit(hepsi ? 0 : 1);
}
