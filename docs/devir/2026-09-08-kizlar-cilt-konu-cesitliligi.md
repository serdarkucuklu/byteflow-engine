# Devir: kizlar.kodu / cilt.kodu konu çeşitliliği — 2026-09-08

## Hedef
Her Reels farklı, öğretici, az bilinen bir özne. `@kizlar.kodu` giysi/cilt değil (kadın doğası, erkek, ilişki kodları). `@cilt.kodu` kavanoz değil (kadın sağlığı, beden, spor, cilt).

## Şu an ÇALIŞAN
- Katalog kilidi: `brands/catalogs/{kizlarkodu,ciltkodu}.json` (~45 özne, `ipucu` = az bilinen mekanizma).
- `run-daily.mjs` `pickCatalogSubject` → `forcedSubject`; Gemini kaçırırsa `produce-spec` retry (`KİLİT KAÇTI`).
- Soğuma: `SUBJECT_COOLDOWN = Infinity` (tüm geçmiş). Kısa özne (`SPF 50`) artık kaybolmuyor.
- Pillar: `KADIN_DOGA` (kizlar-tr), `SAGLIK_BEDEN` (beauty-tr). `timelyPayi: 0.25` iki markada.
- Domain/hashtag/namedExamples genişledi; kardeş çit duruyor (kizlar’da retinol/serum yok).
- Doğrulama: `cd 16-byteflow-engine && node --test brain/catalog.test.mjs brain/subjects.test.mjs brain/pillars.test.mjs brain/twists.test.mjs brain/generate-spec.test.mjs brain/produce-spec.test.mjs brands/load.test.mjs` → **112 pass / 0 fail**.

## Şu an ÇALIŞMAYAN / yarım
- Canlı Gemini dry-run yok (bu oturumda API koşulmadı).
- B-roll: cilt hâlâ `footageSet: "soft"`, kizlar `gunluk` — spor/sağlık videosunda krem makrosu gelebilir.
- Katalog bitince (~45 unique sonra) serbest üretim; soğuma durur.

## Sıradaki adım (tek ve net)
1. Dry-run (yayın yok): `cd /mnt/d/AI/Playground/16-byteflow-engine && BYTEFLOW_BRAND=kizlarkodu node --env-file=.env brain/dene-spec.mjs` (veya projedeki mevcut dry-run komutu) — kilitlenen `subject` katalogda mı, geçmişle çakışıyor mu bak. Sonra `BYTEFLOW_BRAND=ciltkodu` tekrarla.
2. İstersen spor/sağlık için `footageSet` (beden) ekle; konu işi bitmiş.

## Bilinmesi gerekenler
- “Farklı anlat” yetmez: `namedExamples` mıknatıs (retinol/polyester). Özne **kilitlenmeli**.
- Katalog özneleri ayırt edici kök paylaşırsa soğuma onları aynı sayar (`cümlesi`, `düşüşü`, `adım`).
- `timelyPayi` yoksa %75 timely — cilt ürün karşılaştırmasına kilitlenirdi.
- `BYTEFLOW_KONU="ferritin"` elle kilit. Onay kutusu duruyor.
- Eski plan `kizlarkodu-merak-acigi.md` ilişki psikolojisini yasaklıyordu; 2026-09-08 kararı bunu **davranış+mekanizma** olarak açtı. “erkekler böyledir” hâlâ yasak.

## Dokunulan dosyalar
`brain/{catalog,subjects,pillars,twists,generate-spec,produce-spec}.mjs` + testleri; `brands/{kizlarkodu,ciltkodu,load,seeds/kizlarkodu}.json`; `brands/catalogs/*`; `run-daily.mjs`.

## Açık sorular / kullanıcı kararı bekleyenler
- Sağlık Reels için ayrı b-roll havuzu?
- Katalog tükendiğinde yeni 45’lik dalga (elle) mi, yoksa model serbest mi?
