// publish/muzik-sec.mjs — hangi müzik parçası kullanılacak?
//
// ÖNCEKİ DURUM (2026-08-09 denetimi): `run-daily.mjs` şunu yapıyordu —
//   readdirSync(musicDir).find(f => f.endsWith('.mp3') && !f.startsWith('_'))
// yani ALFABETİK İLK dosya, rotasyon yok, testi yok. Klasörde tek gerçek parça vardı:
// `byteflow-ambient.mp3` — 30 sn, 32 kbps, ffmpeg `sine`+`tremolo`+`lowpass` ile KENDİ
// ÜRETTİĞİMİZ bir drone. Her iki marka da (@cilt.kodu, @kizlar.kodu) aynı dosyayı
// kullanıyordu. Güzellik/moda sayfasında bu ses tek başına "otomatik üretilmiş" sinyali
// veriyor ve iki sayfa sesçe hiç ayrışmıyor.
//
// ⚠ HATTI KIRMAMA SÖZLEŞMESİ: `run-daily.mjs` uygun `.mp3` bulamazsa `process.exit(1)`
// yapıyor. Marka başına dizin ayırmak, dizin boş kaldığı gün İKİ SAYFANIN DA yayın
// yapamaması demek. Bu yüzden seçim bir ZİNCİR: marka dizini → kök dizin → (uyar, null).
// Karar çağırana bırakılır; bu modül asla süreçten çıkmaz.
//
// ⚠ "SENTETİK TESPİTİ" BITRATE İLE YAPILMAZ. 320 kbps'e encode edilmiş bir drone yeşil
// yanar, düşük bitrate'li gerçek bir parça kırmızı yanar — yani ölçtüğünü ölçmeyen bir
// ölçüt olur. Bunun yerine bilinen dosya ADI kara listede; kara liste de SON ÇARE olmaktan
// çıkarmaz (sessiz video ya da çöken hat, kötü müzikten kötüdür).

/** Kendi ürettiğimiz/istenmeyen parçalar — başka seçenek varsa kullanılmaz. */
export const KARA_LISTE = ['byteflow-ambient.mp3'];

/** Rotasyonda kaç koşu geriye bakılır (aynı parça arka arkaya gelmesin). */
export const GECMIS_PENCERE = 2;

const uygun = (f) => f.endsWith('.mp3') && !f.startsWith('_');

/**
 * SAF (fs enjekte edilir). Döner: {dosya, dizin, uyari}
 *  - `dosya` null ise hiçbir yerde parça yok; çağıran ne yapacağına karar verir.
 *  - `uyari` null değilse konsola basılmalı (sessiz bozulma olmasın).
 *
 * @param markaDizin markanın kendi müzik dizini (sesçe ayrışma)
 * @param kokDizin   ortak yedek dizin
 * @param gecmis     son koşularda kullanılan dosya adları (yeni → eski)
 */
export function secMuzik({markaDizin, kokDizin, fs, gecmis = [], karaListe = KARA_LISTE,
  pencere = GECMIS_PENCERE, sec = (a) => a[0]}) {
  const dene = (dizin) => (dizin && fs.varMi(dizin) ? fs.listele(dizin).filter(uygun) : []);

  let dizin = markaDizin;
  let adaylar = dene(markaDizin);
  let uyari = null;

  if (!adaylar.length) {
    const kok = dene(kokDizin);
    if (kok.length) {
      uyari = `marka dizini boş (${markaDizin}) → ortak dizine düşüldü (${kokDizin}); ` +
        'sayfalar sesçe ayrışmıyor';
      dizin = kokDizin;
      adaylar = kok;
    } else {
      return {dosya: null, dizin: null,
        uyari: `hiç kullanılabilir .mp3 yok (${markaDizin}, ${kokDizin})`};
    }
  }

  // 1) Kara listedekileri ele, 2) yakın geçmişte çalanları ele — ikisi de SON ÇAREDE geri gelir.
  const temiz = adaylar.filter(f => !karaListe.includes(f));
  const havuz = temiz.length ? temiz : adaylar;
  if (!temiz.length) {
    uyari = (uyari ? uyari + '; ' : '') +
      'yalnızca kara listedeki (sentetik) parça var — gerçek telifsiz parça ekle';
  }

  const yakin = new Set(gecmis.slice(0, pencere));
  const taze = havuz.filter(f => !yakin.has(f));
  const nihai = taze.length ? taze : havuz;

  return {dosya: sec(nihai), dizin, uyari};
}
