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
  {key: 'para', kime: 'kavanoza servet yatıran, ama muadilini duyunca yıkılacak arkadaşına', focus: 'PARA GAFI: bu ürüne verdiğin paranın gerçekte neye gittiği — kavanozun içindeki ilk üç maddenin su/gliserin olması, aynı aktifi üçte birine veren muadil, "lüks" farkının koku ve ambalaj olması. Rakamı uydurma; oranı ve sırayı konuş'},
  {key: 'zaman', kime: '11 adımlı rutini olan ve her seferinde 3. günde bırakan arkadaşına', focus: 'ZAMAN GAFI: bu iş için harcanan ömür — 11 adımlı sabah rutini, ürünün emmesini beklerken geçen dakikalar, "3 günde bıraktığın" kür, sonucun gerçekte kaç HAFTA sürdüğü'},
  {key: 'pazarlama-dili', kime: 'kutunun üstündeki her cümleye inanan arkadaşına', focus: 'PAZARLAMA DİLİ GAFI: kutudaki cümlenin insan diline çevirisi — "klinik olarak test edildi" (kaç kişide?), "%97 memnun" (kim sordu?), "dermatolog onaylı" aslında ne demek, yıldız işaretinin altındaki minik yazı'},
  {key: 'sosyal-medya', kime: 'akışta gördüğü her ürünü sepete atan arkadaşına', focus: 'SOSYAL MEDYA GAFI: o ürünü neden aldığın — akışta çıkan tek video, filtreli "cilt sonucu", ışığı düzgün kurulmuş öncesi-sonrası, herkesin aynı hafta aynı ürünü keşfetmesi'},
  {key: 'itiraf', kime: 'makyajla uyuduğunu senden başka kimsenin bilmediği arkadaşına', focus: 'İTİRAF GAFI: kimseye söylemediğin şey — makyajla uyumak, kremi dolabın dibinde unutmak, güneş kremini sadece tatilde sürmek, "bugün olmaz" deyip yatmak. Alay değil ORTAK itiraf: anlatıcı da yapıyor'},
  {key: 'beklenti', kime: 'ürünü sürdüğünün ertesi sabahı aynaya mucize aramaya giden arkadaşına', focus: 'BEKLENTİ GAFI: aynaya 1. günde bakmak — ürünü sürdükten sonraki sabah mucize aramak, "işe yaramadı" diye 5. günde bırakmak, cildin gerçek yenilenme takvimiyle sabrının çarpışması'},
  {key: 'aile-tavsiyesi', kime: 'sana hâlâ limonlu maske tarifi yollayan annene ya da o kuzenine', focus: 'TAVSİYE GAFI: bilgi nereden geliyor — annenin limonlu tarifi, kuzenin kesin konuşan arkadaşı, kozmetik reyonundaki danışman, forumdan kalma efsane. Kimseyi aptal yerine koymadan, sevgiyle dalga geç'},
  {key: 'dolap-mezarligi', kime: 'çekmecesi yarım kalmış serumlardan görünmeyen arkadaşına', focus: 'DOLAP GAFI: yarım kalmış ürünler mezarlığı — üç kez alınıp bitirilemeyen serum, son kullanma tarihi geçmiş kavanoz, açılınca bozulan formülü aylarca banyoda tutmak, "lazım olur" diye saklamak'},
  {key: 'abartili-rutin', kime: 'tahriş olmuş cildine bir katman daha ekleyen arkadaşına', focus: 'RUTİN GAFI: fazlası — üst üste sürülen beş aktif, "daha çok sürersem daha hızlı geçer" mantığı, tahriş olmuş cilde bir katman daha eklemek, hafta sonu 40 dakikalık ayin'},
  {key: 'ambalaj', kime: 'ağzı açık kavanozu banyoda aylarca bekleten arkadaşına', focus: 'AMBALAJ GAFI: kutunun kendisi — ağzı açık kavanozda havayla bozulan aktif, kalın camın verdiği pahalı hissi, 30 ml için ödenen büyük şişe, pompanın dibinde kalan ürünü çıkarma savaşı'},

  // ── 2026-08-03 GENİŞLEME ──────────────────────────────────────────────────────
  // Serdar: "genç kızlar nelere güler, nelere beğeni/yorum atar — kızlar postumuzu resmen
  // birbirlerine göndermek İSTEMELİ." Ölçüm de aynı yeri gösterdi: 1349 izlenmeli postu
  // taşıyan metrik paylaşımdı (8 paylaşım → 1153 erişim; ondan önceki 5 postta toplam 0).
  //
  // Bu sekiz eksenin ortak özelliği: gaf artık yalnız İZLEYENDE değil, izleyenin TANIDIĞI
  // BİRİNDE de karşılık buluyor. "Bu benim" kaydetmeye, "bu tam sensin" göndermeye yol açar
  // — ve gönderme, erişimi büyüten sinyal.
  {key: 'sevgili-farki', kime: 'tek bir sabunla senden iyi cilde sahip olan sevgiline/kardeşine',
    focus: 'HAYAT ADALETSİZ GAFI: 12 adımlı rutininin yanında, hayatında tek bir "3\u0027ü 1 arada" ürünü olan biri daha iyi ciltle geziyor. Genetik, sebum üretimi, kalınlık ve hormon farkı GERÇEKTEN var — bunu bilimle anlat ama sesin isyan etsin. Kimseyi kötülemeden, "hayat bu" tonunda'},
  {key: 'ev-arkadasi', kime: 'senin pahalı serumundan "birazcık" alan kardeşine/ev arkadaşına',
    focus: 'ORTAK BANYO GAFI: pahalı ürünün başkası tarafından kullanılması — "birazcık aldım", el kremi diye sürülen serum, ortak havlu, kardeşinin fondöteni tonu tutmadan kullanması. Ürün paylaşımının gerçek hijyen/formül sonucu ne, hangi ürün paylaşılmaz'},
  {key: 'ayna-ve-isik', kime: 'evden harika çıkıp asansör aynasında yıkılan arkadaşına',
    focus: 'IŞIK GAFI: aynı yüz, dört farklı ayna — banyo ışığında kusursuz, asansörde felaket, gün ışığında bambaşka, ön kamerada tanınmaz. Renk sıcaklığı, tepeden gelen ışık ve fondöten tonu/flashback mekanizması. Suç ciltte değil ışıkta'},
  {key: 'on-kamera', kime: 'seni filtresiz fotoğrafta etiketleyen o arkadaşına',
    focus: 'FOTOĞRAF GAFI: ön kamera, başkasının çektiği filtresiz kare, flaşlı gece fotoğrafı, etiketlenip haberdar olmak. Objektif bozulması, flaşın SPF\u0027li ürünle yaptığı beyaz parlama (flashback), gözenek görünürlüğü — neyin gerçek neyin optik olduğunu ayır'},
  {key: 'kotu-zamanlama', kime: 'önemli günden bir gece önce sivilce çıkan arkadaşına',
    focus: 'ZAMANLAMA GAFI: sivilce takvimi bilir — düğünden, sınavdan, tatilden, fotoğraf gününden tam bir gece önce. Neden gerçekten o zamana denk geliyor (stres kortizolü, döngü, o hafta değiştirilen ürün) ve o gece yapılabilecek TEK mantıklı şey ne. Panik hamlelerinin (patlatmak, macun, üst üste kurutucu) ne yaptığını da söyle'},
  {key: 'magaza-danismani', kime: 'reyondan hep planladığından fazlasıyla çıkan arkadaşına',
    focus: 'REYON GAFI: "abla bu cildinize birebir" — kozmetik reyonunda 3 dakikada kurulan güven, cilt tipini bakışla teşhis, yanına "mutlaka bununla kullanın" eklenen ikinci ürün. Satış tekniğini sevecen şekilde deşifre et; danışmanı kötüleme, mekanizmayı göster'},
  {key: 'gece-sepeti', kime: 'gece 2\u0027de sepeti onaylayıp sabah ne aldığını unutan arkadaşına',
    focus: 'SEPET GAFI: gece 2 alışverişi — "son gün" sayacı, ücretsiz kargo eşiğini doldurmak için eklenen üçüncü ürün, kargo beklerken kurulan hayal, gelince iki gün kullanılıp bırakılması. Kampanya mekaniği ile cildin gerçek ihtiyacı arasındaki fark'},
  {key: 'yaz-ve-ter', kime: '35 derecede tam makyajla dışarı çıkan arkadaşına',
    focus: 'SICAK GAFI: yaz — terleyen alın, denize girince biten makyaj, plajda güneş kremi yenileme savaşı, klima ile dışarı arasında gidip gelen cilt. Ter/sebum ile ürün filminin ilişkisi, suya dayanıklı ne demek (ve kaç dakika demek)'},
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
