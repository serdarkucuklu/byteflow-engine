// publish/gunluk-kota.mjs
// GÜNDE EN FAZLA BİR YAYIN — Serdar kuralı (2026-08-03).
//
// "Ben onaylamadan asla. Bir gün onaylamadıysam o gün yayın olmasın; öbür gün onaylarsam
//  önceki günden kalan yayınlansın, o gün yayın olduğu için o günün yeni yayını pas geçilir."
//
// Onay kapısı bunun yarısını zaten yapıyordu (bekleyen kalem varsa üretme). Eksik olan yarısı:
// kalem onaylanıp yayınlandıktan SONRA aynı günün cron'u boş bir kapı görüp ikinci videoyu
// üretiyordu. 2026-08-02'de tam bu oldu — "Mikroakım Cihazı vs Retinol" ve "Gliserin" aynı
// gün yayınlandı. İki post birbirinin erişimini kırar ve takipçi atfını da imkânsızlaştırır
// (artışı hangisi getirdi bilinemez, bkz. publish/takipci-raporu.mjs).
import {readFileSync, existsSync} from 'node:fs';
import {loadBrand} from '../brands/load.mjs';

const TZ = 'Europe/Istanbul';

/** Yayın anını TR yerel gününe çevirir — gün sınırı TR'ye göre, UTC'ye göre değil. */
export function yayinGunu(postedAt, tz = TZ) {
  const d = new Date(postedAt);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('sv-SE', {timeZone: tz}).format(d);
}

/**
 * Bugün (TR) zaten yayınlanmış bir post var mı? SAF.
 * `postedAt` yoksa kayıt yayınlanmamıştır — üretilmiş ama onayda bekleyen taslaklar sayılmaz.
 */
export function bugunYayinVarMi(history = [], now = new Date(), tz = TZ) {
  const bugun = new Intl.DateTimeFormat('sv-SE', {timeZone: tz}).format(now);
  return history.some(h => h.postedAt && yayinGunu(h.postedAt, tz) === bugun);
}

/** Bugün yayınlanan kayıt (log mesajı için). */
export function bugunkuYayin(history = [], now = new Date(), tz = TZ) {
  const bugun = new Intl.DateTimeFormat('sv-SE', {timeZone: tz}).format(now);
  return history.find(h => h.postedAt && yayinGunu(h.postedAt, tz) === bugun) ?? null;
}

// ── CLI ────────────────────────────────────────────────────────────────────────
// Çıkış kodu 0 = üretilebilir, 10 = bugün zaten yayın var (üretme).
if (import.meta.url === `file://${process.argv[1]}`) {
  const brand = loadBrand();
  const path = brand.paths.history;
  const history = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : [];
  const yayin = bugunkuYayin(history);
  if (!yayin) { console.log('· bugün henüz yayın yok → üretim serbest'); process.exit(0); }
  console.log(`· bugün zaten yayın var (${yayin.postedAt} — ${yayin.title}) → yeni video üretilmiyor`);
  process.exit(10);
}
