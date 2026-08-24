# Plan: @cilt.kodu insider sır katmanı

**Tarih:** 2026-08-25 (**rev. F** — iz kapısı düzeltildi: özne düşülmeden ölü doğuyordu;
rev. E: brief + iz şartı · rev. D: kinetik kart + hook/takeaway dokunulmazlığı · rev. C: puanlama kaldırıldı)
**Boy:** M (5 faz)
**Kapsam:** yalnız `ciltkodu`. `kizlarkodu` / `byteflow` bayrak yokluğuyla dokunulmaz.

## Hedef
Spec normal yoldan üretilip özne kapısını geçtikten SONRA, sabit turlu bir LLM derinleştirme
döngüsü o öznenin yaygın bilinmeyen mekanizma detayını bulur; yapı-koruyan bir yeniden yazım
adımı bunu **videonun GÖVDESİNE** işler: `narration` gövde cümleleri + `steps[].status` (kaydedilen
kapanış kartı) + `caption`. Açılış (`hook`, `narration[0]`) ve punchline (`takeaway`,
`narration[son]`) DOKUNULMAZ — ikisi de ölçülmüş kurallara bağlı. Sır **yalnız videoya gerçekten
girdiyse** `brands/state/ciltkodu-sirlar.json`'a yazılır.

## Yaklaşım
Üç saf modül, **`generate-spec.mjs` ve `produce-spec.mjs`'e HİÇ dokunmadan**:
`sir-derinlestir.mjs` (döngü) → `sir-defteri.mjs` (hafıza) → `sir-enjekte.mjs` (yeniden yazım).
Enjeksiyon `brain/localize.mjs`'in ispatlı desenini birebir izler: dar kapsam, yapıyı JS'te zorla
koru, başarısızlıkta girdiyi aynen döndür. Bağlantı `run-daily.mjs`'te TEK dikiş (localize
SONRASI, `stripMarkdown` ÖNCESİ) ve tek bayrak: `brand.sirDerinlestirme.aktif`.

**Ölçüm dürüstlüğü:** erişim/takipçi vaadi YOK. "Google'da yok" ÖLÇÜLMÜYOR. Modelin kendine puan
vermesi de ölçüm değildi — rev C'de **kaldırıldı** (bkz. Ödünleşimler/F). Katmanın çalışıp
çalışmadığı `history`'deki alanlarla sayılabilir; o alanın kendisi de **sözlüksel iz şartıyla**
(3.2, K2) güvence altında — yoksa ölçüm alanı "bayt değişti"yi ölçüp hatayı yeşil raporlardı.
Kill kriteri Faz 5'te **önceden** ilan edildi (%40), veriye bakıp sonradan yazılmayacak.

## Ödünleşimler

| Alternatif | Artı | Eksi | Karar |
|---|---|---|---|
| **B: üretim SONRASI derinleştirme + yapı-koruyan yeniden yazım** | retry/merdiven/özne-kapısı/seed-fallback'e sıfır dokunuş; `localize.mjs` ispatlı deseni; başarısızlık = bugünkü davranış | +3 çağrı (~20-30sn); doğrulama SONRASI mutasyon (kendi JS kapısı şart) | ✅ |
| A: üretim ÖNCESİ konu seçimi + `generateSpec` promptuna enjeksiyon | sır konuyu da belirler | ❌ 449 satırlık PROMPT'u bölmek + `produceSpec` mimarisini yeniden tasarlamak; regresyon yüzeyi tüm yayın hattı |
| C: tek promptta "kendini eleştir" talimatı | sıfır yeni dosya | ❌ durma kriteri yok, derinleşme ölçülemez |
| D: elle küratörlü sır havuzu | kalite garantili | ❌ günlük yayın el emeğine bağlanır |
| E: deftere ONAY sonrası yazmak | yalnız yayınlanan birikir | ❌ `onay-akisi.mjs` değişir (dokunma yasağı) — K1 çözümü bunun %90'ını bayrağa dokunmadan veriyor |
| F: model öz-puanı + eşikle durma | "otomatik durma kriteri" hissi | ❌ tur N, tur N-1'in KENDİ puanlarını görüyor → şişirme daveti; sabit tur sayısı AYNI durma garantisini öz-beyan olmadan veriyor |

---

## Faz 1 — Derinleştirme döngüsü, terminalde okunabilir (dikey dilim)

> Serdar bugün terminalde gerçek bir sır okuyabiliyor. Yayın hattına tek satır bağlı değil.

| # | Görev | Dosya (sahiplik) | Doğrulama |
|---|---|---|---|
| 1.1 | `sirBul({konu, pillar, brief=null, apiKey, brand, bilinenSirlar=[], turSayisi=2, butceMs=40000, fetchFn})` → `{konu, sir, neden, googleSorgu, tur}` \| `null`. **K1 — brief (kör takas kapısı):** `brief = {acilis: narration[0], kapanis: narration[son], status: [...]}`; prompt'a "videonun açılışı ve kapanışı BUNLAR, değiştirilemez — aradaki cümleleri dolduracak, bu ikisiyle ÇELİŞMEYEN bir mekanizma detayı bul" olarak girer. Brief'siz sır, donmuş iki çapadan habersiz seçilir ve video baştan-sondan bir hikâye, ortadan başka bir hikâye olur (`validateSpec` bunu görmez; 3.2'nin kapıları biçimseldir). Yan fayda: kısıt sonradan çarpılan duvar değil brief olduğu için `'tam'` oranı yükselir. Brief opsiyonel — yoksa blok hiç yazılmaz. **Puan YOK, eşik YOK**: döngü sabit `turSayisi` tur koşar ve SON turu (en derini) döner. Tur 2 promptu tur 1'in cevabını + `googleSorgu`'sunu görür ve "bu aramayla 10 saniyede bulunur, bir mekanizma katmanı daha in" talimatı alır. `MODELS`'i `generate-spec.mjs`'ten **import et**. | `brain/sir-derinlestir.mjs` | 1.3 |
| 1.2 | Sınırlar: bütçe aşılırsa eldeki son tur döner; üst üste 2 fetch hatası → `null` (throw YOK); hiç geçerli tur yoksa `null`. Tur sayacı `produceSpec`'in `retries`'inden **tamamen bağımsız**. **T2:** prompt sırrı `pillar.focus` İÇİNDE ve `brand.examples.domain` evreninde kalmaya zorlar. | `brain/sir-derinlestir.mjs` | 1.3 |
| 1.3 | Testler (fetch mock): (a) tam `turSayisi` çağrı yapılır, (b) SON tur döner, (c) tur 2 promptu tur 1'in `sir` ve `googleSorgu` metnini içerir, (d) 2 hata → `null`, (e) bütçe aşımı erken durdurur ve eldekini döner, (f) 1. tur hatalıysa 2. tur yine koşar, (g) **brief verilince `acilis`/`kapanis` metinleri prompt'ta birebir geçer; verilmezse blok hiç yok**. | `brain/sir-derinlestir.test.mjs` | `node --test brain/sir-derinlestir.test.mjs` |
| 1.4 | Prompt'un TÜM örnekleri `brand.examples.domain` + `brand.namedExamples` + `pillar.focus` + `brand.language`'ten türesin; tek sabit cilt/moda/AI kelimesi olmasın. CLI main (`process.argv[1] === fileURLToPath(import.meta.url)`, bkz. `fetch/fetch-trends.mjs:139`): `--brand=`, `--konu=`, `--yaz` (deftere yazma opt-in). | `brain/sir-derinlestir.mjs` | canlı komut ↓ |

**FAZ KAPISI**
- DOĞRULANAN: `node --test brain/sir-derinlestir.test.mjs` → `fail 0`
- DOĞRULANAN: `node --env-file=.env brain/sir-derinlestir.mjs --brand=ciltkodu --konu=retinol`
  → `tur 1`, `tur 2` satırları + tek JSON kazanan, süre < 40sn
- UMULAN (kanıt yok): bilginin gerçekten "insider" olması — **tek kapı Serdar'ın gözü**

**Geri alma:** iki dosyayı sil. Hiçbir üretim yoluna bağlı değil.

---

## Faz 2 — Sır defteri: tekrar önleme + birikim

| # | Görev | Dosya (sahiplik) | Doğrulama |
|---|---|---|---|
| 2.1 | `sirOku(path)` (bozuk JSON → `[]`), `sirEkle(path, kayit)` (son 200; kayıt: `{gun, konu, sir, neden, kullanildi, at}`), `bilinenSirlar(defter, konu, limit=40)`, `sirBenzerMi(a,b)`. `red-defteri.mjs` desenini birebir izle. | `brain/sir-defteri.mjs` | 2.2 |
| 2.2 | **K1-vade düzeltmesi:** benzerlik karşılaştırması yalnız **AYNI konudaki** kayıtlara uygulanır (`subjectsClash(kayit.konu, konu)` ile süzülür), tüm deftere değil. Aksi hâlde defter büyüdükçe `foldTr` token Jaccard ≥ 0.5 farklı öznelerin meşru mekanizmalarını reddetmeye başlar. `bilinenSirlar` da konuya göre süzer. | `brain/sir-defteri.mjs` | 2.2 testi |
| 2.3 | Testler: bozuk dosya → `[]`; 200 kırpma; aynı konuda benzer sır yakalanır; aynı konuda farklı mekanizma GEÇER; **farklı konudaki benzer kelimeli sır çakışmaz**; `kullanildi:false` kayıtlar `bilinenSirlar`'a girmez. | `brain/sir-defteri.test.mjs` | `node --test brain/sir-defteri.test.mjs` |
| 2.4 | `paths.sirlar = join(root, state.sirlar ?? \`brands/state/${slug}-sirlar.json\`)` — `red` satırının altına, aynı desen. **Per-slug zorunlu**, marka-agnostik tek dosya YASAK. Dosya oluşturulmaz, yalnız yol. | `brands/load.mjs` | `node --test` |
| 2.5 | `sirBul`'a defter bağla: `bilinenSirlar(defter, konu)` prompt'a "bu konuda bunları anlattık, BAŞKA bir mekanizma bul" bloğu olarak girer; dönen aday `sirBenzerMi` ile çarpılır, benziyorsa bir sonraki tur "aynısını verdin, başka" uyarısı alır. **`sirBul` deftere YAZMAZ** — yazma kararı çağırana ait (K1). | `brain/sir-derinlestir.mjs` | canlı komut ↓ |

**FAZ KAPISI**
- DOĞRULANAN: `node --test brain/sir-defteri.test.mjs` → yeşil
- DOĞRULANAN: CLI'yı AYNI konuyla `--yaz` ile 2 kez koş → iki `sir` metni farklı, defter 2 kayıt
- UMULAN: defter büyüdükçe kalitenin artması (n=2'de ölçülemez)

**Geri alma:** defter dosyasını sil + `git revert`. `load.mjs` değişikliği diğer markalarda davranışsız.

---

## Faz 3 — Yapı-koruyan enjeksiyon (`localize.mjs` deseni)

| # | Görev | Dosya (sahiplik) | Doğrulama |
|---|---|---|---|
| 3.0 | `tokensClash`'i `export function` yap (şu an modül-içi, `subjects.mjs:43`). Tek kelime, davranış değişmez, mevcut testler kapsıyor. Kuralı `sir-enjekte.mjs`'e KOPYALAMA — önek eşleşme mantığı iki yerde yaşarsa biri sessizce eskir (aynı gerekçeyle 1.1'de `MODELS` import ediliyor). ⚠ `subjects.mjs` sha256 kilidinde DEĞİL, değişmesi serbest. | `brain/subjects.mjs` | `node --test brain/subjects.test.mjs` |
| 3.1 | `enjekteEt({spec, sir, brand, apiKey, fetchFn, retries=1})` → `{spec, uygulandi, sebep}` — **`uygulandi: 'tam' \| 'kismi' \| 'geri-alindi'`** (üç durum; `kismi` = alanların bir kısmı kabul, kalanı geri alındı. 3.2 alan bazlı geri alma yaptığı için "kısmi" GERÇEK bir sonuç, boolean onu görünmez kılardı). Tek çağrı. **Yeniden yazım yüzeyi TAM OLARAK üç alan:** `narration[1..son-1]` (gövde cümleleri), `scenes[].steps[].status`, `caption`. **DONMUŞ:** `hook`, `narration[0]`, `narration[son]`, `takeaway`, `subject`, `nodes`, adım `from/to/packet/color` ve adım SAYISI. Gerekçeler Tuzaklar'da (ölçülmüş kurallar). **T2 çelişki kuralı prompt'ta açık:** "sır mevcut özneye/adımlara/gaf eksenine sığmıyorsa alanları AYNEN geri ver" → JS bunu `'geri-alindi'` sayar. **T1 — ton:** prompt `brand.tone.bodyRule`'u **birebir** taşısın ("PLAIN TALK, NOT A CHEMISTRY LECTURE… terim kaçınılmazsa gündelik benzetmeye çevir"). Sır tanımı gereği teknik; genel "ton korunur" cümlesi bu basıncı tutmaz ve 2026-07-28'in "kimya dersi gibi" nüksünü davet eder. | `brain/sir-enjekte.mjs` | 3.3 |
| 3.2 | JS kapıları (kod karar verir, model değil). Alan bazlı geri alma: **narration** → `length` birebir aynı, `narration[0]` ve `narration[son]` **byte birebir aynı**, her gövde cümlesi `[brand.video.minWords, maxWords]` **aralığında** (tavan+TABAN: taban düşerse video `targetSec` altına iner). **steps** → sahne ve adım sayısı aynı, `from/to/packet/color` byte aynı, her `status` ≤ 40 krk. **caption** → `persona.byline` + `persona.tagline` + `spec.soru` satırları hâlâ içinde. **dil** → `looksLocalized(yeni, brand.language)` (localize.mjs'ten zaten export edilmiş) false ise TÜM enjeksiyon geri alınır. **K2 — SÖZLÜKSEL İZ.** ⚠ `subjectsClash(sir.sir, gövde)` **KULLANMA** — canlıda hep `true` döner ve kapı hiç ateşlenmez (gerekçe Tuzaklar'da). Doğrusu, sırrın tokenlarından ÖZNENİN tokenlarını düşüp kalanı aramak: `ayirtEdici = subjectTokens(sir.sir).filter(t => !subjectTokens(spec.subject).some(k => tokensClash(k, t)))`. Küme boşsa sır özneyi tekrar etmekten ibarettir → `'iz-yok'`. Doluysa **en az biri** `subjectTokens(<gövde + status birleşimi>)` içinde `tokensClash` ile eşleşmeli; eşleşmezse **TÜMÜ geri alınır**, `sebep: 'iz-yok'`. Bu kapı olmadan `uygulandi` "bayt değişti"yi ölçer ve `%40` kill kuralı ölçtüğünü sandığı şeyi ölçmez. Sonda `validateSpec` geçmezse TÜM spec orijinaline döner. Girdi spec mutasyona uğramaz. | `brain/sir-enjekte.mjs` | 3.3 |
| 3.3 | Testler: (a) mutlu yol — gövde + status + caption değişti, (b) narration sayısı değişirse geri alınır, (c) `narration[0]` **veya** `narration[son]` değişirse geri alınır, (d) cümle 6 kelimeye düşerse (minWords=7) geri alınır, (e) `hook`/`takeaway` girdiyle **byte birebir aynı** kalır, (f) status 41 krk olursa steps geri alınır, (g) `packet`/`from`/`to` değişirse steps geri alınır, (h) tagline düşerse caption geri alınır, (i) İngilizce çıktı → `looksLocalized` false → tamamı geri alınır + `'geri-alindi'`, (j) fetch hatası → girdi AYNEN + `'geri-alindi'`, (k) çıktı girdiyle aynıysa `'geri-alindi'`, (l) **yalnız caption geri alınıp gövde kabul edilirse `'kismi'`**, (m) **iz kapısı — fixture CANLI koşulu kurmalı: gövde ÖZNEYİ içeriyor ("retinol" her cümlede geçer) ama sırrın mekanizma kelimelerinden hiçbirini içermiyor → `'geri-alindi'` + `sebep:'iz-yok'`.** Gövdeye özneyi koymayan bir fixture bu kapıyı sınamaz, yeşil yanar ve canlıda kusur açık kalır. (n) aynı fixture'a sırrın tek mekanizma kelimesi eklenince kapı GEÇER, (o) sır özneden başka ayırt edici token içermiyorsa → `'iz-yok'`, (p) **izolasyon**: gerçek `ciltkodu.json` ile promptta `/kumaş|moda|RAG|LLM|MCP/` YOK, gerçek `kizlarkodu.json` ile `/retinol|gözenek|SPF/` YOK. | `brain/sir-enjekte.test.mjs` | `node --test brain/sir-enjekte.test.mjs` |

**FAZ KAPISI**
- DOĞRULANAN: `node --test` (tüm depo) → `fail 0`
- DOĞRULANAN (dokunulmazlık kanıtı, git'e güvenmeden — WSL/NTFS): Faz 3'e başlamadan
  `sha256sum brain/generate-spec.mjs brain/produce-spec.mjs > /tmp/once.txt`, faz sonunda
  `sha256sum -c /tmp/once.txt` → **iki satır da `OK`**
- UMULAN: yeniden yazımın gafı bozmaması — Faz 5'te canlı görülür

**Geri alma:** `git revert`. Faz 4'e kadar hiçbir çağıranı yok.

---

## Faz 4 — `run-daily.mjs` bağlantısı + marka bayrağı + ölçüm alanları

| # | Görev | Dosya (sahiplik) | Doğrulama |
|---|---|---|---|
| 4.1 | `"sirDerinlestirme": {"aktif": true, "turSayisi": 2, "butceSn": 40}` ekle (eşik alanı YOK). | `brands/ciltkodu.json` | 4.4 |
| 4.2 | **Tek dikiş: satır 134-135 arası** (`localizeSpec` SONRASI, `stripMarkdown` ÖNCESİ). Atlama koşulları ve sebepleri: `bayrak-kapali` / `fixture` / `not-var` / `seed`. Akış: `sirBul({konu: localized.subject, pillar, brief: {acilis: localized.narration[0], kapanis: localized.narration.at(-1), status: localized.scenes.flatMap(s => (s.steps ?? []).map(x => x.status))}, ...})` → `enjekteEt(...)` (K1: brief burada kuruluyor, sır donmuş çapaları GÖREREK seçiliyor). **K1/T3:** `sirEkle` **YALNIZ** `uygulandi` `'tam'` ya da `'kismi'` iken (yani sır videoya gerçekten girdiyse) `kullanildi: true` ile çağrılır — seed, notsuz "tekrar dene", `'geri-alindi'`, "vazgeç" hâllerinde defter BÜYÜMEZ, sır yarın yeniden üretilebilir. Tamamı try/catch; hata → `console.error` + `localized` ile devam. | `run-daily.mjs` | 4.4 |
| 4.3 | **K2 + T1 — ölçüm alanları.** `history.push` nesnesine ekle: `sir: sirSonuc?.sir?.slice(0, 120) ?? null`, **`sirUygulandi: 'tam' \| 'kismi' \| 'geri-alindi' \| null`** (enjeksiyonun döndürdüğü üç durum; katman hiç koşmadıysa `null`) ve `sirAtlandi: sebep ?? null` (`bayrak-kapali`/`fixture`/`not-var`/`seed`/`dongu-null`). Böylece 2 hafta sonra **geri-alma oranı** ve **atlama sıklığı** `ciltkodu-history.json`'dan sayılabilir — `console.error` gece koşusunda kaybolur, bu kayıt kalır. Ek kapı yok, seed fallback riski yok. | `run-daily.mjs` | 4.4 |
| 4.4 | Yerel tam koşu + kizlarkodu regresyonu. | — | canlı komut ↓ |

**FAZ KAPISI**
- DOĞRULANAN: `BYTEFLOW_FOOTAGE=0 BYTEFLOW_VOICE=0 BYTEFLOW_BRAND=ciltkodu npm run daily`
  → `🔍 sır ...` satırı, `✓ done (gemini)`, `dist/final.mp4` var
- DOĞRULANAN (K2 — sırrın videoya ULAŞTIĞI, konsol satırının varlığı DEĞİL):
  `node -e "const h=require('./brands/state/ciltkodu-history.json').at(-1); console.log(h.sirUygulandi, h.sirAtlandi, h.sir)"`
  → `tam null <sır metni>`. Bu alan artık 3.2'nin **sözlüksel iz kapısıyla** güvence altında:
  `'tam'`/`'kismi'` yazılabilmesi için sırdan en az bir ayırt edici kelimenin gövdede ya da
  status satırlarında GEÇMESİ şart — yani ilk günkü göz doğrulaması sonraki 2 hafta boyunca
  kodla sürdürülüyor (gözle de teyit et, ama sayım artık gözle beslenmiyor)
- DOĞRULANAN (rev D): `hook` ve `takeaway` enjeksiyon öncesi/sonrası **birebir aynı**
  (`ciltkodu-spec.json` ile enjeksiyon öncesi kopyayı karşılaştır)
- DOĞRULANAN (K1/T3): `sirUygulandi` `'tam'` ya da `'kismi'` ise `ciltkodu-sirlar.json` +1 kayıt
  (`kullanildi: true`); `'geri-alindi'` ya da `null` ise defter **büyümemiş**
- DOĞRULANAN (regresyon): aynı komut `BYTEFLOW_BRAND=kizlarkodu` ile → `🔍 sır` YOK,
  `kizlarkodu-sirlar.json` OLUŞMADI, video üretildi
- UMULAN: sırrın izleyiciye "not alınası" gelmesi — atıf yapılamaz

**Geri alma:** `sirDerinlestirme` anahtarını sil (ya da `aktif: false`) → tek `if` ile eski yol.
`brand.format` / `onay.aktif` ile aynı desen.

---

## Faz 5 — Onay akışı, kota ve commit regresyonu (canlı)

| # | Görev | Dosya (sahiplik) | Doğrulama |
|---|---|---|---|
| 5.1 | Videoyu normal akışla onay kutusuna düşür; hiçbir dosya değişmez. | — | kapı ↓ |
| 5.2 | Onay kutusundan **notlu** ve **notsuz** "tekrar dene"yi ayrı ayrı dene. | — | kapı ↓ |

**FAZ KAPISI**
- DOĞRULANAN: video `onay.temsor.com` kuyruğunda; `--nobet` yolu değişmemiş
- DOĞRULANAN: **notlu** tekrarda `🔍 sır` YOK, `📝 Serdar'ın notu` VAR, `sirAtlandi: "not-var"`
- DOĞRULANAN (K1): **notsuz** tekrarda katman yeniden koşar; atılan denemenin sırrı defterde
  **yok** (o video hiç yayınlanmadı) — `git diff brands/state/ciltkodu-sirlar.json` boş ya da
  yalnız yeni kabul edilen kayıt
- DOĞRULANAN: aynı gün ikinci koşu `publish/gunluk-kota.mjs` tarafından engelleniyor
- DOĞRULANAN: onay sonrası `git show --stat HEAD` → `ciltkodu-sirlar.json` commit'te
- UMULAN: içeriğin kaydedilesi/gönderilesi olması — ölçülmüyor

**T2 — ÖNCEDEN İLAN EDİLMİŞ KILL KRİTERİ.** Tek çağrıda sekiz eşzamanlı kısıt (5 cümle sayısı,
2 uç byte kilidi, 7-11 kelime aralığı, 3×≤40 krk status, `from/to/packet/color` kilidi, caption
3 satır sözleşmesi, `looksLocalized`, iz şartı) + `retries=1` var; yüksek geri-alma makul bir
sonuç. Eşik ŞİMDİ yazılıyor ki sonradan veriye bakıp rasyonalize edilmesin:
`node -e "const h=require('./brands/state/ciltkodu-history.json').filter(x=>x.sirUygulandi); console.log(h.filter(x=>x.sirUygulandi!=='geri-alindi').length+'/'+h.length)"`
→ **2 hafta sonra oran %40'ın altındaysa `sirDerinlestirme.aktif = false`** ve katman gözden
geçirilir. Bu bir karar kuralıdır, tartışma konusu değil.

**Geri alma:** marka bayrağını kapat. Onay/kota koduna hiç dokunulmadı.

---

## Tuzaklar

- `brands/ciltkodu.json:99-102` — **yeniden yazım yüzeyi markanın KENDİ ton tasarımına 1:1
  oturuyor, bu bir tesadüf değil gerekçedir:** `angle` "…sonra o kahkahanın İÇİNDE asıl önemli TEK
  mekanizmayı anlat", `bodyRule` "izleyici yarın sabah kullanabileceği tek şeyi öğrensin",
  `hookRule` "günün gafı burada, mekanizma adı ASLA", `takeawayRule` "aynı gaf ekseni, bıçağı
  çevir". Yani gaf = uçlar, mekanizma = gövde ayrımını marka zaten yapmış; enjeksiyon markanın
  "mekanizma" yuvasına giriyor. Yüzeyi genişletmek isteyen önce bu dört satırı okusun.
- Ölçü (yer dar mı sorusu): `ciltkodu.json:94-95` `minSteps=maxSteps=3` → kinetik narration
  = 2+3 = **5 cümle**; donmuş uçlar çıkınca gövde = 3 cümle × 7-11 kelime + 3 status + caption
  ≈ konuşulan 20sn'nin **10-14 saniyesi**. Yüzey dar değil; risk ters yönde (bkz. K1 brief).
- `brain/generate-spec.mjs:304-307` — **kinetik biçimde `steps[].status` satırları AYNI ZAMANDA
  videonun kapanış ÖZET KARTI** ve ekran görüntüsü alınıp kaydedilen şey odur (2026-08-07).
  Yalnız `narration` yeniden yazılırsa gövde sırrı anlatır ama ekranda kalan kart ESKİ mekanizmayı
  anlatır — kaydedilen kare yanlış olur. Bu yüzden `status` yeniden yazım yüzeyine DAHİL.
- `brands/ciltkodu.json:104` (`tone.doorRule`) — açılış SOMUT bir durumdan gelmeli: ölçüm
  somut satın almayla açılan videoda **1349**, soyut mekanizmayla açılanlarda **32-36** izlenme
  (~40 kat). Sır tanımı gereği bir MEKANİZMA detayıdır; `hook`'u sırla yeniden yazmak açılışı tam
  da ölçülmüş kötü tarafa iter → `hook` DONMUŞ.
- `brands/ciltkodu.json:102` (`tone.takeawayRule`) — `takeaway` günün GAFINI kapatan punchline;
  sırla yeniden yazmak gafı düşürür. `takeaway` ve onun sesli ikizi `narration[son]` DONMUŞ
  (ikisi ayrı ayrı değişirse metin ile ses birbirinden kopar).
- `brain/generate-spec.mjs:406-412` — `narration[0]` TÜM cümlelerin **EN KISASI** ve ≤ 6 kelime
  olmalı (`Math.max(6, minWords-1)`); 2026-08-07 ölçümü: düşüş tam açılış cümlesinde oluyor.
  `narration[0]` da DONMUŞ — bu kapıyı korumanın en ucuz yolu alanı hiç ellememek.
- `publish/voiceover.mjs` + `render/src/lib/kinetik-zaman.mjs` — `narration` videonun ZAMANLAMASI
  ve kinetik biçimde ekranda tek tek görünen cümleler. Cümle SAYISI kilidi pazarlık konusu değil.
  Kelime TABANI da kilit: kısalan cümleler videoyu `targetSec: 20` altına indirir.
- `brain/produce-spec.mjs:38-45` — `repairSpec` + `validateSpec` + özne kapısı `produceSpec`'in
  İÇİNDE koşar. Enjeksiyon ondan SONRA geldiği için kendi `validateSpec` kapısını kurmak zorunda.
- `run-daily.mjs:134` — dikiş `localizeSpec` SONRASI. `brain/localize.mjs:77` Türkçe görünen
  spec'te çeviriyi ATLAR; enjeksiyon Türkçe üretmezse ekranda İngilizce kalır, ikinci şans yok.
  Kapı hazır: `looksLocalized` zaten `localize.mjs:40`'ta export edilmiş — yeniden yazma, kullan.
- `run-daily.mjs:135-138` — enjeksiyondan sonra `stripMarkdown`/`sanitizeHashtags`/`formatCaption`
  zaten koşuyor; hijyeni tekrar yazma.
- `publish/onay-akisi.mjs:162-170` — **notsuz** "tekrar dene"de `BYTEFLOW_NOT` BOŞ gider, yani
  `!serdarNotu` koşulu TUTAR ve katman yeniden çalışır. K1 düzeltmesi olmadan atılan videonun
  sırrı defterde kalıcı yanmış olurdu.
- `brain/red-defteri.mjs:13-14` — emsal budur: "video hiç yayınlanmadı, izleyici konuyu görmedi —
  konuyu haftalarca yakmak gereksiz". `subjects.mjs:60`'ın 8 postluk penceresi bu deftere emsal
  DEĞİL (o pencere kayar, defter kalıcıdır).
- `brain/subjects.mjs:26-31,48-52` — **iz kapısında `subjectsClash`'i olduğu gibi kullanmak kapıyı
  ÖLÜ doğurur.** `subjectsClash` "herhangi bir ayırt edici token eşleşti mi" diye bakıyor ve
  `GENERIC` kümesinde `asit/serum/cilt/bakim` var ama **hiçbir etken madde adı yok** — `retinol`,
  `niasinamid`, `gozenek` ayırt edici sayılıyor. Video zaten o özne hakkında olduğu için gövde
  özneyi HER cümlede anar; sır cümlesi de anar → kapı canlıda **hep `true`** döner, sırdan tek
  mekanizma kelimesi girmese bile. Bu yüzden 3.2 önce özneyi düşüyor. Aynı tuzak testte de var:
  gövdeye özneyi koymayan bir fixture kapıyı yeşil gösterir ama canlı koşulu kurmaz (3.3(m)).
- `brain/generate-spec.mjs:85-105` — sabit örnekler nişi TANIMLAR, yasaklamaz (2026-07-28 canlı
  hata). İki yeni prompt da tek kelime hardcode etmemeli; izolasyon testi 3.3(p).
- `generate-spec.mjs:394-396` — kinetikte diyagram RENDER EDİLMİYOR; `from/to/packet/color` byte
  kilidi ekranda görünmeyen alanları koruyor. Zararsız ve biçim değişirse işe yarar, kaldırma —
  ama "izleyicinin gördüğünü koruyor" sanma: görüleni koruyan tek şey status uzunluğu ve iz şartı.
- Gaf ekseni: `hook`/`takeaway` bugünün gafının sesiyle yazıldı. Yeniden yazım gafı EZERSE
  sayfanın omurgası gider — prompt'ta rol ayrımı açık (sır = NE, gaf = NASIL).
- **Commit sorusu KAPALI:** `daily.yml:181,217,276` ve `onay-akisi.mjs:93` `brands/state`'i
  **dizin olarak** `repo-push.sh`'e veriyor, o da `git add -f` yapıyor (`repo-push.sh:23`) →
  yeni defter otomatik stage'lenir. Workflow'a DOKUNMA.
- `npm test` = `node --test` (tüm depo). Tek dosya: `node --test brain/x.test.mjs`.

## Riskler

| Risk | Olasılık | Etki | Azaltma |
|---|---|---|---|
| Sabit 2 tur yeterince derine inmez | Orta | Sıradan bilgi | `turSayisi` marka dosyasından; Faz 1 CLI'da Serdar gözle görür; ölçüm alanları + iz kapısı oranı sayılabilir kılar |
| Sır gövdeye girer ama donmuş uçlarla ÇELİŞİR (kör takas) | Yüksek (brief öncesi) | Video baştan-sondan bir hikâye, ortadan başka | K1 brief: `sirBul` açılış/kapanış/status'ü görerek seçiyor; 3.2 kapıları biçimsel, bunu yakalayamazdı |
| `uygulandi` "bayt değişti"yi ölçer, sırrı değil | Yüksek (iz kapısı öncesi) | Ölçüm alanı hatayı YEŞİL raporlar | K2 sözlüksel iz şartı (`subjectsClash`), aksi hâlde `olcum-dersleri`ndeki "sessiz kusur" deseni birebir tekrarlanırdı |
| Yeniden yazım gafı/tonu düzler | Düşük (rev D sonrası) | Komik omurga gider | Gafı taşıyan iki alan (`hook`, `takeaway`) artık hiç ellenmiyor; kalan yüzey gövde + kart + caption |
| Gövde sırrı anlatırken kapanış kartı eski mekanizmada kalır | Yüksek (rev D öncesi) | Kaydedilen kare yanlış | `steps[].status` yeniden yazım yüzeyine dahil; adım sayısı/id/packet donuk |
| Sır uydurma/halüsinasyon | Orta | Yanlış iddia yayına gider | Enjeksiyon promptunda "sayı uydurma / kapalı ürünün içini bildiğini iddia etme" tekrarlanır; onay kutusu insan kapısı |
| Defter 200 kaydı doldurunca meşru sırları reddeder | Düşük (2.2 sonrası) | Konu havuzu daralır | Benzerlik yalnız AYNI konu içinde; `bilinenSirlar` konuya göre süzülür; yalnız `kullanildi:true` kayıtlar sayılır |
| +3 çağrı süreyi uzatır (~20-30sn) | Yüksek | Koşu süresi | `butceSn` + 2 tur tavanı; nöbet 170dk — etkisiz |

## Kapsam dışı
- `kizlarkodu` / `byteflow`'a açmak (bayrak eklenmez)
- `brain/generate-spec.mjs`, `brain/produce-spec.mjs` — **tek satır bile değişmeyecek** (sha256 kapısı)
- `publish/onay-akisi.mjs`, `publish/gunluk-kota.mjs`, `publish/publish-latest.mjs`, workflow'lar
- Gerçek arama motoruyla "Google'da var mı" doğrulaması (API yok; iddia heuristik kalır)
- Sırların doğruluk denetimi (fact-check) otomasyonu
- `not`'u derinleştirmeye TOHUM yapmak (şimdilik `not` varsa katman atlanıyor — sonraki plan)
- `hook`, `takeaway`, `narration[0]`, `narration[son]`, `subject`, `nodes`, adım id/packet/color —
  hiçbirine dokunulmayacak (rev D: ölçülmüş kurallara bağlılar)
- Defterin `bannedSubjects`'i beslemesi; skor tablosuna "sır" boyutu eklemek
- Defter kayıtlarına süre aşımı/temizlik (200 kayıt ~6 ay; 2.2'den sonra zararsız — sonraki plan)

---
<!--
  KABUL ÖLÇÜTÜ:
  [x] Her fazın çalıştırılabilir doğrulama komutu var
  [x] Faz 1 uçtan uca dikey dilim
  [x] Her görev 2-15 dakikalık
  [x] Dosya sahipliği net (2.4 ve 4.1/4.2/4.3 tekil sahip; 1.x/2.1-2.3/3.x ayrı dosyalar)
  [x] 6 alternatif değerlendirildi (B seçildi; A/C/D/E/F gerekçeli elendi)
  [x] Her faz için geri alma yolu yazılı
  [x] K1 (deftere erken yazma) ve K2 (kapı sırrın videoya ulaştığını kanıtlamıyor) düzeltildi
  [x] rev D: kinetik kapanış kartı (steps[].status) yüzeye dahil; hook/takeaway/narration uçları donduruldu
  [x] rev D: looksLocalized dil kapısı; minWords TABANI; sha256 dokunulmazlık kanıtı
  [x] rev D: T1 üç durumlu `sirUygulandi` (tam/kismi/geri-alindi) — geri-alma oranı sayılabilir
  [x] rev E: K1 brief (kör takas), K2 sözlüksel iz şartı, T1 bodyRule birebir, T2 kill kriteri
  [x] rev F: iz kapısından ÖNCE öznenin tokenları düşülüyor (aksi hâlde kapı hep true, ölü doğar)
  [x] karsi-gorus 2. incelemesinden GEÇTİ — hüküm ONAY; rev F onun son düzeltmesini de içeriyor
-->
<!-- UYGULAMA ÖNCESİ TEK AÇIK NOKTA: Serdar'ın 3 tasarım kararı onayı
  (1) not varsa katman atlanır  (2) seed fallback'te atlanır  (3) "Google'da yok" heuristiktir
-->
