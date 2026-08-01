// GAF EKSENİ — her videonun içine oturan "gülünecek gerçek".
//
// Serdar direktifi (2026-08-01): "son gönderiye bayıldım, çünkü para ile ilgili de gaf
// vuruluyor — kızların tam ilgi alanı: cilt ürünleri ve verilen paralar. Bu tarz şeyler sık
// sık olmalı, farklı ürünlerde, farklı gaflarla (sadece para değil)."
//
// Yani gaf ARTIK opsiyonel bir ton süsü değil, her postun ZORUNLU ekseni. Ama tek gaf türü
// (para) üç videoda tekrar ederse aynı tekrar tuzağına düşeriz — bu yüzden pillar/özne gibi
// gaf da rotasyona girer ve geçmişe yazılır (bkz. run-daily.mjs, brain/subjects.mjs).
//
// focus alanları TÜRKÇE: doğrudan Türkçe espriyi tarif ediyorlar (pillar havuzlarında da öyle).

const BEAUTY_TR = [
  {key: 'para', focus: 'PARA GAFI: bu ürüne verdiğin paranın gerçekte neye gittiği — kavanozun içindeki ilk üç maddenin su/gliserin olması, aynı aktifi üçte birine veren muadil, "lüks" farkının koku ve ambalaj olması. Rakamı uydurma; oranı ve sırayı konuş'},
  {key: 'zaman', focus: 'ZAMAN GAFI: bu iş için harcanan ömür — 11 adımlı sabah rutini, ürünün emmesini beklerken geçen dakikalar, "3 günde bıraktığın" kür, sonucun gerçekte kaç HAFTA sürdüğü'},
  {key: 'pazarlama-dili', focus: 'PAZARLAMA DİLİ GAFI: kutudaki cümlenin insan diline çevirisi — "klinik olarak test edildi" (kaç kişide?), "%97 memnun" (kim sordu?), "dermatolog onaylı" aslında ne demek, yıldız işaretinin altındaki minik yazı'},
  {key: 'sosyal-medya', focus: 'SOSYAL MEDYA GAFI: o ürünü neden aldığın — akışta çıkan tek video, filtreli "cilt sonucu", ışığı düzgün kurulmuş öncesi-sonrası, herkesin aynı hafta aynı ürünü keşfetmesi'},
  {key: 'itiraf', focus: 'İTİRAF GAFI: kimseye söylemediğin şey — makyajla uyumak, kremi dolabın dibinde unutmak, güneş kremini sadece tatilde sürmek, "bugün olmaz" deyip yatmak. Alay değil ORTAK itiraf: anlatıcı da yapıyor'},
  {key: 'beklenti', focus: 'BEKLENTİ GAFI: aynaya 1. günde bakmak — ürünü sürdükten sonraki sabah mucize aramak, "işe yaramadı" diye 5. günde bırakmak, cildin gerçek yenilenme takvimiyle sabrının çarpışması'},
  {key: 'aile-tavsiyesi', focus: 'TAVSİYE GAFI: bilgi nereden geliyor — annenin limonlu tarifi, kuzenin kesin konuşan arkadaşı, kozmetik reyonundaki danışman, forumdan kalma efsane. Kimseyi aptal yerine koymadan, sevgiyle dalga geç'},
  {key: 'dolap-mezarligi', focus: 'DOLAP GAFI: yarım kalmış ürünler mezarlığı — üç kez alınıp bitirilemeyen serum, son kullanma tarihi geçmiş kavanoz, açılınca bozulan formülü aylarca banyoda tutmak, "lazım olur" diye saklamak'},
  {key: 'abartili-rutin', focus: 'RUTİN GAFI: fazlası — üst üste sürülen beş aktif, "daha çok sürersem daha hızlı geçer" mantığı, tahriş olmuş cilde bir katman daha eklemek, hafta sonu 40 dakikalık ayin'},
  {key: 'ambalaj', focus: 'AMBALAJ GAFI: kutunun kendisi — ağzı açık kavanozda havayla bozulan aktif, kalın camın verdiği pahalı hissi, 30 ml için ödenen büyük şişe, pompanın dibinde kalan ürünü çıkarma savaşı'},
];

export const TWIST_SETS = {'beauty-tr': BEAUTY_TR};

/** Marka dosyasındaki twistSet adına karşılık gelen havuz (yoksa null → gaf ekseni kapalı). */
export function twistsFor(setName) {
  if (!setName) return null;
  const set = TWIST_SETS[setName];
  if (!set) throw new Error(`bilinmeyen gaf kümesi: ${setName} (${Object.keys(TWIST_SETS).join(', ')})`);
  return set;
}

/**
 * Gaf seçimi — pillar mantığının aynısı: önce HİÇ KULLANILMAYAN (LRU), veri birikince
 * performansa göre ağırlıklı. Amaç iki komşu videonun aynı esprili açıdan gelmemesi.
 * recentKeys: son postların twist anahtarları (yeniden eskiye ya da eskiden yeniye — fark etmez).
 */
export function selectTwist(recentKeys = [], twists = BEAUTY_TR, stats = null, pick = null) {
  if (!twists?.length) return null;
  const recent = new Set(recentKeys);
  const fresh = twists.filter(t => !recent.has(t.key));
  const pool = fresh.length ? fresh : twists;

  if (stats && pick && stats.sampleSize >= 3) {
    const key = pick(pool.map(t => t.key), stats);
    const hit = pool.find(t => t.key === key);
    if (hit) return hit;
  }
  return pool[0];
}
