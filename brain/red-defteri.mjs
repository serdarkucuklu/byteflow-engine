// RED DEFTERİ — Serdar'ın beğenmediği denemenin öznesi o gün bir daha çıkmasın.
//
// ⚠ 2026-08-03 CANLI HATA: @etiket.kodu'nun ilk videosu ("2000₺'lik Polyester Bluzun Gerçek
// Maliyeti") onay kutusunda reddedildi; bir saat sonraki koşu "5000 TL Polyester Kazak Nereye
// Gidiyor?" üretti — aynı özne (polyester), aynı gaf (para), aynı maliyet merdiveni.
//
// Sebep: yasak yalnız "tekrar dene" yolunda vardı ve AYNI süreç içinde bir ortam değişkeni
// olarak taşınıyordu (BYTEFLOW_YASAK_KONU). "Vazgeç" yolunda ise deneme geçmişten düşürülüyor
// ve BAŞKA HİÇBİR YERE yazılmıyordu — yani reddedilen konu, reddedildiği için görünmez
// oluyordu. Sonraki koşu ayrı bir GitHub işiydi; ne ortam değişkenini ne de artık var olmayan
// geçmiş kaydını görebiliyordu. Red defteri bu boşluğu diske yazarak kapatıyor.
//
// Neden AYNI GÜN: video hiç yayınlanmadı, izleyici konuyu görmedi — konuyu haftalarca yakmak
// gereksiz. Yakılan şey o günkü İŞLEYİŞ; yarın aynı konu bambaşka bir açıyla gelebilir.
import {readFileSync, writeFileSync, existsSync, mkdirSync} from 'node:fs';
import {dirname} from 'node:path';

const TZ = 'Europe/Istanbul';

/** TR yerel günü (gün sınırı UTC'ye göre değil TR'ye göre — yayın takvimi TR). */
export function trGunu(now = new Date(), tz = TZ) {
  return new Intl.DateTimeFormat('sv-SE', {timeZone: tz}).format(now);
}

export function redOku(path) {
  if (!path || !existsSync(path)) return [];
  try {
    const v = JSON.parse(readFileSync(path, 'utf8'));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];   // bozuk defter üretimi durdurmaz; kayıt en kötü ihtimalle bir gün kaybolur
  }
}

/** Reddedilen denemeyi deftere yaz (son 60 kayıt tutulur). SAF DEĞİL: dosyaya yazar. */
export function redEkle(path, deneme, now = new Date()) {
  if (!path || !deneme?.subject) return null;
  const kayit = {
    gun: trGunu(now),
    subject: deneme.subject,
    twist: deneme.twist ?? null,
    title: deneme.title ?? null,
    at: now.toISOString(),
  };
  const defter = [...redOku(path), kayit].slice(-60);
  mkdirSync(dirname(path), {recursive: true});
  writeFileSync(path, JSON.stringify(defter, null, 2));
  return kayit;
}

/** BUGÜN reddedilmiş öznelerin listesi — konu soğumasına eklenir. SAF. */
export function bugunkuRedler(defter = [], now = new Date()) {
  const bugun = trGunu(now);
  return [...new Set(defter.filter(r => r.gun === bugun && r.subject).map(r => r.subject))];
}
