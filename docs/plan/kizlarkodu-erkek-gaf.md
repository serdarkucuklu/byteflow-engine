# Plan: kizlarkodu — "erkek gafı" TWIST ailesi

> **REVİZYON NOTU (2026-08-23, `karsi-gorus` sonrası)**
> 1. **pillar → twist.** "Erkek gafı" konu değil AÇI. `brain/pillars.mjs:137-139` sayfanın kendi kuralı:
>    mekanizması olmayan konu havuza girmez (kaynaklanamaz → uydurma). `generate-spec.mjs:241` her
>    `step.status`tan gerçek mekanizma iddiası istiyor. Bu yüzden **yeni pillar YOK**, `examples.domain`
>    genişletme YOK, `subjects.mjs` dokunulmuyor; `MODA_TR` twist havuzuna 4 açı ekleniyor.
> 2. Faz 1 dry-run kapısı artık **`--twist` zorunlu** — twist'siz koşu üretimden farklı prompt ölçer
>    (`run-daily.mjs:82` gerçek koşuda her zaman twist zorluyor).
> 3. Kapılar **`source==='gemini'`** kontrol ediyor — seed fallback (`produce-spec.mjs:64-70`) kumaş
>    seed'i döndürüp yalan yeşil veriyordu.
> 4. Onay kalemi 24 saat içinde karara bağlanır (onaybox hatırlatması var; sessiz tıkaç dersi işlendi).
>
> **REVİZYON NOTU 2 (2026-08-23, `karsi-gorus` 2. tur sonrası):**
> 5. **Ölçüt yanlış lensteydi.** "Domain içi/dışı" ayrımı geçersiz: marka zaten `koku-korlugu`,
>    `uyku-borcu` gibi vücut/günlük-hayat konuları üretiyor ve `examples.domain` bunları reddetmiyor —
>    reddetmiyor ama KONUYU KUMAŞA ÇEKİYOR (geçmişte "akrilik", "suni deri" sızmış). Twist `subject`'i
>    hiç belirlemez (yalnız gaf+alıcı), o yüzden domain kuralıyla twist çarpışmaz; gerçek kırılganlık
>    **hook↔gövde TUTARLILIĞI**dır (hook kumandayla açıp gövde mide guruldamasını anlatması gibi).
>    2.5 ölçütü buna göre değişti: her sınır twist'i İKİ pillar'la (biri kumaş, biri vücut) koşulur.
> 6. **Sızıntı regex'i yanlış kırmızı üretiyordu** — `abi ⊂ sabit/kabin/abiye`, `koca ⊂ kocaman`,
>    `adam ⊂ adamakıllı`. Kelime-sınırı olmayan bir regex 2.5'in "geçemeyeni sil" adımıyla birleşince
>    İYİ bir twist'i yanlış gerekçeyle silebilirdi. 1.6 artık harf-sınırlı (lookaround) desen kullanıyor.
> 7. Twist `focus` metnine ucuz bir kazanç: pozitif/negatif örnek ÇİFTİ gömülüyor (model kuralı değil
>    örneği taklit eder — `generate-spec.mjs:85-89` deposunun kendi dersi).
>
> **REVİZYON NOTU 3 (2026-08-23, `/kalite` sonrası — SONUÇ):** `gozden-gecirici` sızıntı kapısında
> 2 KRİTİK açık buldu: regex Türkçe eklere kördü (`adamın/kocası/adamlar` kaçıyordu), versus sahnesi
> (`heading/left/right/rows`) hiç taranmıyordu. İkisi düzeltildi (881bf55). Düzeltilmiş kapıyla 3
> twist YENİDEN ölçüldü: `yon-inadi` 2 pillar ailesinden birinde (beden-tablosu) gerçek sızıntı verdi
> ("...adama değil mezuranın santimine güvenin") → 2/2 tutarlılık şartını sağlamadı → **havuzdan
> silindi**. **NİHAİ HAVUZ (2 twist): `erkek-dolabi`, `yikama-cesareti`.** `kumanda-imparatorlugu`
> ve `yon-inadi` — ikisi de silindi.

**Tarih:** 2026-08-23 · **Boy:** M (tek geliştirici, sıralı) · revizyon 2

## Hedef
@kizlar.kodu'nun gaf havuzuna (`moda-tr`) 4 "erkek gafı" açısı eklenir: konu/mekanizma aynı kalır
(kumaş, dolap, bakım, vücut), gülme kapısı kadın izleyicinin çevresindeki erkeğin davranışı olur.
Plan bitince bu açılardan biriyle üretilmiş TEK gerçek video onay kutusunda karar bekliyor olur.

## Yaklaşım
Twist mekanizma iddiası taşımaz — taşıyan pillar'dır. Twist yalnız hook, `sendTo` ve caption'ın
gönder CTA'sında görünür (`generate-spec.mjs:231-236` bunu HARD RULE yapmış: kişi node label /
step.status / mekanizma cümlesinde YASAK). Yani "erkeğin davranışı" kapı, "kumaşa/vücuda ne oluyor"
gövde. Kritik ölçüm noktası **domain içi/dışı DEĞİL** (marka zaten vücut/günlük-hayat pillar'larını
üretiyor, `examples.domain` bunları reddetmez, konuyu sessizce kumaşa çeker) — asıl kırılgan yer
**hook'un twist'le açıp gövdenin o gün atanmış pillar'ın mekanizmasına gerçekten bağlanması**.
Bu yüzden Faz 1 içeriden bir pillar'la dikey dilim koşar, Faz 2 sınır açılarını (kumanda, yön inadı)
İKİ FARKLI pillar'la (biri kumaş ailesinden, biri vücut/günlük-hayat ailesinden) ölçer; hook↔gövde
tutarsız çıkan ya da konu kumaşa/vücuda geri çekilen twist havuzdan silinir.

## Ödünleşimler

| Alternatif | Artı | Eksi | Karar |
|---|---|---|---|
| `MODA_TR`'ye 4 twist ekle, pillar/domain'e dokunma | mekanizma pillar'dan gelmeye devam eder; diff küçük; rotasyon/soğuma bedava | twist rastgele pillar'la eşleşir (kapı-konu uyumsuzluğu riski) | ✅ |
| Yeni `erkek-gaf` pillar ailesi (revizyon öncesi plan) | konu ekseni net | mekanizmasız konu = kaynaksız iddia; kelime yasağı testi bunu YAKALAYAMAZ | ❌ |
| Pillar'a göre twist filtresi (`twistsFor(set, pillar)`) | kapı-konu uyumu garanti | seçim mantığı + geçmiş/LRU semantiği değişir; 4 twist için fazla makine | ❌ (ölçüm sonrası) |
| `kime` = erkeğin kendisi ("eşine/kardeşine") | Serdar'ın tarifi bu; doğrudan | gönderme döngüsü zayıf (moda videosu erkeğe gönderilmez) | ✅ şimdilik — tek string, Faz 2 ölçümünde çevrilebilir |
| Doğrulamayı `run-daily.mjs` ile yap | ekstra dosya yok | her deneme ~10 dk render + TTS kotası; geri bildirim döngüsü ölür | ❌ (dry-run script) |

---

## Faz 1 — Uçtan uca ince dilim: 1 twist → gerçek spec

| # | Görev | Dosya (sahiplik) | Doğrulama |
|---|---|---|---|
| 1.1 | `MODA_TR` sonuna `ERKEK GAFI` blok yorumu + ilk twist `erkek-dolabi` (kime: "üç tişörtle bütün mevsimi geçiren kardeşine/eşine"; focus: kapı ERKEĞİN davranışı, ⛔ YASAK satırı: "erkek beyni/erkekler şöyledir" tarzı genelleme ve mekanizma iddiası — mekanizma bugünkü KONUDAN gelir; **✅böyle / ⛔böyle-değil** örnek çifti — model kuralı değil örneği taklit eder) | `brain/twists.mjs` | 1.3 |
| 1.2 | `twistByKey(key, twists)` export — anahtar yoksa **throw** (sessiz fallback yasak) | `brain/twists.mjs` | 1.3 |
| 1.3 | 2 test: `twistByKey` bilinmeyen anahtarda throw ediyor; `erkek-dolabi` `moda-tr` içinde, `kime` ve `focus` dolu, `focus` "YASAK" satırı içeriyor | `brain/twists.test.mjs` | `node --test brain/twists.test.mjs` |
| 1.4 | `run-daily.mjs:81-86` — `BYTEFLOW_TWIST` varsa `twistByKey()` ile zorla, yoksa eski `selectTwist` yolu aynen | `run-daily.mjs` | `BYTEFLOW_TWIST=yok-boyle-bir-sey node --env-file=.env run-daily.mjs` → gaf satırında hata + exit≠0 (Gemini'ye VARMADAN) |
| 1.5 | Dry-run script: `--brand`, `--pillar`, **`--twist` (ZORUNLU; yoksa kullanım yazıp exit 2)**. `loadBrand` + `pillarsFor().find` + `twistByKey` + `produceSpec` çağırır; `title/hook/subject/sendTo/step.status'lar/narration/caption` basar; dosya YAZMAZ, render/TTS YOK | `brain/dene-spec.mjs` (yeni) | 1.6 |
| 1.6 | Aynı script iki sert kapı koyar: (a) `source!=='gemini'` → `✗ SEED FALLBACK` + exit 1; (b) SIZINTI taraması — harf-sınırlı desen `(?<![a-zA-ZçğıöşüÇĞİÖŞÜ])(erkek\|adam\|koca\|kardeş\|abi)(?![a-zA-ZçğıöşüÇĞİÖŞÜ])` (lookaround; "sabit/kabin/abiye/kocaman/adamakıllı" gibi alt-dizeleri YANLIŞ kırmızı üretmez) node label / step.status / narration'da geçiyorsa exit 1 (hook, `sendTo`, caption CTA HARİÇ: kişi oralarda serbest) | `brain/dene-spec.mjs` | aşağıdaki kapı |

**FAZ KAPISI:**
`node --env-file=.env brain/dene-spec.mjs --brand=kizlarkodu --pillar=kurutma-ve-utu --twist=erkek-dolabi`
→ exit 0, çıktıda `source: gemini`, SIZINTI satırı YOK; gözle: `hook` erkeğin davranışıyla açıyor,
3 `step.status` kumaş/bakım mekanizması anlatıyor, hiçbiri "erkekler şöyledir" iddiası taşımıyor.
Ek: `node --test brain/twists.test.mjs` yeşil.
**Geri alma:** `git revert <sha>` (tek commit). Kısmi: `MODA_TR`'den `erkek-dolabi` nesnesini sil —
`twistByKey` ve dry-run script zararsız kalır.

---

## Faz 2 — Kalan 3 açı + sınır ölçümü + kalıcı kapılar

| # | Görev | Dosya (sahiplik) | Doğrulama |
|---|---|---|---|
| 2.1 | İçeriden 1 açı daha: `yikama-cesareti` (kime: "her şeyi tek makinede 60 derecede yıkayan kardeşine/eşine") | `brain/twists.mjs` | 2.4 |
| 2.2 | Sınır açıları: `kumanda-imparatorlugu` (kime: kumandayı asla bırakmayan), `yon-inadi` (kime: navigasyon varken yol soran). focus metni açıkça "kapı bu davranış, anlatılan konu bugünkü pillar" desin + ✅/⛔ örnek çifti | `brain/twists.mjs` | 2.5 (ölçüm) |
| 2.3 | 3 test: (a) `moda-tr` anahtarları tekil ve ≥20, (b) 4 erkek twist'inin `kime` alanı dolu, (c) `focus` metinlerinde aşağılayıcı kelime yok (`aptal, salak, beceriksiz, ezik, işe yaramaz`) ve genelleme kalıbı yok (`erkek beyni`, `erkekler hep`) | `brain/twists.test.mjs` | `node --test brain/twists.test.mjs` |
| 2.4 | Prompt testi: gerçek `brands/kizlarkodu.json` + `twist={key:'erkek-dolabi',...}` ile prompt üret → `TODAY'S GAF` bloğu twist focus'unu İÇERİYOR, `WHO THIS ONE IS FOR` satırı `kime`yi içeriyor, "EXACTLY three places" kuralı prompt'ta duruyor (gerileme kilidi) | `brain/generate-spec.test.mjs` | `node --test brain/generate-spec.test.mjs` |
| 2.5 | Sınır ölçümü: `kumanda-imparatorlugu` ve `yon-inadi` için İKİ FARKLI pillar'la (biri kumaş/moda ailesinden, biri vücut/günlük-hayat ailesinden) ikişer dry-run — toplam 4 koşu. Kapıyı geçemeyen (SIZINTI, seed fallback, ya da gözle "hook twist'i açıyor ama gövde o açıyı hiç bağlamıyor / konu pillar'dan kaçıp kumaşa/vücuda geri kaçtı") twist **havuzdan silinir** — zorlama yok, gerekçe tek satır yorum | `brain/twists.mjs` | 2.6 |
| 2.6 | Havuzda kalan twist sayısına göre 2.3(a) eşiğini güncelle; silme yapıldıysa gerekçeyi tek satır yorum olarak yaz | `brain/twists.mjs` + `brain/twists.test.mjs` | `npm test` |

**FAZ KAPISI:** `npm test` → fail 0; ayrıca
`node --env-file=.env brain/dene-spec.mjs --brand=kizlarkodu --pillar=beden-tablosu --twist=yikama-cesareti`
→ exit 0 (`source: gemini`, sızıntı yok).
**Geri alma:** `git revert <sha>`; twist'ler ve testleri aynı commit'te.

---

## Faz 3 — Tek gerçek video → onay kutusu

| # | Görev | Dosya (sahiplik) | Doğrulama |
|---|---|---|---|
| 3.1 | `workflow_dispatch` girdisi `twist` (varsayılan boş) ekle | `.github/workflows/daily.yml` (satır 24-41) | `gh workflow view daily.yml` girdide `twist` görünür |
| 3.2 | `BYTEFLOW_TWIST: ${{ inputs.twist }}` — **iki** step env'ine: "Video üret" (satır 181-196) ve "Onay akışı" (satır ~220-242). İkincisi olmazsa "tekrar dene" normal rotasyondan twist seçer (`onay-akisi.mjs:162` `{...process.env}` ile miras alır, ama değişken o step'te tanımlı değildir) | `.github/workflows/daily.yml` | 3.3 |
| 3.3 | ÖN KOŞUL ÖLÇ (koşudan ÖNCE): `curl -fsS -H "x-onay-key: $ONAY_INGEST_KEY" "$ONAY_BASE_URL/api/durum?marka=kizlarkodu"` → `bekleyenVar=false` VE `jq -r '.[-1].date' brands/state/kizlarkodu-history.json` ≠ bugün. Biri doluysa koşu üretimi SESSİZCE atlar (`daily.yml:180`) | — | çıktı `bekleyenVar:false` |
| 3.4 | Tek koşu: `gh workflow run daily.yml -f brand=kizlarkodu -f publish=false -f voice=true -f twist=erkek-dolabi` | — | `gh run watch` → "Video üret" ÇALIŞTI (skipped değil), logda `😏 gaf ekseni: erkek-dolabi` |
| 3.5 | Kalem onaybox'a düştü mü + üretim GERÇEK mi (seed değil) | — | aşağıdaki kapı |
| 3.6 | Karar penceresi: kalem 24 saat içinde onayla/vazgeç ile kapatılır. Onaybox'ın 24 saatlik hatırlatması var (doğrulandı) — yeni kod YOK; ama bekleyen kalem varken günlük üretim durduğu için (`kizlarkodu.json:57`) karar verilmezse **vazgeç** seçilir | — | ertesi gün `bekleyenVar=false` |

**FAZ KAPISI (üç şart birlikte):**
1. `git pull && jq '.[-1] | {date,source,twist,title}' brands/state/kizlarkodu-history.json`
   → `source=="gemini"` **ve** `twist=="erkek-dolabi"` **ve** `date` bugün.
2. `curl -fsS -H "x-onay-key: $ONAY_INGEST_KEY" "$ONAY_BASE_URL/api/durum?marka=kizlarkodu"`
   → `bekleyenVar=true` ve `meta.twist == "erkek-dolabi"` (eski bekleyen kalem de `true` verir).
3. Video gözle izlenir: hook erkeğin davranışı, gövde kumaş mekanizması, b-roll kabul edilebilir.
**Geri alma:** onay konsolunda **vazgeç** → deneme çöpe, geçmişten düşer, red defterine yazılır,
yayın yapılmaz. Workflow değişikliği ayrı commit → `git revert`.

---

## Tuzaklar

- `brain/generate-spec.mjs:231-236` — `kime` YALNIZ hook, `sendTo` ve caption CTA'sında görünebilir;
  node label / step.status / narration'da kişi YASAK (2026-08-03 canlı hata: "arkadaşın" bir maliyet
  kartı olarak ekrana çıktı). 1.6 sızıntı taraması tam olarak bunu ölçüyor.
- `brain/generate-spec.mjs:241` — her `step.status` gerçek bir mekanizma iddiası taşımak ZORUNDA.
  Twist focus'u "erkekler şöyle davranır" gibi bir iddiayı davet ederse model onu status'a yazar ve
  kaynaksız cinsiyet klişesi ekrana çıkar. Kelime yasağı testi bunu görmez — dry-run gözü görür.
- `brands/kizlarkodu.json:66` — `examples.domain` "NOTHING else" HARD RULE. Domain DEĞİŞMİYOR ve
  marka zaten vücut/günlük-hayat pillar'ları üretiyor, o yüzden bu kural reddetmez — sessizce konuyu
  kumaşa/vücuda geri ÇEKER (geçmişte "akrilik", "suni deri" böyle sızmış). Asıl risk twist'in kapısı
  (kumanda, yön) ile o günkü pillar'ın gövdesinin BAĞLANMAMASI. 2.5 bunu iki farklı pillar'la ölçüp
  geçemeyeni siler — "belki tutar" diye havuzda bırakma.
- `brain/produce-spec.mjs:64-70` — Gemini 5 denemede üretemezse KUMAŞ temalı seed döner
  (`source:'seed'`) ve `run-daily.mjs:288` yine de geçmişe twist damgası yazar. `source` kontrol
  edilmeyen her kapı yalan yeşil verir.
- `publish/onay-akisi.mjs:114-116` — onay kalemi `meta`sında `twist`/`pillar` VAR ama `source` YOK.
  Seed kontrolünün tek kaynağı `brands/state/kizlarkodu-history.json` (workflow commit'liyor).
- `.github/workflows/daily.yml:180` — onay kapısı ya da kota tetiklenirse "Video üret" ATLANIR ve
  koşu YEŞİL biter. 3.3 ölçülmeden 3.4 çalıştırılırsa "yaptık" denir, hiçbir şey üretilmemiştir.
- `run-daily.mjs:82` — twist havuzu pillar'a göre FİLTRELENMİYOR. Yeni açılar zamanla rastgele
  pillar'la eşleşecek (ör. `kumanda-imparatorlugu` × `koku-korlugu`). Bu planda çözülmüyor; sınır
  açıları bu riskin en kötü hâlidir, 2.5 onu ölçüyor.
- `brands/kizlarkodu.json:108` (`kapsamSiniri`) — kod bu alanı OKUMUYOR; değiştirmek davranışı
  değiştirmez. Doğrulama olarak kullanma. (Bu planda dokunulmuyor.)

## Kayda geçsin (kod değişikliği yok)
- `footageSet: "fabric"` b-roll'u erkek gaflı videoya tam oturmayabilir. İlk üretimde gözle bakılır;
  otomatik düzeltme (twist'e göre b-roll seçimi) bu planda KAPSAM DIŞI.
- `defaultHashtags` kumaş etiketlerinde kalıyor — konu da kumaş olduğu için beklenen davranış.

## Riskler

| Risk | Olasılık | Etki | Azaltma |
|---|---|---|---|
| Model erkek davranışını mekanizma iddiasına çeviriyor ("erkek beyni") | orta | kaynaksız klişe yayına çıkar | 1.6 sızıntı kapısı + 2.3(c) kalıp testi + dry-run gözü + onay kutusu |
| Sınır açılarında hook↔gövde kopuyor, konu kumaşa/vücuda geri kaçıyor | yüksek | o twist işe yaramaz | 2.5 ölçümü (2 pillar × 2 twist); geçemeyen SİLİNİR (havuzda tutmak sessiz bozulmadır) |
| Ton alaya kayıyor | orta | marka zararı, yorum kavgası | focus metnindeki ⛔ satırı + 2.3(c) + insan onay kapısı |
| 4 açı 22'lik havuzda seyreliyor (~5,5 postta 1) | yüksek | "hiç çıkmıyor" hissi | ölçüm sonrası karar; bu planda YOK |
| Onaydaki kalem karara bağlanmıyor → günlük üretim sessizce duruyor | orta | 3 gün kayıp (@cilt.kodu dersi) | 3.6: 24 saat içinde karar, verilmezse vazgeç |

## Kapsam dışı
- Yeni pillar ailesi, `examples.domain` / `kapsamSiniri` / `subjects.mjs` değişikliği (revizyonla düştü).
- Twist havuzunu pillar'a göre filtrelemek; twist'e göre b-roll/hashtag seçimi.
- Ailenin 8-10 açıya büyütülmesi; performans ölçümü ve `kime` yönünün (erkek mi kız arkadaş mı) A/B'si.
- Otomatik yayın, zamanlanmış koşuya twist zorlama, ikinci video.
- `@cilt.kodu` (`beauty-tr`) tarafında hiçbir değişiklik.
