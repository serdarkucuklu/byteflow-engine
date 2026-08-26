# Plan: kizlarkodu — "merak açığı" ekseni

**Durum (2026-08-26):** Faz 1 ✅ 9339fcb · Faz 2 ✅ 022e1eb · retention kapısı bekleniyor (3 yayın) · Faz 3-4 ertelendi

**Tarih:** 2026-08-26 · **Boy:** M (tek geliştirici, sıralı) · **Revizyon B** (`karsi-gorus` sonrası)

> **REVİZYON B (2026-08-26, `karsi-gorus` + ana oturum doğrulaması):**
> 1. **Retention ölçüldü** (`insights.ig_reels_avg_watch_time`, ms): kumaş 4814·5102·3935·4810·5327
>    (ort ~4800); vücut/merak 3098·3150·3362 (dudak postu views=8 → gürültü, dışlandı). Veri
>    **"merak kötü tutunuyor" DEMİYOR**: düşük üçlünün üçü de kirli varyant — üşüme videosunun
>    `subject`i "akrilik" ve b-roll'ünün 4/4'ü kumaş makro; saç elektriğinde `subject` "statik
>    elektrik". Bekleyen 11. kalem tam kanıt: pillar `uyku-borcu` ↔ subject "beden tablosu" ↔
>    başlık "İade Penceresi Tuzağı". Okunan şey: **hook↔gövde↔görsel uyumsuz video tutunmuyor.**
> 2. `BYTEFLOW_NOT` ile hızlı Faz 0 denemesi **YAPILMIYOR** — aynı kirli varyantı ölçer, "merak
>    tutmuyor" diye yanlış sonuç verirdi. 3. **Görsel/dağıtım katmanı Faz 1'e girdi** (b-roll +
>    hashtag): nötrlenmeden yapılan ölçüm konuyu değil görselleri ölçer. 4. **Faz 2, 5 twist'ten
>    2'ye indi.** 5. **Her faza yayın sonrası retention kapısı** (≥4000 ms, ilk 3 yayın).
>    6. **Faz 3-4 ERTELENDİ** — Faz 1-2 retention kapısı geçmeden başlanmaz.

## Hedef
Serdar (aynen): *"kizlar.kodu sayfasının reels'leri kızların arayıp da bulamadığı gönderilerle
oluşsun, akıl dolu olsun, kızlar merak edip izlesin hep."*

Çeviri: konu ekseni **aranan ama tatmin edici cevabı bulunamayan soru**; anlatım **tek gerçek
mekanizma**; hook soruyu AÇAR, cevap SONA saklanır. Bugün sayfa kumaşa çakılı (son 11 yayının 8'i
MODA_TR; `usume-farki` pillar'ında bile özne "akrilik").

## Kök neden (analist + `karsi-gorus`, doğrulanmış)
`generate-spec.mjs:191` prompt'un en tepesine `SUBJECT UNIVERSE — HARD RULE: this page is about
${ex.domain} and NOTHING else` yazıyor ve bu satır `:196` TODAY'S PILLAR'dan ÖNCE geliyor.
`kizlarkodu.json:66` `examples.domain` = *"clothing, fabric and shopping decisions…"*.

⚠ **Ama bu kural konuyu ENGELLEMİYOR** — üşüme videosunun BAŞLIĞI "Neden Aynı Odada Sadece Sen
Üşüyorsun?" çıkmış; merak konusu prompt'tan geçmiş. Çektiği yer daha sinsi: `subject` (→ "akrilik"),
`footageSet:"fabric"` (b-roll 4/4 kumaş makro), `defaultHashtags` ve timely pillar'daki *"başlık ve
hook `namedExamples`'tan somut bir ad YAZMAK ZORUNDA"* kuralı (`:197-201`) — `namedExamples` da
tamamen kumaş terimi. Video merak sorusuyla AÇILIP kumaş öznesine/görüntüsüne/etiketine düşüyor.
**Domain düzeltmesi gerekli ama TEK BAŞINA YETMEZ** → Faz 1 dört katmana birden dokunuyor.
**Hiçbir test `kizlarkodu`nun `domain`/`twistSet`ini kilitlemiyor** → sessiz kırılma penceresi.

## Yaklaşım
Sıra: **Faz 1 (konu + özne + görsel + etiket) → Faz 2 (twist) → [KAPI] → Faz 3-4 ertelendi**. Her
faz kapısı üç bölümlü: **DOĞRULANAN (anlık)** · **DOĞRULANAN (gecikmeli, ~3 gün retention)** ·
**UMULAN**. Erişim/takipçi vaadi yazılmaz; tek sonuç metriği `ig_reels_avg_watch_time`.

⚠ **Dürüst ödünleşim (Serdar'a):** 20 sn / 3 adımlı, her adımı mekanizma söyleyen bir diyagramda
"cevabı sona saklamak" tam yapılamaz — adımların KENDİSİ cevabın parçası. Yapılabilen: hook SORUYU
sorar, adımlar yolu kurar, "demek oymuş" son adım + takeaway'e düşer. İkinci gerilim: `hookRule`
60 karakterde **gönderilebilirlik** istiyor, merak açığı **izlenme** istiyor; ikisi aynı satıra
sığmaz — 1.3 hook'u iki vuruşlu yapıyor, baskın olan ölçüm sonrası karardır.

## Ödünleşimler

| Alternatif | Artı | Eksi | Karar |
|---|---|---|---|
| `examples.domain`'i "merak açığı" evrenine genişlet, çiti koru (kardeş sayfa + mekanizma şartı yazılı) | tek dosya, en tepedeki kuralı düzeltir, MODA_TR pillar'ları ve gaf omurgası aynen kalır | çit gevşer, konu dağılabilir | ✅ Faz 1 |
| Domain'e dokunma (yalnız pillar ekle) **ya da** domain'i kumaştan tamamen arındır | ilki küçük diff, ikincisi net eksen | ilkinde yeni pillar da kumaş öznesine çekilir (`usume-farki` → akrilik); ikincisinde MODA_TR'nin 20 pillar'ı + 20 gafı bir gecede domain-dışı olur, sayfanın **ölçülen olarak çalışan** yarısı ölür (kumaş ort ~4800 ms) | ❌ ikisi de |
| Merak eksenini TWIST olarak kur (yeni pillar yok) | mekanizma pillar'dan gelmeye devam eder | twist konuyu belirlemez (yalnız gaf+alıcı); tek başına ekseni çeviremez | ✅ ama Faz 2 olarak, Faz 1'in ÜSTÜNE |
| Google Suggest yerine Ekşi / Google Trends RSS | daha "yerli" | Ekşi 403; Trends RSS magazin başlığı veriyor, soru formu yok (ölçüldü 2026-08-26) | ❌ |
| `twistSet` = yalnız merak gafları | eksen %100 merak | kumaş gafları (20 adet, ölçülmüş) çöpe gider | ❌ — birleşim kümesi |
| 5 merak twist'i yaz | havuz geniş, tekrar seyrek | 3'ü (`google-cevapsiz`, `yillardir-yanlis`, `sormaya-utandigin`) **bilgi durumu iddia ediyor** ("kimse bilmiyor", "yıllardır yanlış biliniyor") — kaynaklanamaz, `test ettik` yasağının kardeşi | ❌ rev B: 2 twist |
| Görsel/hashtag katmanına dokunma, önce konuyu ölç | diff küçük | ölçülen şey konu değil b-roll olur (3 düşük postun üçünde de uyumsuz görsel var) | ❌ |
| Retention kapısını yayın sonrası koy (gecikmeli) | tek gerçek başarı ölçüsü, ikili | 3 yayın ≈ 3 gün gecikme | ✅ — dry-run kapısı anlık, retention kapısı gecikmeli, ikisi birlikte |

## Faz 1 — Dört katman birden: konu + özne + görsel + etiket (dikey dilim)

| # | Görev | Dosya (sahiplik) | Doğrulama |
|---|---|---|---|
| 1.1 | `examples.domain`'i yeniden yaz: "18-35 yaş Türk kadınının gerçekten ARADIĞI ama tatmin edici cevabını bulamadığı gündelik 'bu neden herkesin başına geliyor' soruları — vücut (uyku, koku, ter, saç, tırnak, ısı), alışkanlıklar ve eski usul yöntemler, ev, ve kıyafet/alışveriş kararları — hepsi MEKANİZMA düzeyinde". Çite dokunma: aynı cümlenin sonunda ⛔ satırı = yüz cildi/bakım ürünü (kardeş sayfa @cilt.kodu), ilişki-kişilik psikolojisi, tıbbi tavsiye | `brands/kizlarkodu.json` | 1.8 |
| 1.2 | `namedExamples`'ı dengele: 3-4 kumaş terimi KALSIN (`"polyester"`, `"viskon"`, `"beden tablosu"`), yanına vücut/alışkanlık özneleri gir (`"uyku borcu"`, `"koku körlüğü"`, `"ter kokusu"`, `"statik elektrik"`, `"yastık izi"`, `"saç yağlanması"`). Hepsi 1-3 kelime, ÖZNE biçiminde (bu alan `subject` ve timely başlık kuralını besliyor) | `brands/kizlarkodu.json` | 1.8 |
| 1.3 | `tone.hookRule`: mevcut metni SİLME, sonuna ikinci vuruş ekle — "hook aranan SORUYU açar (izleyicinin gece telefona yazdığı cümle), cevabı VERMEZ. İki vuruş: tanınan davranış + cevabı olmayan soru. Cevap videonun sonunda" | `brands/kizlarkodu.json` | 1.8 |
| 1.4 | ~~`doorRule` + `takeawayRule` ekleri~~ **ERTELENDİ (rev B).** Hook satırına zaten `fluff` + `angle` + `hookRule` + `doorRule` yüklü; beşinci kural kalabalıkta erir. 1.3 tek başına ölçülür, ek kural ölçüm SONRASI değerlendirilir | — | — |
| 1.5 | Sabit örnekleri **BEŞ ayrı konuya dağıt** (rev B): 2 kumaş (`hubSpoke`, `versusRow` — MODA_TR yaşıyor), 2 uyku (`hook`, `narrationSetup`), 2 koku (`captionSetup`, `captionItem`), 2 saç/tırnak (`closing`, `narrationEar`), 3 ev/alışkanlık (`cycle`, `saveCta`, `shareCta`). ⚠ Tek konuya toplamak İKİ hata yapardı: (a) örnek ancak ÇEŞİTLİYKEN biçim öğretir, tek konu yeni bir tekel kurar; (b) o konu (ter kokusu) zaten bir pillar ve `bannedSubjects` cooldown'ıyla çakışır | `brands/kizlarkodu.json` | 1.8 |
| 1.6 | `examples.versusRow`: `"KUMAŞ","FİYAT"` → `"İNANILAN","OLAN"` (versus sahnesi merak konusunda da kurulabilsin) | `brands/kizlarkodu.json` | 1.8 |
| 1.7 | `dene-spec.mjs`'e `--yasak=k1,k2,…` bayrağı: virgüllü kelimeler **yalnız `title`, `hook`, `subject`** alanlarında aranır (gövdede geçmesi serbest — ölçülen şey KONUNUN kaymadığı); eşleşme varsa listeler + exit 1. Mevcut SIZINTI ve `source!=='gemini'` kapıları aynen kalır | `brain/dene-spec.mjs` | 1.8 |
| 1.8 | Niş kilidi testi (gerçek `brands/kizlarkodu.json` ile, `generate-spec.test.mjs:219` desenini kopyala): prompt'ta (a) `SUBJECT UNIVERSE` duruyor, (b) `uyku borcu` **ve** `ter kokusu` geçiyor (domain artık kumaş tekelinde değil), (c) `mechanism` geçiyor (mekanizma şartı düşmedi), (d) kardeş sayfa kelimeleri **hiçbiri** yok: `gözenek, sivilce, serum, retinol, niasinamid, güneş kremi` (`pillars.test.mjs:83` ile birebir aynı liste — daha geniş tarama yanlış kırmızı verir, bkz. Tuzaklar) | `brain/generate-spec.test.mjs` | `node --test brain/generate-spec.test.mjs` |
| 1.9 | **B-ROLL (rev B, kritik):** `FOOTAGE_SETS`'e yeni `gunluk` kümesi — günlük hayat, kumaş makro DEĞİL: yastık/yatak, sabah uyanma, saç tarama, ayna, sabah kahve, terli spor sonrası, çorap/ayak, ev içi, dolap kapağı, el yıkama, gece lambası, pencere buğusu (12-16 sorgu, `FABRIC_FOOTAGE:92` biçimini kopyala). Sonra `kizlarkodu.json` → `"footageSet": "gunluk"` | `fetch/fetch-footage.mjs` · `brands/kizlarkodu.json` | 1.11 |
| 1.10 | **HASHTAG (rev B):** `defaultHashtags`'ten `#giyim #kumaş #gardırop #giyimtüyoları` çıkar → `#merak #nedenoluyor #kadınlar #günlükhayat` + kalan 2 geniş etiket. `examples.nicheTags`/`broadTags` de aynı yöne çekilir | `brands/kizlarkodu.json` | 1.11 |
| 1.11 | Test: `footageSetFor('gunluk')` ≥12 sorgu döndürüyor · hiçbirinde `fabric\|denim\|wool\|cotton\|silk\|garment` geçmiyor · `footageSetFor` bilinmeyen adda hâlâ `tech`e düşüyor (mevcut davranış kilidi) | `fetch/fetch-footage.test.mjs` | `node --test fetch/fetch-footage.test.mjs` |

**FAZ KAPISI — DOĞRULANAN (anlık):** `npm test` → fail 0; ayrıca `Y=polyester,viskon,likra,kumaş,pamuk,beden,dolap` ile iki koşu:
`node --env-file=.env brain/dene-spec.mjs --brand=kizlarkodu --pillar=usume-farki --twist=itiraf --yasak=$Y`
ve aynısı `--pillar=uyku-borcu --twist=beklenti` ile → ikisi de exit 0, `kaynak: gemini`,
`✓ SIZINTI YOK`, `--yasak` kırmızısı yok; `subject` kumaş terimi DEĞİL ("akrilik" hatası) ve
`footage_queries` `gunluk` listesinden geliyor. (Twist'ler bu fazda hâlâ `moda-tr`den — bilerek.)

**FAZ KAPISI — DOĞRULANAN (GECİKMELİ, ~3 gün):** faz commit'inden SONRAKİ ilk 3 yayının
`insights.ig_reels_avg_watch_time` ortalaması **≥ 4000 ms**. (Referans: kumaş ~4800, kirli merak
varyantları 3098-3362; 4000 = kirli varyantın belirgin üstü, kumaşın makul altı.)
```
git pull && node -e "const fs=require('node:fs');const h=JSON.parse(fs.readFileSync('brands/state/kizlarkodu-history.json','utf8')).filter(x=>x.insights?.ig_reels_avg_watch_time).slice(-3);const o=h.reduce((a,x)=>a+Number(x.insights.ig_reels_avg_watch_time),0)/h.length;console.log(h.map(x=>x.date+' '+x.pillar+' '+x.insights.ig_reels_avg_watch_time).join('\n'));console.log('ORT',Math.round(o),o>=4000?'✓ GEÇTİ':'✗ REVERT')"
```
→ `✗ REVERT` çıkarsa faz commit'i **`git revert`** edilir; eşik veriye bakıp sonradan gevşetilmez
(rasyonalizasyon yasağı). 3 kayıt birikene dek kapı ÖLÇÜLMEDİ sayılır, GEÇTİ sayılmaz.

**UMULAN (kanıt yok, gözle):** 2 hook, izleyicinin telefona yazacağı bir soru gibi okunuyor ve
cevabı hook'ta verilmiyor. **Kabul kanıtı:** 2 hook + subject satırı rapora AYNEN yapıştırılır.
**Geri alma:** `git revert <sha>` — tek commit; marka dosyası + b-roll kümesi + 2 test + 1 dev
script. Bekleyen onay kalemindeki videoyu etkilemez (marka dosyası yalnız ÜRETİM anında okunur).

## Faz 2 — Merak gafı twist ailesi (2 twist) + `kizlar-tr` twist kümesi

⛔ **Yazılmayan 3 twist (rev B):** `google-cevapsiz`, `yillardir-yanlis`, `sormaya-utandigin` —
üçü de **bilgi durumu iddia ediyor** ("kimse bilmiyor", "yıllardır yanlış biliniyor"). Bu,
mekanizma iddiası kadar kaynaklanamaz ve `"test ettik" YASAK` kuralının kardeşidir; model onu
`step.status`a yazarsa sayfa doğrulayamayacağı bir şey söyler. Kalan 2 mekanizmayı pillar'dan alır.

| # | Görev | Dosya (sahiplik) | Doğrulama |
|---|---|---|---|
| 2.1 | `MERAK_TR` dizisi (**2** twist, `aile: 'merak'`, `kime` + `focus`): `herkes-yasiyor` (kime: *bunu yaşayan tek kişi olduğunu sanan arkadaşına*) ve `anneannen-hakliymis` (kime: *anneannesinin yöntemine hâlâ gülen arkadaşına*) | `brain/twists.mjs` | 2.3 |
| 2.2 | Her `focus` metnine zorunlu 3 parça: kapı tarifi · `⛔ YASAK: "test ettik/denedik" iddiası, uydurma istatistik, ilişki-kişilik psikolojisi` · `✅böyle / ⛔böyle-değil` örnek çifti. Ayrıca sabit cümle: *"mekanizma bugünkü konudan gelir, twist yeni mekanizma İDDİA ETMEZ"* (kilit metni, test bunu arıyor) | `brain/twists.mjs` | 2.3 |
| 2.3 | `TWIST_SETS['kizlar-tr'] = [...MODA_TR, ...MERAK_TR]` + testler: (a) `kizlar-tr ⊇ moda-tr`, anahtarlar tekil; (b) `aile==='merak'` filtresi **2** anahtar veriyor; (c) ikisinin `kime>10`, `focus>40`, `focus` içinde `YASAK` **ve** "mekanizma bugünkü konudan gelir" var; (d) `focus` metinlerinde `test ettik\|denedik\|kanıtlandı\|kimse bilmiyor` YOK | `brain/twists.mjs` + `brain/twists.test.mjs` | `node --test brain/twists.test.mjs` |
| 2.4 | `"twistSet": "moda-tr"` → `"kizlar-tr"` | `brands/kizlarkodu.json` | 2.5 |
| 2.5 | **Sınır ölçümü — 2/2 kuralı:** her merak twist'i İKİ pillar ailesiyle koşulur (biri `VUCUT_GUNLUK`, biri `MODA_TR`), toplam **4** gerçek dry-run. Geçemeyen (SIZINTI / seed / `--yasak` kırmızısı / gözle "hook soruyu açıyor ama gövde o soruyu hiç cevaplamıyor") **havuzdan SİLİNİR** — tek satır gerekçe yorumu (bkz. `twists.mjs:118-132` deseni). Kalan sayı testlerdeki eşiğe yansıtılır | `brain/twists.mjs` | aşağıdaki kapı |

**FAZ KAPISI — DOĞRULANAN (anlık):** `npm test` → fail 0; ayrıca 2.5'in 4 koşusu exit 0:
```
for t in herkes-yasiyor anneannen-hakliymis; do
  for p in koku-korlugu kurutma-ve-utu; do
    node --env-file=.env brain/dene-spec.mjs --brand=kizlarkodu --pillar=$p --twist=$t || echo "DÜŞTÜ: $t × $p"
  done
done
```
**FAZ KAPISI — DOĞRULANAN (GECİKMELİ):** Faz 1'deki retention komutunun aynısı, bu faz
commit'inden sonraki ilk 3 yayın için → ortalama **≥ 4000 ms**, altındaysa `git revert`.
**UMULAN:** hook↔gövde bağı tutarlı. **Kabul kanıtı:** 3 gerçek hook rapora yapıştırılır; içlerinde
"test ettik" formatı, ilişki psikolojisi, cilt ürünü konusu geçmez.
**Geri alma:** `git revert <sha>`; kısmi = `twistSet`'i `moda-tr`'ye çevir (tek satır).

## Faz 3 — Google Suggest "aranan soru" kolu · **ERTELENDİ**

⛔ **Faz 1-2'nin gecikmeli retention kapısı geçmeden başlanmaz** — tutunma sorunu kaynak
yokluğundan değil uyumsuzluktan geliyor; yeni konu musluğu uyumsuzluğu çoğaltır. Tasarım,
hazır olunduğunda yeniden araştırılmasın diye burada duruyor.

| # | Görev | Dosya (sahiplik) | Doğrulama |
|---|---|---|---|
| 3.1 | `SUGGEST_SETS['merak-tr']` tohumları (`"neden herkes"`, `"neden hep"`, `"neden vücudum"`, `"neden saçlarım"`, `"neden gece"`, `"neden sabah"`, `"niye hep"`) + `fetchSuggest({setName, fetchFn, limit})`. URL: `suggestqueries.google.com/complete/search?client=firefox&hl=tr&gl=tr&ie=utf8&oe=utf8&q=…` (⚠ `oe=utf8` şart, yoksa Latin-1 → bozuk Türkçe). Yanıt `[q,[öneriler],[],{}]` | `fetch/suggest-tr.mjs` (yeni) | 3.3 |
| 3.2 | **BEYAZ LİSTE** (rev B — kara liste değil): öneri, `VUCUT_GUNLUK` pillar anahtar kelimelerinden (uyku, koku, ter, saç, tırnak, üşü-, esne-, yastık, dudak, ev, dolap…) en az birini İÇERMİYORSA düşer. Gerekçe: kara liste sadece bilinen kötüyü eler; model prompt'ta yalnız `[source] title` gördüğü için tıbbi/teşhis sorusu ("neden sürekli kanıyor") sessizce geçer ve sayfa tıbbi tavsiye verir. Ek şart: soru formu (`neden\|niye\|nasıl`), ≤80 karakter, tekilleştirme. Çıktı `{title, summary, link:'', source:'arama-tr-merak'}` | `fetch/suggest-tr.mjs` | 3.3 |
| 3.3 | **Sessiz fallback** (ağ/HTTP/parse hatası → o tohum atlanır, hepsi düşerse `[]`; Actions IP'sinden 403/429 beklenir) + birim testleri (AĞ YOK, sahte `fetchFn`): beyaz liste dışı düşüyor · "neden vücudum kaşınıyor" geçiyor · tıbbi örnek düşüyor · throw/bozuk JSON → `[]` · item biçimi | `fetch/suggest-tr.mjs` · `fetch/suggest-tr.test.mjs` (yeni) | `node --test fetch/suggest-tr.test.mjs` |
| 3.4 | `fetchTrends({..., suggest = null, suggestQuota = 2})` — ilk `suggestQuota` item sonuca GARANTİLİ girer, kalanı eski round-robin. ⚠ Kotasız yazılırsa merak kolu 14 feed yanında limit=15'te **1 slot** alır, faz hiçbir şey yapmamış olur. Kota 4 değil **2** (rev B): kaynak ilham, konu havuzunun yerine geçmez | `fetch/fetch-trends.mjs` | 3.5 |
| 3.5 | 2 test: `suggest` verilmediğinde çıktı ESKİSİYLE birebir aynı (gerileme kilidi) · verildiğinde ilk 2 sonuç `source==='arama-tr-merak'`, `limit` aşılmıyor. Sonra `"suggestSet": "merak-tr"` + `run-daily.mjs:103` marka kapılı çağrı + sayaç log'u | `fetch/fetch-trends.test.mjs` · `brands/kizlarkodu.json` · `run-daily.mjs` | aşağıdaki kapı |

**FAZ KAPISI — DOĞRULANAN (anlık):** `npm test` → fail 0. Canlı duman testi (yerel, ağ gerekir):
`node fetch/suggest-tr.mjs` → beyaz listeden geçmiş **≥10** soru basar. Ağ engellenirse bu adım
"ÖLÇÜLEMEDİ" yazılır — birim testleri kapıyı tek başına tutar.
**DOĞRULANAN (gecikmeli):** Faz 1'deki retention komutu, sonraki 3 yayın → ≥4000 ms.
**Geri alma:** `git revert <sha>`; kısmi = `kizlarkodu.json`'dan `suggestSet` satırını sil.

## Faz 4 — Pillar havuzu · **ERTELENDİ**

Faz 1-2 kapısından SONRA karar verilir. `VUCUT_GUNLUK`'a **mekanizması olan** 4-6 pillar + MODA_TR
payını düşürecek ağırlık. Kapı: `node --test brain/pillars.test.mjs` (tekillik + `:80` kardeş sayfa
yasağı), pillar başına 1 dry-run, aynı retention kapısı. **Neden şimdi değil:** dört katman
düzelmeden eklenen her yeni pillar da kumaş öznesine/görseline çekilir; Faz 1-2 kapıyı geçirdiyse
bu faz HİÇ yapılmayabilir — havuz zaten 22 vücut/günlük konu taşıyor.

## Tuzaklar

- `fetch-footage.mjs:134` — `footageSetFor(bilinmeyen)` **sessizce TECH'e düşer** (throw etmez).
  `footageSet:"gunluk"` marka dosyasına küme eklenmeden yazılırsa sayfa devre kartı b-roll'üyle
  yayına çıkar, hiçbir kapı kırmızı yanmaz. 1.9'un sırası (önce küme, sonra alan) bu yüzden zorunlu.
- `produce-spec.mjs:64-70` — Gemini 5 denemede üretemezse KUMAŞ temalı seed döner (`source:'seed'`);
  `source` kontrol etmeyen her kapı yalan yeşil verir (`dene-spec.mjs` bakıyor).
- **Kelime taraması bağlamı ayırt etmez.** 1.8'deki kardeş-sayfa listesi `pillars.test.mjs:83` ile
  BİREBİR aynı olmalı; `skincare`/`cilt` gibi geniş desen eklenirse domain metnindeki ⛔ satırı
  testi kendi kendine kırar — yasağın TARİFİ yasağın İHLALİ sanılır.
- `dene-spec.mjs --yasak` yalnız `title/hook/subject` tarar; gövdeye genişletilirse `usume-farki`
  videosundaki meşru "kumaş" cümlesi haksız kırmızı verir (hafıza: tek senaryo iki pencere).
- `generate-spec.mjs:423` — adaylar prompt'a **yalnız `[source] title`** basılıyor, `summary` modele
  HİÇ görünmüyor → "bu bir arama sorgusu" bilgisini taşıyan tek yer `source` (3.2 beyaz listesinin
  gerekçesi de bu: tıbbi soru sessizce geçerdi).
- `generate-spec.mjs:197-201` — timely pillar'da başlık ve hook `namedExamples`'tan somut ad yazmak
  ZORUNDA; 1.2 yapılmazsa timely günlerde model yine kumaş adı yazar.
- `fetch-trends.mjs` round-robin: 14 feed × limit 15 → lane başına 1 item; kotasız merak kolu
  görünmez olur (3.4).
- Retention kapısı gecikmeli: 3 kayıt birikmeden komut yine "ORT" basar ama örneklem eksiktir →
  GEÇTİ değil **ÖLÇÜLMEDİ**.
- `kizlarkodu.json:108` `kapsamSiniri` alanını **kod okumuyor** — doğrulama olarak kullanılamaz.
  Twist kümesi adı `kizlar-tr` pillar kümesiyle aynı ama ayrı sözlükte (2.3 yorumuna yaz).

## Riskler

| Risk | Olasılık | Etki | Azaltma |
|---|---|---|---|
| Domain genişleyince konu dağılır, sayfa kimliğini kaybeder | orta | tutarsız akış | domain metni ÇİTLİ (mekanizma şartı + 3 maddelik ⛔ listesi); 1.8 testi çiti kilitler |
| Merak sorusu mekanizmasız çıkar → uydurma cevap | orta | kaynaksız iddia yayına girer | `pillars.mjs:137-139` kuralı korunuyor; twist mekanizma İDDİA ETMİYOR (2.2 kilit cümlesi); onay kutusu |
| Kardeş sayfa sınırı ihlali (saç/vücut → cilt ürünü) | orta | iki sayfa aynı konuyu yer | domain ⛔ satırı + 1.8 + 3.2 beyaz listesi + `pillars.test.mjs:80` |
| 2 merak twist'i 22'lik havuzda seyrelir (~11 postta 1) | yüksek | "eksen değişmedi" hissi | asıl eksen Faz 1'in dört katmanında; twist takviye. Yetmezse çare Faz 4 (pillar ağırlığı), twist cerrahisi değil |
| Retention Faz 1 sonrası yine <4000 ms çıkar | orta | faz revert, 3 gün kayıp | revert ucuz (tek commit, tek marka dosyası); o durumda okunacak şey "merak ekseni tutmuyor" DEĞİL, sıradaki hipotez hook yapısıdır (1.4'ün ertelenen kuralları) |
| Onaydaki kalem karara bağlanmıyor → üretim durur, retention kapısı hiç ölçülemez | orta | faz belirsiz askıda kalır | dry-run'lar üretim hattına dokunmuyor; gecikmeli kapı 3 yayın birikene dek ÖLÇÜLMEDİ |

## Ne YAPILMAYACAK (kapsam dışı)
- İlişki/kişilik psikolojisi pillar'ı veya twist'i — mekanizma yok, uydurma doğurur.
- Sır katmanı (`sir-derinlestir.mjs`, `sir-enjekte.mjs`) — konu seçimini hiç etkilemiyor.
- `@cilt.kodu` / `beauty-tr` tarafı; canlı yayınla test, otomatik yayın, `daily.yml`, ikinci video.
- `kapsamSiniri`, `musicDir`, sahne şablonları, `video.*`. ⚠ `defaultHashtags` + `footageSet` rev B ile kapsam DIŞINDAN İÇİNE alındı (1.9-1.10).
- Twist havuzunu pillar'a göre filtrelemek (`twistsFor(set, pillar)`) — 2 twist için fazla makine.
- Hızlı Faz 0 `BYTEFLOW_NOT` denemesi (rev B'de düştü) ve `tone.doorRule`/`takeawayRule` ekleri (1.4).

## İşletme kuralları
Her faz **ayrı commit**; imza `Serdar Küçüklü <serdarkucuklu@gmail.com>`, Claude/Anthropic atfı YOK. Faz kapısı (anlık VE gecikmeli) geçmeden sonraki faza geçilmez.
