// @byteflowlabs niş kilidi: her post bu AI/LLM engineering pillar'larından birinin içinde kalır.
// timely: true → güncel-haber pillar'ı (yeni çıkan özellik / yeni model sürümü; trend başlıklarına demir atar).
// Serdar direktifi (2026-07): postların %75'i timely pillar'lardan çıkar — bkz. selectPillar.
const AI_ENGINEERING = [
  {key: 'agents', focus: 'autonomous LLM agents: planning, tool use, loops, memory, multi-agent handoff'},
  {key: 'rag', focus: 'retrieval-augmented generation: chunking, embeddings, reranking, retrieval quality'},
  {key: 'context', focus: 'context windows: token budgets, context rot, prompt caching, long-context tradeoffs'},
  {key: 'embeddings', focus: 'embeddings and vector search: similarity, dimensions, hybrid search'},
  {key: 'inference', focus: 'inference and serving: latency, batching, KV cache, quantization, streaming'},
  {key: 'evaluation', focus: 'LLM evaluation: benchmarks, eval harnesses, LLM-as-judge pitfalls'},
  {key: 'prompting', focus: 'prompt engineering: structured output, few-shot, system prompts, failure modes'},
  {key: 'cost-latency', focus: 'cost and latency: token economics, caching, model routing, cheaper vs smarter'},
  {key: 'guardrails', focus: 'safety and guardrails: prompt injection, jailbreaks, output validation, PII'},
  {key: 'vector-db', focus: 'vector databases: HNSW/IVF indexing, metadata filtering, scaling retrieval'},
  {key: 'observability', focus: 'LLM observability: tracing, token accounting, debugging bad outputs'},
  {key: 'mcp-tools', focus: 'tool calling and MCP: function schemas, tool orchestration, Model Context Protocol'},
  {key: 'fine-tuning', focus: 'fine-tuning vs prompting vs RAG: when each wins, LoRA, data prep'},
  {key: 'model-internals', focus: 'how ChatGPT / Claude / Gemini actually work under the hood: tokens, context window, attention, next-token prediction, streaming'},
  {key: 'model-releases', timely: true, focus: 'what changed in the LATEST model release — a brand-new Claude / GPT / Gemini / Grok version bump from this week\'s headlines: the concrete differences that matter to users, not marketing claims. ALWAYS anchor on a timely trending headline'},
  {key: 'model-comparison', focus: 'Claude vs ChatGPT vs Gemini: real differences in context, strengths, pricing, when to use which'},
  {key: 'paid-tiers', focus: 'what Claude Max / ChatGPT Plus / Gemini Advanced actually buy you: bigger context, higher limits, smarter model, priority'},
  {key: 'reasoning-models', focus: "how 'thinking'/reasoning models (GPT-5, Claude extended thinking) work: predicting a scratchpad before the answer"},
  {key: 'assistant-features', focus: "what the AI assistants' platform features actually do under the hood: Claude Skills / Projects / Artifacts / MCP, ChatGPT custom GPTs / apps / plugins, Gemini Gems / extensions, Grok modes"},
  {key: 'coding-environments', timely: true, focus: 'agentic coding environments and their NEWLY shipped capabilities: Claude Code, Cursor, Copilot, Codex CLI — new skills, plugins, MCP servers, desktop apps; how these tools actually drive the model and where they fail. Prefer what just shipped from the trending headlines'},
  {key: 'assistant-updates', timely: true, focus: 'newly shipped features across Claude / ChatGPT / Gemini / Grok — e.g. a new desktop app, design tool, flow builder, voice/omni mode (use timely trending headlines): what shipped, how it actually works, whether it matters'},
];

// Cilt bakımı ETKEN MADDE BİLİMİ havuzu (TR kitle, kadın 18-35). Ürün tanıtımı DEĞİL:
// her konu bir MEKANİZMA — motorun 3 adımlı diyagram anlatımı buna birebir oturuyor.
// Veri: etken madde açıklayıcıları, ürün tanıtımlarını izlenme süresi ve kaydetmede geçiyor.
const SKINCARE_SCIENCE = [
  {key: 'aktifler', focus: 'aktif maddeler — ama videoyu SOMUT bir üründen/karardan aç (kaç gündür sürüyorum bir şey yok, kusma dönemi, hangi sırayla süreceğim), etken madde ansiklopedisinden değil. Retinol/C vitamini/niasinamid/AHA-BHA cilt içinde ne yapıyor: bu, kararın açıklaması olarak gelir'},
  {key: 'bariyer', focus: 'cilt bariyeri — ama HER ZAMAN görünür bir durumdan gir (su değince yanan yüz, kaşınan yanak, birden hassaslaşan cilt, üst üste sürülen asitler), anatomi dersinden değil. Seramid/yağ asidi dengesi ve suyun buharlaşması bunun AÇIKLAMASI olarak gelir, konusu olarak değil'},
  {key: 'nemlendirme', focus: 'nem — "nemlendirici sürüyorum yine kuru", yaz-kış aynı kremi kullanmak, üstüne makyaj tutmaması gibi görünür durumdan gir. Nem çekici/tutucu/örtücü ayrımı, hyalüronik asidin ne zaman kuruttuğu ve oklüzif katman mantığı açıklama katmanı'},
  {key: 'gunes', focus: 'güneş koruması: UVA/UVB farkı, SPF ve PA ne ölçer, filtre tipleri (mineral/kimyasal), yeniden sürme, yeni çıkan filtre teknolojileri'},
  {key: 'sira-ve-catisma', focus: 'ürün sırası ve etken madde çatışmaları: retinol + asit, C vitamini + niasinamid efsanesi, pH ve nüfuz sırası'},
  {key: 'akne', focus: 'akne mekanizması: gözenek tıkanması, C. acnes, sebum, hormonal akne döngüsü; komedojenik iddiasının ne kadar geçerli olduğu'},
  {key: 'pigment', focus: 'leke ve renk eşitsizliği — kapatıcıyla kapanmayan iz, geçmeyen sivilce izi, yazın koyulaşan bölgeler, hamilelik/doğum kontrol lekesi gibi görünür durumdan gir. Melanin yolu, PIH ile melazma farkı ve güneşin rolü açıklama katmanı'},
  {key: 'yaslanma', focus: 'yaşlanma — "annemin cildi benimkinden iyi", uyumadığın sabah çöken yüz, makyajın oturduğu ilk çizgi, aynı yaştaki iki insanın farkı gibi görünür durumdan gir. Kolajen kaybı hızı, glikasyon ve foto-yaşlanma açıklama; hangi iddia kanıtlı hangisi pazarlama'},
  {key: 'hassasiyet', focus: 'hassas cilt ve tahriş — sürerken batan ürün, "doğal" diye alınıp yüzü kızartan yağ, parfümlü kremle gelen kaşıntı, herkeste işe yarayıp sende ters tepen ürün gibi görünür durumdan gir. Esans/alkol türleri ve alerjen listesi açıklama katmanı'},
  {key: 'efsaneler', focus: 'yaygın efsanelerin mekanizmayla çürütülmesi: gözenek açılıp kapanmaz, pahalı formül daha etkili değildir, doğal her zaman güvenli değildir'},
  {key: 'rutin-tasarimi', focus: 'minimum etkili rutin: kaç adım gerçekten gerekli, hangi sırayla, ne kadar sürede sonuç beklenir (haftalar cinsinden gerçekçi takvim)'},
  // ÜRÜN-MERKEZLİ HAT (Serdar, 2026-07-28): hacim ürünün kendisinde — insanlar "şu serumu
  // alayım mı" diye düşünüyor. Ürünü DENEYEMEYİZ (faceless + otomatik), ama içerik listesi
  // herkese açık: üründen konuşup iddia satmadan analiz yapabiliriz.
  {key: 'icindekiler', timely: true, focus: 'Türkiye\'de çok satan bir cilt bakım ürününün YAYINLANMIŞ içerik listesini (INCI) okumak: hangi etken madde listenin neresinde, ne işe yarıyor, paranın çoğu neye gidiyor. Ürün adını açıkça söyle; "kötü/işe yaramaz" deme, "şu madde şu konumda, beklentin şu olmalı" de'},
  {key: 'muadil', timely: true, focus: 'aynı etken maddeyi çok daha ucuza veren muadil karşılaştırması: pahalı üründeki aktif ile uygun fiyatlı üründeki aktif aynı mı, formülasyon farkı gerçekten fark yaratıyor mu, fiyat farkı neye gidiyor'},
  {key: 'karsilastirma', timely: true, focus: 'iki popüler ürünü TEK bir boyutta kafa kafaya karşılaştırmak (aktif yoğunluğu, bariyer desteği, tahriş riski, kullanım sırası): hangisi hangi cilt için mantıklı'},
  {key: 'iddia-kontrol', timely: true, focus: 'bir markanın reklam cümlesini yayınlanmış mekanizmayla karşılaştırmak: "gözenek sıkılaştırır", "kolajeni geri getirir" gibi iddialar ne kadar destekleniyor, hangi kısmı doğru hangi kısmı abartı'},
  {key: 'cok-satanlar', timely: true, focus: 'şu an gündemde/çok satan bir ürün ya da trend (viral TikTok ürünü, yeni çıkan seri, sosyal medyada konuşulan içerik) — neden konuşuluyor ve mekanizması ne söylüyor'},
  {key: 'cihaz-ve-islem', timely: true, focus: 'ev tipi cihazlar ve klinik işlemler: LED maske, mikroakım, dermaroller riskleri, peeling dereceleri — ne işe yarıyor, ne yaramıyor'},
];

// Konu havuzları — marka dosyası hangi kümeyi kullanacağını söyler (brands/<slug>.json).
// Yeni niş = yeni küme; motor aynı kalır.
// MAKYAJ & GÜZELLİK — 2026-07-28 Serdar direktifi: sayfa fazla "kimya dersi" gibiydi.
// Genç kadın izleyicinin GERÇEKTEN merak ettiği şey cilt kimyasıyla sınırlı değil; makyajın
// neden akmadığı/aktığı, fondöten tonu neden değişiyor, hangi ürün neye para ettiriyor.
// Ton değişiyor, omurga DEĞİL: hâlâ mekanizma anlatıyoruz, pazarlama cümlesi değil.
const BEAUTY_TR = [
  ...SKINCARE_SCIENCE,
  {key: 'makyaj-tutunma', focus: 'makyaj neden akıyor/kayboluyor: sebum, primer film oluşumu, su bazlı ve silikon bazlı ürünün üst üste gelmesi (pilling), fixing sprey gerçekten ne yapıyor'},
  {key: 'fondoten-ton', focus: 'fondöten tonu neden gün içinde koyulaşıyor (oksidasyon), alt ton (undertone) nasıl okunur, kapatıcı rengi neden yeşil/şeftali, SPF\'li fondötenin flashback\'i'},
  {key: 'goz-makyaji', focus: 'göz makyajı mekaniği: maskara formülü (fiber/su bazlı/waterproof) kirpikte ne yapıyor, eyeliner neden dağılıyor, far primerinin işi ne, waterproof temizliği neden yağ ister'},
  {key: 'dudak', focus: 'dudak ürünleri: mat ruj neden kurutuyor, lip oil ile balm farkı, dudak dolgunlaştırıcıdaki tahriş edici (mentol/kapsaisin) mekanizması, dudak peelingi'},
  {key: 'temizleme', focus: 'makyaj temizleme: yağ bazlı temizleyici nasıl çalışıyor (benzer benzeri çözer), çift temizlik gerçekten gerekli mi, mendille temizlemenin bariyere maliyeti'},
  {key: 'sac-ve-cilt', focus: 'saç ürünleriyle cildin kesiştiği yer: saç kremi/köpük kaynaklı sırt-alın akne (pomad akne), kuru şampuan, saç boyası öncesi cilt koruması'},
  {key: 'trend-mekanik', timely: true, focus: 'sosyal medyada konuşulan bir güzellik trendi veya viral ürün (glass skin, slugging, cilt döngüsü, viral bir fondöten/serum) — trendin ARDINDAKİ mekanizma ne söylüyor, kimde işe yarar kimde ters teper'},
  // EĞLENCE HATTI (2026-07-28): "yeter ki insanları güldürsün". Bunlar hâlâ mekanizma
  // anlatıyor ama giriş noktası ortak dert/komik durum — kuru bilgi değil.
  {key: 'makyaj-cantasi', focus: 'makyaj çantasının gerçekleri: ürünlerin GERÇEK ömrü (açıldıktan sonra maskara 3 ay, fondöten 1 yıl), dipteki kırılmış allık, herkesin sakladığı ama kullanmadığı ürün — neden bozulur, ne zaman atılır'},
  {key: 'rutin-gercekleri', focus: '10 adımlı rutini üçüncü günde bırakma döngüsü: hangi adım gerçekten fark yaratıyor, hangisi sadece vicdan rahatlatıyor, minimum efor maksimum sonuç'},
  {key: 'satin-alma-tuzagi', focus: 'bir videoyu izleyip aldığın ve bir daha dokunmadığın ürün: viral pazarlamanın mekaniği, "sana özel" iddiası, ambalajın fiyattaki payı — nasıl fark edilir'},
  {key: 'gunluk-kazalar', focus: 'günlük makyaj kazaları ve gerçek sebepleri: gözaltı kapatıcının çizgilere oturması, ruj dişe bulaşması, öğlen parlayan T bölgesi, maskara alt göz kapağına baskı yapması'},
  {key: 'ortak-yanilgilar', focus: 'herkesin birbirine söylediği ama yanlış olan klasikler: "sivilceyi kurutmak lazım", "gözenek buharla açılır", "yağlı ciltte nemlendirici gerekmez", "pahalı olan daha iyidir" — neden yanlış, doğrusu ne'},
  {key: 'para-degeri', timely: true, focus: 'bir üründe paranın gerçekte neye gittiği: aktif konsantrasyonu mu, ambalaj mı, marka mı; pahalı ile uygun fiyatlı arasındaki formülasyon farkı gerçekten hissedilir mi'},
];


// ── @kizlar.kodu / giyim-dolap ailesi — MODA_TR (2026-08-03) ─────────────────
// @byteflowlabs (İngilizce AI içeriği) 20 postta 2 takipçide kaldı; medyan 118 izlenme,
// 14 kaydetme, 2 PAYLAŞIM. Aynı motorun TR güzellik sayfası tek postta 8 paylaşım + 1349
// izlenme yaptı. Teşhis: konu "kötü" değildi, GÖNDERİLEBİLİR değildi.
//
// Bu havuz cilt.kodu'nun tuttuğu mekaniği giyime taşıyor: okunacak bir ETİKET (INCI'nin
// karşılığı = kumaş bileşimi + yıkama etiketi), somut bir PARA gafı ve ortak bir dert.
// Serdar kapsam kararı: giyim + alışveriş psikolojisi (para gafı en güçlü eksenimiz).
const MODA_TR = [
  // — Kumaş ve malzeme: sayfanın "etiket okuma" omurgası —
  {key: 'kumas-bilesimi', focus: 'kumaş bileşim etiketi — ama HER ZAMAN görünür bir durumdan gir (2 yıkamada biten tişört, terletmeyen gömlek, kaşındıran kazak). %100 pamuk ile %65 polyesterin ne demek olduğu, karışımdaki her lifin ne iş yaptığı açıklama katmanı'},
  {key: 'gramaj-ve-orgu', focus: 'gramaj ve örgü — "ışığa tuttum içi göründü", ilk giyişte sarkan yaka, vücuda oturmayan elbise gibi görünür durumdan gir. Gram/m², örgü sıkılığı ve elyaf uzunluğu açıklama katmanı'},
  {key: 'pilling', focus: 'bilye/tüylenme (pilling) — "yeni kazağım bilye yaptı" durumundan gir. Kısa elyafın sürtünmeyle yüzeye çıkması, hangi karışımların bilye yaptığı, koltuk altı ve çanta askısı bölgeleri neden önce bozulur'},
  {key: 'cekme-ve-deforme', focus: 'çekme ve deformasyon — makineden küçülerek çıkan kazak, dizde torbalanan pantolon, uzayan yaka. Lif gerilimi, sıcak su ve kurutucunun yaptığı; hangi hasar geri döner hangisi dönmez'},
  {key: 'renk-ve-solma', focus: 'renk — 5 yıkamada griye dönen siyah tişört, ilk yıkamada akan kırmızı, güneşte solan parça. Boya tipi/boyama yöntemi, sürtünme ve suyun rolü'},
  {key: 'nefes-ve-koku', focus: 'terleme ve koku — yıkanmasına rağmen kokan spor tişört, sırtta kalan ter izi. Sentetik liflerin kokuyu tutması, nem transferi, hangi kumaş ne zaman doğru seçim'},
  {key: 'lif-ansiklopedisi', focus: 'viskon/modal/likra/polyester/akrilik farkı — ama somut bir karardan gir ("hangisini alayım", "bu neden bu kadar ucuz"). Her lifin gerçekte ne verdiği ve neyi vermediği'},
  // — Bakım —
  {key: 'yikama-etiketi', focus: 'yıkama etiketindeki semboller — leğen içindeki sayı, üçgen, kare, daire ne diyor; "sadece kuru temizleme" ne zaman gerçek ne zaman markanın kendini garantiye alması'},
  {key: 'leke', focus: 'leke — kahve, ter sarısı, deodorant izi, ruj, yağ. Leke tipine göre neden farklı müdahale gerekiyor (protein/yağ/pigment), sıcak suyun lekeyi ne zaman kalıcı yaptığı'},
  {key: 'kurutma-ve-utu', focus: 'kurutma ve ütü — kurutucudan küçülerek çıkan parça, ütüde parlayan kumaş, askıda uzayan kazak. Isı ve ağırlığın life yaptığı'},
  {key: 'deterjan-yumusatici', focus: 'deterjan ve yumuşatıcı — havlunun su çekmemesi, spor kıyafetin kokması, "daha çok deterjan daha temiz" mantığı. Yumuşatıcının lif üzerinde bıraktığı film'},
  {key: 'saklama', focus: 'dolapta saklama — güve deliği, askıda deforme olan kazak, vakumlu poşette kırışan parça, mevsim geçişi. Nem, ışık ve askı seçiminin etkisi'},
  // — Beden, kalıp, kalite —
  {key: 'beden-tablosu', focus: 'beden tablosu — aynı markada iki farklı beden, kabinde olan evde olmayan parça. Beden standardının markadan markaya neden değiştiği, ölçü almanın nasıl yapıldığı'},
  {key: 'kalite-isaretleri', focus: 'bir parçanın kalitesi elde nasıl anlaşılır — dikiş sıklığı, astar, fermuar ağırlığı, desen hizası, düğme dikişi, kenar temizliği. Mağazada 10 saniyede bakılacak yerler'},
  // — Ayakkabı, çanta, takı —
  {key: 'ayakkabi', focus: 'ayakkabı — vuran topuk, ıslanan taban, çatlayan suni deri. Gerçek deri/suni deri farkı, taban malzemesi ve yapıştırma-dikiş ayrımı'},
  {key: 'canta', focus: 'çanta — kabaran kaplama, sarkan sap, yırtılan astar. PU ile gerçek derinin ömrü, donanım kalitesi, ağırlığın sapa yaptığı'},
  {key: 'taki', focus: 'takı — kararan yüzük, yeşil iz bırakan bileklik, alerji yapan küpe. Çelik/gümüş/kaplama farkı, nikel meselesi, kaplamanın kaç ayda gittiği'},
  // — Alışveriş psikolojisi (para gafının doğal evi) —
  {key: 'hizli-moda-ekonomisi', timely: true, focus: 'aynı fabrikadan çıkan 200₺ ve 2000₺ parça — fiyat farkı gerçekte neye gidiyor (kumaş mı, işçilik mi, marka primi mi, mağaza mı). Gündemdeki bir marka/koleksiyon üzerinden konuş; suçlama değil, muhasebe'},
  {key: 'indirim-mekanigi', timely: true, focus: 'indirim etiketinin mekaniği — üstü çizili referans fiyat, "son 3 ürün" sayacı, sezon sonu takvimi, kampanya günlerinde fiyatın önce yükselmesi. Perakende fiyatlamasının nasıl kurulduğu'},
  {key: 'online-alisveris', timely: true, focus: 'ekrandaki parça ile gelen parça — ürün fotoğrafındaki ışık ve iğneleme, model bedeni, renk kalibrasyonu, yorumların nasıl okunacağı. Neyi görsele bakarak ASLA anlayamazsın'},
  {key: 'kargo-ve-iade', timely: true, focus: 'kargo ve iade — ücretsiz kargo eşiğini doldurmak için eklenen üçüncü ürün, iade penceresi, "kutusuyla iade" şartı, iade edilen ürünün akıbeti. Mekaniğin alışveriş kararını nasıl bozduğu'},
  {key: 'marka-primi', timely: true, focus: 'logonun fiyattaki payı — aynı üreticiden çıkan iki etiket, lisanslı koleksiyonlar, "designer" iş birliği parçaları. Neye para verildiğini dürüstçe ayır'},
  {key: 'trend-mekanik', timely: true, focus: 'gündemdeki bir parça ya da mikro trend — neden birden herkeste çıktı, kaç ay sürecek, kumaş/kalıp olarak gerçekten dayanıklı mı yoksa tek sezonluk mu'},
  {key: 'ikinci-el', timely: true, focus: 'ikinci el ve vintage — ne alınır ne alınmaz, eski üretimin kumaşı neden daha ağır, ikinci elde nelere bakılır (koltuk altı, fermuar, astar), online ikinci el platformlarının mekaniği'},
  {key: 'cok-satanlar', timely: true, focus: 'şu an konuşulan/çok satan bir parça ya da malzeme — neden konuşuluyor ve etiketi ne söylüyor. Ürünü açıkça adlandır; "kötü" deme, "şu bileşimle beklentin şu olmalı" de'},
  // — Dolap ve karar —
  {key: 'giyilme-basina-maliyet', focus: 'giyilme başına maliyet — 300₺lik 3 kez giyilen parça ile 1500₺lik 200 kez giyilen parçanın gerçek hesabı. "Ucuza almak" ne zaman pahalıya patlıyor'},
  {key: 'kapsul-dolap', focus: 'az parçayla çok kombin — hangi parçalar gerçekten çok işe yarıyor, dolabın hangi kısmı hiç dönmüyor, renk ve kalıp uyumunun basit mantığı'},
  {key: 'satin-alma-tuzagi', focus: 'bir videoyu/vitrini görüp alınan ve bir daha giyilmeyen parça — "bir gün lazım olur" rafı, özel gün alışverişi, sezon başı heyecanı. Satın alma anındaki hissin mekaniği'},
  {key: 'ortak-yanilgilar', focus: 'herkesin birbirine söylediği ama yanlış olan klasikler — "pahalı olan dayanır", "%100 pamuk her zaman iyidir", "kuru temizleme kumaşa iyi gelir", "sık yıkamak kıyafeti eskitir"'},
  {key: 'gunluk-kazalar', focus: 'günlük kazalar ve gerçek sebepleri — açılan fermuar, kopan düğme, vuran topuk, statik elektrikle bacağa yapışan etek, koltuk altı ter lekesi'},
];


// ── @kizlar.kodu — vücut + günlük hayat merakları (2026-08-03) ────────────────
// Serdar kapsam kararı: sayfa "etiket okuma"dan ÇIKIP "bunu neden herkes yaşıyor"a genişledi.
// Bu aile MODA_TR'nin ÜSTÜNE biner (kizlar-tr = moda + bu), çünkü giyim konuları da birer
// "neden" sorusudur ("neden kazak bilye yapar") — hiçbiri atılmıyor, alt küme oluyorlar.
//
// ⚠ KARDEŞ SAYFA SINIRI: @cilt.kodu = yüze sürülen ÜRÜN ve cilde olan biten. Bu havuzda
// yüz cildi ve cilt bakım ürünü YOK — iki sayfa aynı hafta aynı konuyu anlatırsa ikisi de
// kaybeder. Sınır ihlali örnekleri: gözenek, sivilce, güneş kremi, serum, makyajla uyumak.
//
// ⚠ HEPSİ MEKANİZMASI OLAN sorular. Motorun ürettiği şey diyagram: düğüm → adım → sonuç.
// Mekanizması olmayan konu (ilişki psikolojisi, "bir kızın 'bir şey yok' demesi") bu havuza
// GİRMEZ: kaynaklanamaz, uydurma doğurur. "Test ettik" iddiası da yasak — biz test etmiyoruz.
const VUCUT_GUNLUK = [
  {key: 'koku-korlugu', focus: 'kendi parfümünü bir süre sonra artık koklamamak (koku körlüğü) — burnun aynı uyarana alışması, o yüzden her gün biraz daha fazla sıkmak. "Ben kokmuyor muyum artık?" durumundan gir'},
  {key: 'koku-hafiza', focus: 'bir kokunun aniden eski bir anıyı getirmesi — koku sinyalinin hafıza ve duygu bölgesine diğer duyulardan daha kısa yoldan gitmesi. Bir markette çarpılıp geçmişe gitmek durumundan gir'},
  {key: 'sabah-sismesi', focus: 'sabah uyanınca yüzün ve göz kapaklarının şiş olması — gece yatay pozisyonda sıvının yer değiştirmesi, tuz ve uykusuzluğun payı, gün içinde neden kendiliğinden geçtiği'},
  {key: 'yastik-izleri', focus: 'yüzde ve kolda kalan yastık/çarşaf izleri, sabah kalkınca saatlerce çıkmaması — dokunun basınç altında sıkışması ve geri dolması, hangi uyku pozisyonunun iz bıraktığı'},
  {key: 'parmak-burusmasi', focus: 'duşta ya da bulaşıkta parmak uçlarının buruşması — bunun "su emmek" olmadığı, sinir sisteminin kontrol ettiği bir tepki olduğu ve ıslak yüzeyi kavramaya yaradığı'},
  {key: 'tuy-diken-diken', focus: 'üşüyünce ya da bir şarkıda tüylerin diken diken olması — her tüyün dibindeki minik kasın kasılması, aynı tepkinin hem soğukta hem duyguda çıkması'},
  {key: 'esneme-gozyasi', focus: 'esnerken gözlerin dolması, esnemenin bulaşıcı olması — yüz kaslarının gözyaşı bezine yaptığı basınç ve esnemenin neden yanındakine geçtiği'},
  {key: 'uzuv-uyusmasi', focus: 'bacak bacak üstüne atınca ayağın uyuşması, uyanınca kolun "ölmesi" — sinire uzun süren basınç, karıncalanmanın aslında iyileşme sinyali olması'},
  {key: 'mide-guruldamasi', focus: 'açken (ve bazen tokken) karnın guruldaması, hep en sessiz ortamda olması — bağırsağın boş boruyu süpürmesi ve sesin neden o kadar yükseldiği'},
  {key: 'usume-farki', focus: 'aynı odada birinin üşüyüp diğerinin terlemesi — kas oranı, kan akışı ve ellerin/ayakların neden ilk üşüyen yer olduğu'},
  {key: 'sac-yikama-sikligi', focus: 'saçı her gün yıkamak — "saç dökülür" efsanesi, yağlanma döngüsünün nasıl kurulduğu, iki gün yıkamayınca ne olduğu. Saç derisi ve yağ dengesi (yüz cildi DEĞİL)'},
  {key: 'sac-elektriklenmesi', focus: 'kışın saçın kabarması, atkı çıkarınca havalanması, kıyafetin bacağa yapışması — kuru havada yüzeyler arası yük birikmesi ve neden kışın olduğu'},
  {key: 'tirnak-isaretleri', focus: 'tırnaktaki beyaz lekeler ve dikey çizgiler — "kalsiyum eksikliği" efsanesi, tırnağın nasıl uzadığı, ne kadar sürede tamamen yenilendiği'},
  {key: 'dudak-catlamasi', focus: 'dudağın çatlaması ve yaladıkça daha beter olması — dudakta yağ bezi olmaması, tükürüğün buharlaşırken nemi de götürmesi. Ürün önermek değil MEKANİZMA anlat'},
  {key: 'ter-kokusu', focus: 'terin aslında kokusuz olması, kokuyu bakterilerin yapması, stres terinin neden farklı koktuğu, spor kıyafetinin yıkansa da kokması'},
  {key: 'uyku-borcu', focus: 'hafta içi az uyuyup hafta sonu telafi etmek, alarmın 5 dakikasında daha kötü uyanmak — uyku döngüsünün nerede kesildiğinin uyanma kalitesini belirlemesi'},
  {key: 'ekran-gozu', focus: 'ekrana bakarken gözün kuruması ve yanması — kırpma sayısının düşmesi, "20 dakikada bir uzağa bak" kuralının neden işe yaradığı'},
  {key: 'pahali-mi-degeri', timely: true, focus: 'aynı işi gören ucuz ve pahalı ürün gerçekten farklı mı — parfüm, şampuan, saç kurutma, çanta, takı, deodorant. Farkın NEREDE olduğu (kalıcılık, malzeme, donanım) ve nerede SADECE etiket olduğu. Rakam uydurma; farkın yönünü ve neyi satın aldığını konuş'},
  // — BİTMEYEN KUYULAR (Serdar, 2026-08-03): "türettiklerin bitebilir; gündem, eski
  //   insanlar ve alışkanlıklar hep yeni konu üretir." Bu üçü tohum listesine değil,
  //   sürekli yenilenen kaynağa yaslanıyor: —
  {key: 'anneanne-yontemi', focus: 'anneannenin/annenin yöntemi gerçekten işe yarıyor mu — sirkeyle durulanan saç, tuzlu suyla gargara, kolonyayla ateş düşürme, dolaba konan sabun, yastığın altına konan şey. Alay ETME: çoğunun içinde gerçek bir mekanizma var, onu bul; işe yaramayanı da nereden çıktığıyla anlat'},
  {key: 'eski-usul-ev', focus: 'eskiden herkesin evinde olan ama artık kimsede olmayan alışkanlık — çamaşıra çivit, dolapta güve kesesi, gazete ile cam silmek, kışlık kavanoz, yorgan güneşe serme. Neden yapılıyordu, hangisi hâlâ mantıklı'},
  {key: 'viral-aliskanlik', timely: true, focus: 'şu an sosyal medyada dönen ve herkesin denediği alışkanlık/yöntem — akışta üst üste çıkan o şey aslında ne yapıyor, nereden çıktı, işe yarıyor mu. GÜNDEMDEN seç; "test ettik" DEME (biz test etmiyoruz), yayınlanmış mekanizmayı anlat'},
  {key: 'sehir-efsanesi', timely: true, focus: 'herkesin birbirine söylediği ama yanlış olan klasik — "ıslak saçla dışarı çıkma hasta edersin", "sakız yutulunca 7 yıl kalır", "gece aynaya bakma", "soğuk havada saç daha çok dökülür". Efsanenin NEREDEN çıktığını da söyle, sadece "yanlış" deme'},
];

// kizlar-tr = giyim/dolap ailesi + vücut/günlük hayat ailesi (üst küme).
const KIZLAR_TR = [...MODA_TR, ...VUCUT_GUNLUK];

export const PILLAR_SETS = {'ai-engineering': AI_ENGINEERING, 'skincare-science': SKINCARE_SCIENCE, 'beauty-tr': BEAUTY_TR, 'moda-tr': MODA_TR, 'kizlar-tr': KIZLAR_TR};

/** Marka dosyasındaki pillarSet adına karşılık gelen havuz. */
export function pillarsFor(setName = 'ai-engineering') {
  const set = PILLAR_SETS[setName];
  if (!set) throw new Error(`bilinmeyen pillar kümesi: ${setName} (${Object.keys(PILLAR_SETS).join(', ')})`);
  return set;
}

// Geriye uyum: eski çağrılar doğrudan PILLARS kullanıyor.
export const PILLARS = AI_ENGINEERING;

// %75 güncel-içerik kuralı: 4 postluk deterministik pencerede 3 timely + 1 evergreen.
// postCount = bugüne kadarki toplam post sayısı (history.length).
// Seçilen grup içinde LRU: yakın zamanda kullanılmayanı, hepsi kullanıldıysa en eskisini seç.
// stats verilirse (bkz. brain/scoreboard.mjs) grup içinde PERFORMANSA göre ağırlıklı seçilir:
// tutan pillar'lar daha sık, hiç denenmemişler ortalama sayılır, hiçbiri tamamen ölmez.
// Veri yoksa (ilk haftalar) eski deterministik LRU davranışı aynen sürer.
export function selectPillar(recentKeys = [], postCount = 0, stats = null, pick = null, pillars = PILLARS,
    timelyPayi = 0.75) {
  // %75 kuralı AI sayfasından geliyor: orada kanca HABERDİ (yeni model sürümü). Merak/eğlence
  // sayfasında tersi doğru — asıl varlık evergreen havuz. @kizlar.kodu'da timely havuzu 8
  // konu; %75 ile seçilirse aynı konu ~10 postta bir dönüyor ve Serdar'ın "konu ASLA tekrar
  // etmez" kuralını doğrudan çiğniyor. Oran artık marka dosyasından (`timelyPayi`).
  const wantTimely = (postCount % 4) < Math.round(Math.max(0, Math.min(1, timelyPayi)) * 4);
  const group = pillars.filter(p => Boolean(p.timely) === wantTimely);
  const recent = new Set(recentKeys);
  const fresh = group.filter(p => !recent.has(p.key));
  const pool = fresh.length ? fresh : group;

  // ⚠ selectTwist ile AYNI hata (bkz. brain/twists.mjs): `sampleSize >= 3` şartı tutmayınca
  // her koşuda fresh[0] dönüyordu ve ölçüm birikmemiş yeni sayfa tek bir pillar'a çakılıyordu.
  // pickWeighted ölçüm yokken tekdüze rastgele seçer — asıl keşif orada, ama hiç sorulmuyordu.
  if (pick) {
    const key = pick(pool.map(p => p.key), stats);
    const hit = pool.find(p => p.key === key);
    if (hit) return hit;
  }
  if (fresh.length) return fresh[0];
  const oldestKey = recentKeys.find(k => group.some(p => p.key === k));
  return group.find(p => p.key === oldestKey) ?? group[0];
}
