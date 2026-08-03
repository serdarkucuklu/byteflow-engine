// publish/eslestir-mediaid.mjs
// Kaybolan mediaId'leri hesabın GERÇEK medya listesinden geri kurtarır.
//
// Neden: 2026-08-02'ye kadar daily.yml yalnız posted-history.json'ı commit'liyordu; markanın
// kendi geçmişine (brands/state/<slug>-history.json) yazılan mediaId her koşuda kayboluyordu.
// Sonuç: @cilt.kodu'nun 16 kaydının 13'ünde mediaId yok → insight backfill onları hiç göremiyor
// → skor tablosu (sampleSize >= 3 şartı) o sayfada hiç açılmadı. Postlar Instagram'da duruyor;
// kopan şey postun kendisi değil, geçmiş kaydıyla arasındaki BAĞ.
//
// Eşleştirme SAF ve MUHAFAZAKÂR: emin olmadığı yerde boş bırakır, asla tahmin yazmaz.
// Yanlış eşleşme eksik eşleşmeden çok daha pahalı — yanlış mediaId'nin insight'ı sessizce
// başka postun skoruna yazılır ve konu seçimini yanlış yöne çeker (ölçüm hattının tamamı
// bu dosyanın doğruluğuna yaslanıyor).
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {subjectTokens} from '../brain/subjects.mjs';
import {loadBrand, credentials} from '../brands/load.mjs';

const GRAPH = 'https://graph.facebook.com/v21.0';
const TZ = 'Europe/Istanbul';

// Eşiği yükseltmek kurtarılan post sayısını düşürür, düşürmek yanlış eşleşme riskini yükseltir.
// 0.5 = başlığın/öznenin ayırt edici köklerinin YARISI caption'da geçiyor.
export const ESIK = 0.5;
// Birinci ile ikinci aday bu kadar yakınsa karar verilmez (belirsiz sayılır).
export const FARK = 0.2;
// Üretim tarihi ile yayın tarihi aynı gün olmalı; koşu gece yarısına taşarsa 1 gün kayabilir.
export const GUN_TOLERANS = 1;

/** ISO zaman damgasını TR yerel tarihine (YYYY-MM-DD) çevirir. */
export function trTarih(iso, tz = TZ) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  // sv-SE biçimi zaten YYYY-MM-DD verir.
  return new Intl.DateTimeFormat('sv-SE', {timeZone: tz}).format(d);
}

function gunFarki(a, b) {
  if (!a || !b) return Infinity;
  const ms = Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`);
  return Math.abs(ms) / 86400000;
}

// subjectTokens ayırt etmeyen kelimeleri (serum, cilt, bakım…) zaten eliyor — caption'da
// HER POSTTA geçen kelimeler puanı şişirmesin diye tam olarak istediğimiz davranış bu.
function kokler(text) {
  return [...new Set(subjectTokens(text))];
}

function kokTutuyor(a, b) {
  return a === b || (a.length >= 5 && b.startsWith(a)) || (b.length >= 5 && a.startsWith(b));
}

/**
 * Bir geçmiş kaydının bir medyayla ne kadar uyuştuğu (0-1).
 * Kaydın ayırt edici köklerinin kaçı caption'da geçiyor?
 */
export function benzerlik(kayit, medya) {
  const aranan = kokler(`${kayit.title ?? ''} ${kayit.subject ?? ''}`);
  if (!aranan.length) return 0;
  const caption = kokler(medya.caption ?? '');
  if (!caption.length) return 0;
  const tutan = aranan.filter(k => caption.some(c => kokTutuyor(k, c)));
  return tutan.length / aranan.length;
}

/**
 * Geçmiş kayıtlarını hesabın medya listesiyle eşler. SAF: ağ/dosya yok.
 *
 * @param history marka geçmişi (mediaId'si olanlara DOKUNULMAZ)
 * @param medya   Graph API /media çıktısı: [{id, caption, timestamp}]
 * @returns {{eslesenler, belirsizler, bossular}} — belirsiz = iki aday birbirine çok yakın
 */
export function eslestir({history = [], medya = []}) {
  const kullanilan = new Set(history.map(h => h.mediaId).filter(Boolean));
  const havuz = medya.filter(m => m?.id && !kullanilan.has(m.id));

  // 1) Her boş kayıt için kendi aday listesini puanla (tarih penceresi + benzerlik).
  const adaylar = new Map();   // history index -> [{medya, skor}] (skora göre azalan)
  history.forEach((kayit, i) => {
    if (kayit.mediaId) return;
    const liste = havuz
      .filter(m => gunFarki(kayit.date, trTarih(m.timestamp)) <= GUN_TOLERANS)
      .map(m => ({medya: m, skor: benzerlik(kayit, m)}))
      .filter(a => a.skor >= ESIK)
      .sort((x, y) => y.skor - x.skor);
    adaylar.set(i, liste);
  });

  const eslesenler = [], belirsizler = [], bossular = [];
  const sahiplenen = new Map();   // media id -> {index, skor}

  // 2) Kendi içinde belirsiz olanları AYIR: ikinci aday çok yakınsa karar verme.
  const kararlilar = [];
  for (const [i, liste] of adaylar) {
    if (!liste.length) { bossular.push({index: i, title: history[i].title, sebep: 'aday yok'}); continue; }
    if (liste.length > 1 && liste[0].skor - liste[1].skor < FARK) {
      belirsizler.push({index: i, title: history[i].title, skor: liste[0].skor,
        adaylar: liste.slice(0, 3).map(a => a.medya.id)});
      continue;
    }
    kararlilar.push({index: i, aday: liste[0]});
  }

  // 3) İki kayıt aynı medyayı istiyorsa yüksek puanlı alır, diğeri belirsize düşer —
  //    "ikinci en iyi adaya kaydır" YAPMIYORUZ; zincirleme yanlış eşleşme üretir.
  kararlilar.sort((a, b) => b.aday.skor - a.aday.skor);
  for (const {index, aday} of kararlilar) {
    const id = aday.medya.id;
    if (sahiplenen.has(id)) {
      belirsizler.push({index, title: history[index].title, skor: aday.skor,
        sebep: `medya ${id} daha yüksek puanla başka kayda gitti`});
      continue;
    }
    sahiplenen.set(id, {index, skor: aday.skor});
    eslesenler.push({index, title: history[index].title, mediaId: id,
      postedAt: aday.medya.timestamp, skor: Number(aday.skor.toFixed(2))});
  }

  eslesenler.sort((a, b) => a.index - b.index);
  return {eslesenler, belirsizler, bossular};
}

/** Eşleşmeleri geçmişe işler (yeni dizi döner, girdi değişmez). */
export function uygula(history, eslesenler) {
  const kopya = history.map(h => ({...h}));
  for (const e of eslesenler) {
    kopya[e.index].mediaId = e.mediaId;
    if (!kopya[e.index].postedAt) kopya[e.index].postedAt = e.postedAt;
  }
  return kopya;
}

/** Hesabın medya listesini çeker (sayfalama dahil). */
export async function medyaListesi({igUserId, token, fetchFn = fetch, sayfaSiniri = 5}) {
  let url = `${GRAPH}/${igUserId}/media?fields=id,caption,timestamp,media_type,permalink`
    + `&limit=100&access_token=${token}`;
  const hepsi = [];
  for (let s = 0; s < sayfaSiniri && url; s++) {
    const res = await fetchFn(url);
    if (!res.ok) throw new Error(`media HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    hepsi.push(...(data.data ?? []));
    url = data.paging?.next ?? null;
  }
  return hepsi;
}

// ── CLI ────────────────────────────────────────────────────────────────────────
// node publish/eslestir-mediaid.mjs [--yaz]
// --yaz olmadan SADECE rapor basar (kuru koşu). Yazma kararı bilinçli olsun.
if (import.meta.url === `file://${process.argv[1]}`) {
  const yaz = process.argv.includes('--yaz');
  const brand = loadBrand();
  const {igUserId, igToken} = credentials(brand);
  if (!igUserId || !igToken) {
    console.log(`· ${brand.slug}: IG kimliği yok (${brand.publish?.instagram?.token}), atlandı`);
    process.exit(0);
  }
  const histPath = brand.paths.history;
  if (!existsSync(histPath)) { console.log(`· ${brand.slug}: geçmiş dosyası yok`); process.exit(0); }

  const history = JSON.parse(readFileSync(histPath, 'utf8'));
  const medya = await medyaListesi({igUserId, token: igToken});
  console.log(`▣ ${brand.handle}: hesapta ${medya.length} medya, geçmişte ${history.length} kayıt `
    + `(${history.filter(h => h.mediaId).length} tanesinde mediaId var)`);

  const {eslesenler, belirsizler, bossular} = eslestir({history, medya});
  for (const e of eslesenler) console.log(`  ✓ ${e.mediaId}  (${e.skor})  ${e.title}`);
  for (const b of belirsizler) console.log(`  ? BELİRSİZ — ${b.title} :: ${b.sebep ?? 'iki aday çok yakın'}`);
  for (const b of bossular) console.log(`  · eşleşmedi — ${b.title} (silinmiş ya da hiç yayınlanmamış olabilir)`);
  console.log(`▣ ${eslesenler.length} kurtarıldı, ${belirsizler.length} belirsiz, ${bossular.length} boş`);

  if (!yaz) { console.log('· kuru koşu — yazmak için --yaz'); process.exit(0); }
  if (!eslesenler.length) { console.log('· yazılacak eşleşme yok'); process.exit(0); }
  writeFileSync(histPath, JSON.stringify(uygula(history, eslesenler), null, 2));
  console.log(`✓ ${histPath} güncellendi`);
}
