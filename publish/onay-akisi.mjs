// ONAY DÖNGÜSÜ — hiçbir video Serdar görmeden yayınlanmaz.
//
//   node publish/onay-akisi.mjs            # kuyruğa koy + karar bekle + kararı uygula
//   node publish/onay-akisi.mjs --nobet    # bekleyen bir KARAR varsa uygula (cron nöbetçisi)
//
// Akış:
//   üretim biter → video repoya itilir → onaybox'a kuyruğa girer → Serdar'a e-posta/Telegram
//   → konsolda karar → burada uygulanır:
//     · onayla → Instagram + Facebook yayını, mediaId geçmişe, sonuç bildirimi
//     · tekrar → beğenilmeyen deneme geçmişten SİLİNİR, notla yeni video üretilir, yeni
//                deneme aynı kalemin altında tekrar onaya sunulur (döngü)
//     · vazgeç → deneme çöpe, bugün yayın yok
//
// Kritik kural: kalem çözülene kadar (yayın/vazgeç) onaybox yeni video kabul etmez — yani
// "onayda bekleyen varken bir sonraki gün yeni video üretilmez" kilidi SUNUCUDA duruyor,
// iş akışının iyi niyetinde değil.
import {readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync} from 'node:fs';
import {execFileSync, execSync} from 'node:child_process';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadBrand, credentials} from '../brands/load.mjs';
import {OnayIstemci} from './onay-client.mjs';
import {redEkle} from '../brain/red-defteri.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const brand = loadBrand();
const istemci = new OnayIstemci();
const bayrak = ad => process.argv.includes(ad);

const BEKLEME_DK = Number(process.env.ONAY_BEKLEME_DK || 170);
const YOKLAMA_SN = Number(process.env.ONAY_YOKLAMA_SN || 15);
const KOSUCU = process.env.GITHUB_RUN_ID ? `gh-${process.env.GITHUB_RUN_ID}` : `yerel-${process.pid}`;
const REPO = process.env.GITHUB_REPOSITORY || 'serdarkucuklu/byteflow-engine';
// Her marka KENDİ dosyasına yazar; iki marka aynı public/latest.mp4'ü ezerse yayınlar karışır.
// (byteflow'un `public/latest.mp4` istisnası 2026-08-03'te kalktı: sayfa @etiket.kodu'ya
// dönüştürüldü ve marka emekli edildi — emekli markanın özel durumu ölü kod demektir.)
const VIDEO_YOLU = process.env.VIDEO_PATH || `public/${brand.slug}-latest.mp4`;

const bekle = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(...a);

if (!istemci.aktifMi) {
  console.error('✖ ONAY_BASE_URL / ONAY_INGEST_KEY yok — onay akışı çalıştırılamaz.');
  process.exit(1);
}

// ---------------------------------------------------------------- yardımcılar

function specOku() {
  return JSON.parse(readFileSync(brand.paths.spec, 'utf8'));
}

function gecmisOku() {
  return existsSync(brand.paths.history) ? JSON.parse(readFileSync(brand.paths.history, 'utf8')) : [];
}

function gecmisYaz(h) {
  mkdirSync(dirname(brand.paths.history), {recursive: true});
  writeFileSync(brand.paths.history, JSON.stringify(h, null, 2));
}

/**
 * Çöpe atılan denemeyi geçmişten çıkar.
 * Geçmiş bir YAYIN defteridir: yayınlanmamış bir deneme orada durursa tema/düzen rotasyonu
 * (history.length'e bakıyor) ve skor tablosu yanlış sayar. Silinen kaydın öznesini geri
 * döndürüyoruz — not yazılmadıysa çağıran onu yasak listesine koyacak.
 */
function sonDenemeyiDus() {
  const h = gecmisOku();
  const son = h.pop() ?? null;
  gecmisYaz(h);
  if (son) log(`↩ çöpe atılan deneme geçmişten düşürüldü: ${son.title}`);
  return son;
}

/** Kapak karesi — bildirimde ve konsolda videonun yüzü. */
function kapakCikar(videoDosya, hedef, offsetMs = 1300) {
  try {
    execFileSync('ffmpeg', ['-y', '-ss', String(Math.max(0, offsetMs) / 1000), '-i', videoDosya,
      '-frames:v', '1', '-vf', 'scale=540:-2', '-q:v', '4', hedef], {stdio: 'pipe'});
    return existsSync(hedef) ? hedef : null;
  } catch (e) {
    console.error(`⚠ kapak çıkarılamadı: ${e.message.slice(0, 120)}`);
    return null;
  }
}

function videoUrl(sha) {
  return `https://raw.githubusercontent.com/${REPO}/${sha}/${VIDEO_YOLU}`;
}

function itVeSha(mesaj) {
  const yollar = [VIDEO_YOLU, 'scene-spec.generated.json', 'render/scene-spec.json',
    'posted-history.json', 'brands/state'];
  const cikti = execFileSync('bash', [join(root, 'publish', 'repo-push.sh'), mesaj, ...yollar],
    {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit']});
  const sha = cikti.trim().split('\n').pop().trim();
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error(`push sonrası SHA okunamadı: ${sha}`);
  return sha;
}

/** Üretilen videoyu kuyruğa koy (ilk deneme ya da tekrar denemesi) ve Serdar'a sor. */
async function kuyrugaKoy({id = null, url}) {
  const spec = specOku();
  const gecmis = gecmisOku();
  const son = gecmis[gecmis.length - 1] ?? {};
  const video = join(root, 'dist', 'final.mp4');
  if (!existsSync(video)) throw new Error('dist/final.mp4 yok — üretim tamamlanmamış');

  const {id: kalemId, deneme} = await istemci.kuyrugaAl({
    id, marka: brand.slug, handle: brand.handle,
    baslik: spec.title, ozet: spec.hook ?? '',
    tema: spec.theme ?? brand.themes?.[0],
    meta: {
      subject: spec.subject ?? son.subject ?? null, twist: son.twist ?? null,
      pillar: son.pillar ?? null, layout: son.layout ?? null, kinds: son.kinds ?? null,
      motion: son.motion ?? null, durSec: son.durSec ?? null, voiceName: son.voiceName ?? null,
      not: son.not ?? null,
    },
    spec, videoUrl: url,
  });

  await istemci.medyaYukle(kalemId, 'video', video);
  const kapak = kapakCikar(video, join(root, 'dist', 'kapak.jpg'), spec.thumbOffset ?? 1300);
  if (kapak) await istemci.medyaYukle(kalemId, 'poster', kapak);

  const {bildirim} = await istemci.hazir(kalemId);
  log(`✉ onaya sunuldu (${deneme}. deneme) — e-posta: ${bildirim?.eposta?.gonderildi ? 'gitti' : bildirim?.eposta?.sebep}` +
      ` · telegram: ${bildirim?.telegram?.gonderildi ? bildirim.telegram.tip : bildirim?.telegram?.sebep}`);
  return kalemId;
}

// ---------------------------------------------------------------- kararlar

async function yayinla(kalem, kap) {
  // Nöbetçi taze bir checkout'ta çalışıyor olabilir: yayınlanacak spec'in TEK doğru kaynağı
  // onaybox'taki kalem (diskteki dosya başka bir koşudan kalmış olabilir).
  if (kap.spec) writeFileSync(brand.paths.spec, JSON.stringify(kap.spec, null, 2));
  const url = kap.videoUrl || kalem.videoUrl;
  if (!url) throw new Error('yayınlanacak video adresi yok');

  log(`▶ yayınlanıyor: ${kap.spec?.title ?? kalem.baslik}`);
  execFileSync('node', [join(root, 'publish', 'publish-latest.mjs'), url],
    {cwd: root, stdio: 'inherit'});

  const sonucDosya = join(root, 'dist', 'yayin-sonucu.json');
  const sonuc = existsSync(sonucDosya) ? JSON.parse(readFileSync(sonucDosya, 'utf8')) : {};
  // mediaId'yi publish-latest zaten geçmişe yazdı; commit edilmezse hiç yazılmamış sayılır.
  try {
    itVeSha(`chore: onaylı yayın ${new Date().toISOString().slice(0, 10)}`);
  } catch (e) {
    console.error(`⚠ geçmiş push edilemedi (yayın yapıldı): ${e.message}`);
  }
  await istemci.sonuc(kalem.id, {ok: true, karar: 'onayla',
    mediaId: sonuc.mediaId ?? null, igUrl: sonuc.permalink ?? null});
  log(`✓ yayınlandı — ${sonuc.permalink ?? sonuc.mediaId ?? 'mediaId yok'}`);
}

async function yenidenUret(kalem, kap) {
  const atilan = sonDenemeyiDus();
  const not = (kap.not ?? '').trim();
  const env = {...process.env, BYTEFLOW_VOICE: '1', BYTEFLOW_NOT: not};
  // Not yoksa "başka bir şey anlat" demektir → beğenilmeyen özne bugün yasak.
  // Not varsa yasaklamıyoruz: not aynı konunun daha iyi işlenmesini isteyebilir.
  // Deftere de yazılıyor: bu koşu zaman aşımına uğrarsa işi nöbetçi cron'un açtığı BAŞKA bir
  // koşu devralıyor ve ortam değişkeni onunla gitmiyor.
  if (!not && atilan?.subject) {
    env.BYTEFLOW_YASAK_KONU = atilan.subject;
    redEkle(brand.paths.red, atilan);
  }
  log(`↻ yeniden üretiliyor${not ? ` — not: "${not}"` : ' (not yok: bambaşka bir konu)'}`);

  const komut = process.env.ONAY_URET_KOMUT || 'xvfb-run -a node run-daily.mjs';
  execSync(komut, {cwd: root, stdio: 'inherit', env});

  const cikti = join(root, 'dist', 'final.mp4');
  mkdirSync(join(root, dirname(VIDEO_YOLU)), {recursive: true});
  copyFileSync(cikti, join(root, VIDEO_YOLU));
  const sha = itVeSha(`chore: onay tekrarı ${new Date().toISOString().slice(0, 10)}`);
  await kuyrugaKoy({id: kalem.id, url: videoUrl(sha)});
}

async function vazgec(kalem) {
  const atilan = sonDenemeyiDus();
  // Beğenilmeyen özne BUGÜN bir daha çıkmasın. "Tekrar dene"deki yasak bir ortam değişkeniydi
  // ve aynı süreçte yaşıyordu; vazgeçten sonra üretimi YENİ bir koşu yapıyor. O koşunun tek
  // hafızası bu defter — 2026-08-03'te defter yokken reddedilen "polyester" bir saat sonra
  // aynı gaf ve aynı kurguyla geri geldi.
  const kayit = redEkle(brand.paths.red, atilan);
  if (kayit) log(`⛔ red defterine yazıldı: ${kayit.subject} (bugün yasak)`);
  try {
    itVeSha(`chore: onaydan vazgeçildi ${new Date().toISOString().slice(0, 10)}`);
  } catch (e) {
    console.error(`⚠ geçmiş push edilemedi: ${e.message}`);
  }
  await istemci.sonuc(kalem.id, {ok: true, karar: 'vazgec'});
  log('· vazgeçildi — bugün yayın yok');
}

/** Kararı kap ve uygula. Dönen: 'bitti' | 'devam' (tekrar → yeniden beklenecek). */
async function kararUygula(kalem) {
  let kap;
  try {
    kap = await istemci.kap(kalem.id, KOSUCU);
  } catch (e) {
    if (e.kod === 409) { log(`· kararı başka bir koşucu aldı (${e.veri?.hata ?? ''})`); return 'bitti'; }
    throw e;
  }
  try {
    if (kap.karar === 'onayla') { await yayinla(kalem, kap); return 'bitti'; }
    if (kap.karar === 'vazgec') { await vazgec(kalem); return 'bitti'; }
    await yenidenUret(kalem, kap);
    return 'devam';
  } catch (e) {
    // Hata konsolda görünsün: Serdar tekrar deneyebilsin, sessizce kaybolmasın.
    console.error(`✖ karar uygulanamadı: ${e.message}`);
    await istemci.sonuc(kalem.id, {ok: false, karar: kap.karar, hata: e.message.slice(0, 300)});
    return 'bitti';
  }
}

// ---------------------------------------------------------------- ana akış

const bitis = Date.now() + BEKLEME_DK * 60_000;

/**
 * Yoklama SERVİSİN kısa kesintisine dayanmalı. Nöbet 2,8 saat sürüyor; onaybox'ın yeniden
 * başlatıldığı 3 saniyede atılan tek bir ağ hatası bütün nöbeti düşürüyordu ve karar ancak
 * 15 dakikalık nöbetçi cron'la uygulanabiliyordu. Üst üste 8 hata (≈2 dk) gerçek arızadır,
 * o zaman hatayı yükselt.
 */
async function durumYokla(ardArda = {n: 0}) {
  try {
    const d = await istemci.durum(brand.slug);
    ardArda.n = 0;
    return d;
  } catch (e) {
    if (++ardArda.n >= 8) throw e;
    console.error(`⚠ onaybox'a ulaşılamadı (${ardArda.n}/8): ${e.message.slice(0, 120)}`);
    return null;
  }
}

async function bekleVeUygula() {
  let bildirildi = false;
  const ardArda = {n: 0};
  while (Date.now() < bitis) {
    const yoklama = await durumYokla(ardArda);
    if (!yoklama) { await bekle(YOKLAMA_SN * 1000); continue; }
    const {kalem, bekleyenVar} = yoklama;
    if (!bekleyenVar || !kalem) { log('· bekleyen kalem yok — çıkılıyor'); return; }
    if (kalem.durum === 'karar-verildi') {
      log(`◆ karar geldi: ${kalem.karar}${kalem.not ? ` — "${kalem.not}"` : ''}`);
      if (await kararUygula(kalem) === 'bitti') return;
      bildirildi = false;
      continue;
    }
    if (kalem.durum === 'uygulaniyor') {
      // Başka bir koşucu (nöbetçi) işi almış: burada beklemenin anlamı yok.
      log('· kararı başka bir koşucu uyguluyor — çıkılıyor');
      return;
    }
    if (!bildirildi) {
      const kalanDk = Math.round((bitis - Date.now()) / 60_000);
      log(`⏳ karar bekleniyor (${kalem.durum}) — bu koşu ${kalanDk} dk daha nöbette`);
      bildirildi = true;
    }
    await bekle(YOKLAMA_SN * 1000);
  }
  log('⏰ nöbet süresi doldu — kalem onayda kaldı. Karar verilince nöbetçi cron uygulayacak.');
}

async function ana() {
  const {kalem, bekleyenVar} = await istemci.durum(brand.slug);

  if (bayrak('--nobet')) {
    if (!bekleyenVar || !kalem) { log('· bekleyen kalem yok'); return; }
    if (kalem.durum !== 'karar-verildi') { log(`· uygulanacak karar yok (durum: ${kalem.durum})`); return; }
    log(`◆ nöbetçi kararı aldı: ${kalem.karar}`);
    if (await kararUygula(kalem) === 'devam') await bekleVeUygula();
    return;
  }

  // Normal akış: bu koşu taze bir video üretti, kuyruğa koy.
  if (bekleyenVar && kalem && kalem.durum !== 'hazirlaniyor') {
    // Sunucu zaten reddederdi; burada erken ve anlaşılır çıkıyoruz.
    log(`· zaten onayda bekleyen kalem var (${kalem.baslik}) — yeni video kuyruğa alınmıyor`);
  } else {
    const url = process.argv.find(a => a.startsWith('https://'));
    // ⚠ 2026-08-03 CANLI HATA: iş akışı, üretim ADIMI ATLANDIĞINDA bu script'i adressiz
    // çağırıyor (onay kapısı ya da günlük kota engellediyse) — ve burada "adres şart" diye
    // patlıyordu. Sonuç: yayın yapılan HER günün kendi cron'u kırmızı düşüyordu (o gün zaten
    // yayınlanmıştı, kota ikinci videoyu doğru şekilde engellemişti). Gerçek arızayı gizleyen
    // sahte kırmızı. Adres yoksa ortada kuyruğa konacak video da yoktur: sessizce çık.
    if (!url) {
      log('· bu koşu video üretmedi (onay kapısı ya da günlük kota) — kuyruğa konacak bir şey yok');
      return;
    }
    await kuyrugaKoy({url});
  }
  await bekleVeUygula();
}

await ana();
