# ByteFlow Engine — Faz 1: Çekirdek Render Motoru

Elle yazılmış bir `scene-spec.json`'dan, `software_engineer_paris` estetiğinde dikey
(1080×1920) + royalty-free müzikli Instagram Reel mp4'ü uçtan uca üreten motor.
Bu depo **sadece Faz 1**'i kapsar: render + müzik mux. Beyin (Gemini ile otomatik
spec üretimi = **Faz 2**) ve yayınlama (Instagram Graph API + cron = **Faz 3**) daha
sonraki, ayrı planlarda gelecek.

## Kurulum

```bash
npm install
cd render && npm install && npx playwright install chromium && cd ..
```

## Kullanım

```bash
npm run build                    # scene-spec.example.json'ı kullanır
npm run build path/to/spec.json  # özel bir spec
```

`npm run build` şunları yapar:

1. Spec'i `scene-spec.schema.json`'a karşı doğrular (ajv) — geçersizse hatayla durur.
2. Geçerli spec'i `render/scene-spec.json`'a kopyalar (render girdisi).
3. `render/` içinde vite dev server + Playwright (headless chromium) ile Motion
   Canvas sahnesini render eder → `render/output/project.mp4` (sessiz, 1080×1920, h264).
4. `assets/music/` altındaki ilk `.mp3`'ü (adı `_` ile başlamayan) seçer, ffmpeg ile
   videoya fade-in/out'lu şekilde bindirir → `dist/final.mp4` (video + AAC ses).

Diğer scriptler:
- `npm run validate` — sadece şema doğrulama (`scene-spec.example.json`).
- `npm test` — `brain/` ve `publish/` altındaki unit testler.
- `cd render && npm run serve` — dev server'ı manuel açıp tarayıcıda sahneyi izlemek için.

## `scene-spec.json` formatı (özet)

Tam şema: `scene-spec.schema.json`. Örnek: `scene-spec.example.json`.

```jsonc
{
  "title": "How a Load Balancer Works",   // 3-60 karakter
  "topic_source": "hand-authored",         // opsiyonel, bilgi amaçlı
  "caption": "...",                        // IG caption metni (1-2200 karakter)
  "hashtags": ["#systemdesign", "..."],    // 1-30 adet
  "scenes": [                              // 1-3 sahne
    {
      "layout": "nodes-flow",              // şu an tek layout tipi
      "heading": "Request distribution",   // opsiyonel, max 48 karakter
      "nodes": [                           // 2-4 node
        {"id": "client", "icon": "🖥️", "label": "CLIENT"}
      ],
      "steps": [                           // 1-6 adım (paket animasyonu)
        {"from": "client", "to": "lb", "packet": "REQ", "color": "accent", "status": "incoming request"}
      ]
    }
  ]
}
```

`color` alanı `accent` / `good` / `warn` paletinden birini seçer (sabit renk şeması:
BG `#0d1117`, CARD `#161b22`, accent `#58a6ff`, good `#3fb950`, warn `#d29922`).
Marka intro/outro (`BYTEFLOW` / `@byteflow`) şablonun içinde otomatik eklenir; spec'e
elle eklemeye gerek yok.

## Müzik

`assets/music/` royalty-free track'lerin durduğu yer. Repoda gelen
`byteflow-ambient.mp3` **kendi ürettiğimiz** (ffmpeg `sine`+`tremolo`+`lowpass` ile
sentezlenmiş) ambient bir loop — telif/maliyet sıfır. Kendi Pixabay Music
(https://pixabay.com/music/) veya Uppbeat free track'lerinizi serbestçe ekleyip
bunun yerine geçirebilirsiniz (dosya adı `_` ile başlamasın, aksi halde build onu
görmezden gelir — `_` önekli dosyalar test/sentetik tonlar için ayrılmıştır).
Post-process şu an klasördeki ilk uygun `.mp3`'ü kullanır (ileride rotasyon eklenebilir).

## Mimari

- `brain/validate.mjs` — `validateSpec(spec)` (ajv, draft-07 şema).
- `render/` — bağımsız Motion Canvas + Vite projesi; `scene-spec.json`'ı okuyup
  `render-runner.mjs` (Playwright headless) ile sessiz mp4 üretir.
- `publish/post-process.mjs` — `postProcess({videoPath, musicPath, outPath})`,
  ffmpeg ile müzik mux + fade + AAC encode.
- `build.mjs` — yukarıdaki üçünü zincirleyen orkestratör (CLI: `node build.mjs [specPath]`).

## Faz haritası

- **Faz 1 (bu depo):** generic render şablonu + scene-spec sözleşmesi + dikey +
  müzikli uçtan uca video üretimi. ✅ Tamamlandı.
- **Faz 2 (sonra):** Gemini ile otomatik `scene-spec.json` üretimi (konu → spec).
- **Faz 3 (sonra):** Instagram Graph API ile otomatik yayınlama + cron zamanlama.
