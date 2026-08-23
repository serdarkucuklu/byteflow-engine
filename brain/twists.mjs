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


// ── @kizlar.kodu gaf havuzu (2026-08-03) ────────────────────────────────────
// cilt.kodu'daki kural aynen geçerli: gaf zorunlu, rotasyona girer ve her gafın doğal bir
// ALICISI vardır ("bu tam sensin" göndertir, "bu benim" yalnızca kaydettirir).
const MODA_TR = [
  // ⚠ 2026-08-03: bu eksen ÜÇ videoda da "kumaş → dikim → kira → marka primi" maliyet
  // merdivenine dönüştü. Serdar direktifi: "hep o zaman kira personel vs den gaf yapıyor."
  // Sorun eksende değil ODAKTA: metin markanın gider tablosunu sayıyordu. Markanın gider
  // tablosu (a) kaynaklanamaz, uydurma rakam doğurur, (b) izleyicinin YAŞADIĞI bir şey
  // değil — kimse arkadaşına mağaza kirası göndermez. Odak artık ONUN parası:
  // aynı parçanın iki fiyatı, indirimin matematiği, bir kez giyilen elbise.
  {key: 'para', kime: 'o parayı verdiğine hâlâ inanamayan arkadaşına',
    focus: 'PARA GAFI: onun kendi parasıyla yaşadığı komik gerçek — vitrindeki ile aynı olan üçte bir fiyatlı parça, "indirimli" etiketin üstündeki hiç var olmamış eski fiyat, ücretsiz kargo eşiğini doldurmak için eklenen ve hiç giyilmeyen üçüncü ürün, bir kez giyilip dolapta yatan davet elbisesi, giyilme başına düşen gerçek maliyet. ⛔ YASAK: markanın gider tablosunu saymak (kumaş şu kadar, dikim şu kadar, kira şu kadar, marka primi şu kadar). O bir maliyet dersidir, gaf değildir; üstelik hiçbir rakamı kaynaklanamaz. Kimse arkadaşına mağaza kirası göndermez — ama "senin de dolabında bir tane var" dedirten parçayı gönderir'},
  {key: 'kargo-hayali', kime: 'kargo kodunu saatte üç kez sorgulayan arkadaşına',
    focus: 'KARGO GAFI: sipariş ile paket arasında geçen süre — kargo takibini ezberlemek, gelene kadar kurulan kombin hayali, kutuyu açınca kumaşın elde bambaşka çıkması. Fotoğrafta görülemeyen ne varsa onu anlat'},
  {key: 'beden-savasi', kime: 'kabinde aynı bedenin iki farklı çıktığını gören arkadaşına',
    focus: 'BEDEN GAFI: beden tablosuyla savaş — aynı markada tutmayan iki beden, "oturur belki" diye alınan parça, kabin aynasının açısı, online alınan bedenin evde bambaşka olması. Beden standardının neden markadan markaya kaydığını anlat'},
  {key: 'yikama-kazasi', kime: 'beyaz yıkamayı bir çorapla pembeye çeviren arkadaşına',
    focus: 'YIKAMA GAFI: tek hamlede biten parça — makineye giren tek kırmızı çorap, 60 derecede yıkanan kazak, kurutucudan bebek bedeninde çıkan tişört, ütüde parlayan pantolon. Isı ve suyun life ne yaptığını anlat'},
  {key: 'dolap-mezarligi', kime: 'dolabında hâlâ etiketi duran parçalar olan arkadaşına',
    focus: 'DOLAP GAFI: "bir gün lazım olur" rafı — etiketi kesilmemiş parça, iki beden küçük alınıp beklenen elbise, özel gün için alınıp bir kez giyilen. Giyilme başına maliyeti sessizce hesapla'},
  {key: 'kombin-yalani', kime: 'dolabı dolu olduğu hâlde her sabah giyecek bir şey bulamayan arkadaşına',
    focus: 'KOMBİN GAFI: dolap dolu, giyecek bir şey yok — sabah yatağa fırlatılan üç parça, hep aynı üç kıyafetin dönmesi, "bunun altına ne giyerim" çıkmazı. Dolabın hangi kısmının hiç dönmediğini göster'},
  {key: 'sosyal-medya', kime: 'akışta gördüğü parçayı üç gün sonra kapıda bulan arkadaşına',
    focus: 'SOSYAL MEDYA GAFI: o parçayı neden aldın — akışta çıkan tek video, iğnelenmiş ürün fotoğrafı, aynı hafta herkeste çıkan parça, "linki attım" kültürü'},
  {key: 'magaza-danismani', kime: 'mağazadan planladığından hep fazlasıyla çıkan arkadaşına',
    focus: 'MAĞAZA GAFI: "üstünüzde çok güzel durdu" — kabin önünde kurulan üç dakikalık güven, yanına önerilen ikinci parça, kasadaki son ekleme. Satış tekniğini sevecen şekilde deşifre et, danışmanı kötüleme'},
  {key: 'gece-sepeti', kime: 'gece 2\u0027de sepeti onaylayıp sabah ne aldığını hatırlamayan arkadaşına',
    focus: 'SEPET GAFI: gece alışverişi — "son 3 ürün" sayacı, ücretsiz kargo eşiğini doldurmak için eklenen üçüncü parça, sabah gelen sipariş onayına şaşırmak'},
  {key: 'iade-tembelligi', kime: 'iade süresi dolduğu için o parçayı hâlâ saklayan arkadaşına',
    focus: 'İADE GAFI: iade edilmeyen parça — kutusu duruyor ama kargoya gitmiyor, iade penceresi sessizce kapanıyor, "nasılsa giyerim" ile biten hikâye. İade mekaniğinin bunu nasıl beklediğini anlat'},
  {key: 'pazarlama-dili', kime: 'ürün açıklamasındaki her cümleye inanan arkadaşına',
    focus: 'PAZARLAMA DİLİ GAFI: etiketteki ve ürün açıklamasındaki cümlenin insan diline çevirisi — "premium pamuk", "sınırlı sayıda", "el işçiliği", "yumuşacık dokusu". Hangisi ölçülebilir bir şey söylüyor, hangisi sadece his satıyor'},
  {key: 'itiraf', kime: 'aynı pantolonu üst üste kaç gün giydiğini senden başka kimsenin bilmediği arkadaşına',
    focus: 'İTİRAF GAFI: kimseye söylemediğin şey — kokla-giy testi, ters çevrilip bir gün daha giyilen tişört, ütü yerine el düzeltmesi, yıkanmadan dolaba geri konan parça. Alay değil ORTAK itiraf: anlatıcı da yapıyor'},
  {key: 'beklenti', kime: 'ilk yıkamadan sonra parçayı suçlayan arkadaşına',
    focus: 'BEKLENTİ GAFI: parçadan beklenen ömür — 200 liralık tişörtten üç sezon beklemek, ilk bozulmada "kalitesizmiş" demek, etikette yazan bakımı hiç yapmadan dayanmasını istemek'},
  {key: 'arkadas-kopyasi', kime: 'aynı parçayı senin yüzünden alıp üstünde bambaşka duran arkadaşına',
    focus: 'KOPYA GAFI: arkadaşta harika, sende olmuyor — aynı parçanın iki kişide farklı düşmesi, kalıp/boy/omuz genişliği, kumaşın dökümü. Suçun bedende değil kalıpta olduğunu anlat'},
  {key: 'anne-terzi', kime: 'her parçayı "kısalttırırız" diye alan annene ya da o arkadaşına',
    focus: 'TERZİ GAFI: müdahale kültürü — "biraz bollaştırırız", bir türlü terziye gitmeyen pantolon, annenin dikiş kutusu, kısaltılınca kalıbı bozulan parça. Neyin tadil edilebildiğini, neyin edilemediğini söyle'},
  {key: 'sezon-aldatmacasi', kime: 'yazlık aldığı parçayı yaz bitmeden eskiten arkadaşına',
    focus: 'SEZON GAFI: tek sezonluk ömür — sezon başında alınıp sezon bitmeden bozulan parça, "yazlık" diye alınıp terleten kumaş, mevsim geçişinde giyilecek hiçbir şeyin olmaması'},
  {key: 'ozel-gun', kime: 'düğün için aldığı elbiseyi bir daha hiç giymeyen arkadaşına',
    focus: 'ÖZEL GÜN GAFI: bir kez giyilen parça — düğün/davet/mezuniyet alışverişi, "aynı elbiseyi iki kere giyemem" baskısı, o gecenin fotoğrafı dışında hiç görünmeyen kıyafet'},
  {key: 'zaman', kime: 'her sabah dolabın önünde 20 dakika kaybeden arkadaşına',
    focus: 'ZAMAN GAFI: bu işe giden ömür — sabah dolap önünde geçen dakikalar, ütü kuyruğu, elde yıkanacaklar sepeti, "sonra bakarım" diye ertelenen leke. Zamanın nereye gittiğini dürüstçe say'},

  // ── ERKEK GAFI (2026-08-23, `docs/plan/kizlarkodu-erkek-gaf.md`) ──────────────────────────
  // Konu/mekanizma DEĞİŞMİYOR — bugünkü pillar'ın kumaş/dolap/bakım konusu aynen kalıyor.
  // Değişen tek şey KAPI: gülme noktası kadın izleyicinin çevresindeki erkeğin davranışı.
  // Mekanizma iddiası (generate-spec.mjs:241 her step.status'tan bunu istiyor) bugünkü pillar'dan
  // gelir, twist'ten DEĞİL — bu yüzden focus metni kapıyı davranışa açık şekilde bağlıyor ve
  // "erkek beyni / erkekler böyledir" tipi genellemeyi açıkça yasaklıyor (kaynaksız klişe riski,
  // bkz. plan Riskler tablosu). ✅/⛔ örnek çifti modelin kuralı değil örneği taklit etmesinden
  // yararlanıyor (generate-spec.mjs:85-89 dersi).
  {key: 'erkek-dolabi', kime: 'üç tişörtle bütün mevsimi geçiren kardeşine/eşine', aile: 'erkek-gaf',
    focus: 'ERKEK DOLABI GAFI: kapı onun davranışı — üç tişörtle bütün mevsimi geçirmesi, aynı beş parçanın dönüp durması, kurutucudan çıkanı kontrol etmeden dolaba atması, "bu da olur" deyip hiç ütülemeden giymesi. Anlatılan mekanizma bugünkü konudan gelir (kumaş/dolap/bakım) — twist yeni bir mekanizma İDDİA ETMEZ, sadece bu mekanizmayı KİME anlattığını değiştirir. ⛔ YASAK: cinsiyete dayalı biyoloji/zihniyet genellemesi ("hepsi böyledir/hiç anlamaz" tarzı ifadeler) — bu bir DAVRANIŞ gözlemidir, biyoloji/karakter iddiası değildir; kaynaklanamayan bir klişe modele "gerçek" gibi yazdırılmaz. ✅ böyle: "üç tişörtle kışı geçiren o adam, kurutucunun kazağını nasıl küçülttüğünü hiç sormaz" (davranış + bugünkü mekanizma). ⛔ böyle değil: "erkekler bakımdan zaten anlamaz" (genelleme, mekanizma yok, kaynaksız).'},
  {key: 'yikama-cesareti', kime: 'her şeyi tek makinede 60 derecede yıkayan kardeşine/eşine', aile: 'erkek-gaf',
    focus: 'YIKAMA CESARETİ GAFI: kapı onun davranışı — beyazı, rengliyi, kazağı tek makinede 60 derecede yıkaması, etikete hiç bakmadan "olur nasılsa" demesi, sonucu görene kadar hiç şüphelenmemesi. Anlatılan mekanizma bugünkü konudan gelir (ısı/su/kumaş) — twist yeni bir mekanizma İDDİA ETMEZ, sadece bu mekanizmayı KİME anlattığını değiştirir. ⛔ YASAK: cinsiyete dayalı biyoloji/zihniyet genellemesi ("hepsi böyledir/hiç anlamaz" tarzı ifadeler) — bu bir DAVRANIŞ gözlemidir, biyoloji/karakter iddiası değildir. ✅ böyle: "her şeyi 60 derecede tek makineye atan o adam, kazağın neden çocuk bedenine döndüğünü hiç sormaz" (davranış + bugünkü mekanizma). ⛔ böyle değil: "erkekler zaten yıkamadan anlamaz" (genelleme, mekanizma yok, kaynaksız).'},

  // ── SINIR AÇILARI (2026-08-23, plan Faz 2.2 — REVİZYON NOTU 2) ──────────────────────────
  // Bu ikisi içeriden DEĞİL: davranış (kumanda, yol sorma) bugünkü pillar'ın kumaş/vücut
  // konusuyla doğal bir bağ taşımıyor. focus metni bu yüzden AÇIKÇA ayırıyor: KAPI bu
  // davranış, ANLATILAN KONU bugünkü pillar — ikisi aynı şey değil, twist konuyu DEĞİŞTİRMEZ.
  // 2.5 ölçümü bu ikisinin hook↔gövde bağını iki farklı pillar ailesiyle sınadı.
  //
  // ⚠ SİLİNDİ (2.5 ölçümü, 2026-08-23): `kumanda-imparatorlugu` moda-tr'den (`kurutma-ve-utu` ×
  // `uyku-borcu`, 2 gerçek Gemini dry-run) — 2. koşuda 1.6 SIZINTI kapısı kırmızı yaktı: model
  // hook'u narration[0]'a birebir tekrarladı ("Kumandayı bırakmayan adam sentetik pijamayla
  // uyanamıyor.") ve kime alanındaki "adam" kelimesi mekanizma alanına sızdı. 1. koşu (kumaş
  // pillar'ı) hem sızıntısız hem hook↔gövde bağı sağlamdı, ama 2/2 tutarlılık şartını
  // sağlamadı — "belki tutar" diye havuzda bırakılmadı (plan Riskler tablosu).
  //
  // ⚠ SİLİNDİ (gözden-gecirici yeniden-ölçümü, 2026-08-23): `yon-inadi` de aynı desenle
  // düştü. `beden-tablosu` pillar'ıyla 1. koşuda 1.6 SIZINTI kapısı kırmızı yaktı — model
  // narration[0]/narration[4]'e "adam" kelimesini yazdı ("Navigasyonu dinlemeyen adam beden
  // tablosu okumaz.", "Yoldan adres soran adama değil mezuranın santimine güvenin."). 2. koşu
  // (aynı pillar) sızıntısız geçti — 1/2, 2/2 tutarlılık şartını sağlamadı. `sac-yikama-sikligi`
  // pillar'ıyla (vücut/günlük-hayat ailesi) 1. koşuda sızıntısız geçti ama bu tek pillar'ın
  // temizliği `beden-tablosu`'ndaki tutarsızlığı telafi etmez — "belki tutar" diye havuzda
  // bırakılmadı (aynı plan Riskler tablosu kuralı).
];

export const TWIST_SETS = {'beauty-tr': BEAUTY_TR, 'moda-tr': MODA_TR};

/** Marka dosyasındaki twistSet adına karşılık gelen havuz (yoksa null → gaf ekseni kapalı). */
export function twistsFor(setName) {
  if (!setName) return null;
  const set = TWIST_SETS[setName];
  if (!set) throw new Error(`bilinmeyen gaf kümesi: ${setName} (${Object.keys(TWIST_SETS).join(', ')})`);
  return set;
}

/**
 * Anahtardan gaf bulur — SESSİZ FALLBACK YASAK. `BYTEFLOW_TWIST=yok-boyle-bir-sey` gibi bir
 * yazım hatası varsayılan/ilk twist'e sessizce düşerse üretim yanlış açıyla çıkar ve kimse
 * fark etmez (bkz. `docs/plan/kizlarkodu-erkek-gaf.md` 1.2). Bilinmeyen anahtar HER ZAMAN throw eder.
 */
export function twistByKey(key, twists) {
  const hit = (twists ?? []).find(t => t.key === key);
  if (!hit) {
    const bilinen = (twists ?? []).map(t => t.key).join(', ') || 'twist havuzu boş';
    throw new Error(`bilinmeyen gaf anahtarı: ${key} (${bilinen})`);
  }
  return hit;
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

  // ⚠ 2026-08-03 CANLI HATA: burada `stats.sampleSize >= 3` şartı vardı ve şart tutmayınca
  // HER KOŞUDA pool[0] dönüyordu — yani ölçüm birikmemiş YENİ bir sayfada gaf ekseni hiç
  // dönmüyor, listenin ilkine çakılıyordu. @etiket.kodu'nun üç videosunun üçü de "para"
  // gafıyla çıktı (18 eksen arasından), üçü de "hizli-moda-ekonomisi" pillar'ıyla.
  // Onay döngüsü tabloyu daha da kilitliyordu: reddedilen deneme geçmişten düşürülünce
  // `recentKeys` de boşalıyor ve sayfa ilk koşunun seçimine sonsuza kadar çakılı kalıyordu.
  // pickWeighted zaten ölçüm yokken düzgün davranıyor (tekdüze rastgele seçiyor); tek
  // yapılması gereken ona SORMAKTI. Seçici verilmediğinde davranış hâlâ belirlenimci.
  if (pick) {
    const key = pick(pool.map(t => t.key), stats);
    const hit = pool.find(t => t.key === key);
    if (hit) return hit;
  }
  return pool[0];
}
