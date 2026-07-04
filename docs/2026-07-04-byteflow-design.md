# ByteFlow — Otomatik Animasyonlu Teknik İçerik Motoru

**Tarih:** 2026-07-04
**Durum:** Tasarım onaylandı, implementasyon planı bekliyor
**Marka:** ByteFlow (IG: @byteflow / @byte.flow) — global, İngilizce içerik

## Amaç
`software_engineer_paris` tarzı, kod-tabanlı animasyonlu teknik/AI açıklayıcı videoları
**tam otomatik** üretip Instagram Reels olarak yayınlayan, **sıfır maliyetli** bir motor.
İçerik dili İngilizce, konular güncel AI/ML/LLM ve sistem tasarımı trendlerinden esinlenir.

## Hedef Kitle & Ton
- Global yazılımcılar, ML mühendisleri, tech-meraklıları.
- Ton: temiz, mono/flat estetik, "dev Instagram" — pilot `motion-canvas_request.mp4` referans.
- Seslendirme YOK; sadece royalty-free müzik. Metin animasyonun içinde (POC'taki gibi).

## Temel Prensip: Beyin ↔ El Ayrımı
İki katman birbirini tanımaz; aralarındaki tek sözleşme `scene-spec.json`.
İçerik üretimi bozulsa şablon aynı kalır; şablon değişse beyin aynı kalır.

```
[fetch-trends] → [Gemini: seç+spec üret] → scene-spec.json → [Motion Canvas render] → sessiz mp4
    RSS                JSON schema             (SÖZLEŞME)                                    ↓
[Meta Graph API post] ← [dikey 1080×1920 + brand kartı + müzik] ← ffmpeg ←─────────────────┘
```

## Boru Hattı — 6 Bağımsız Aşama

| # | Aşama | Girdi → Çıktı | Teknoloji | Bağımlılık |
|---|-------|---------------|-----------|-----------|
| 1 | fetch-trends | RSS feed'ler → `candidates.json` (başlık+özet+link) | Node + `rss-parser` | keyless |
| 2 | generate-spec | candidates → Gemini → `scene-spec.json` | Gemini 2.5-flash | GEMINI_API_KEY |
| 3 | validate | spec → schema kontrolü; fail → seed backlog | `ajv` | seed-backlog.json |
| 4 | render | spec → Motion Canvas generic şablon → sessiz mp4 | Motion Canvas + FFmpeg exporter + Playwright | vite@4 |
| 5 | post-process | mp4 → dikey 1080×1920 + intro/outro brand + müzik | ffmpeg | assets/music |
| 6 | publish | final mp4 → Reels + caption + hashtag | Meta Graph API v21 | IG token |

## `scene-spec.json` Sözleşmesi (taslak)
```jsonc
{
  "title": "How a Load Balancer Works",
  "topic_source": "https://news.ycombinator.com/...",
  "scenes": [
    {
      "layout": "nodes-flow",              // generic şablonun tanıdığı düzenler
      "nodes": [{"id":"client","icon":"🖥️","label":"CLIENT"}, ...],
      "steps": [
        {"from":"client","to":"lb","packet":"REQ","color":"accent","status":"→ incoming request"},
        ...
      ]
    }
    // 1-3 sahne; sahneler animasyonlu geçişle birleşir (değişken uzunluk)
  ],
  "caption": "...", "hashtags": ["#systemdesign", ...]
}
```
Şablon `layout` tiplerini bilir (`nodes-flow`, `stack-list`, `compare-2col` ...); beyin bunlardan seçer.

## Kilit Tasarım Kararları
1. **Veri-güdümlü tek generic sahne** — estetik sabit, içerik değişken. Uzunluk 1-3 sahne.
2. **Güvenilirlik tabanı** — RSS/Gemini patlarsa 40+ konuluk seed backlog devreye girer; cron asla boş dönmez.
3. **Kalite kapısı** — Gemini çıktısı JSON schema + kelime/uzunluk limitleri + yasak-kelime filtresi; geçmezse yedek. İlk 1-2 hafta yarı-gözlemli, güven artınca tam otonom.
4. **Müzik** — Pixabay Music (royalty-free, atıfsız, ticari serbest); repoda 8-10 track, rotasyon.
5. **Cadence** — GitHub Actions cron; başlangıç günaşırı (2 günde 1), tek satır cron ile günlüğe çekilebilir.

## Maliyet: $0
RSS keyless · Gemini free tier (~1500/gün, biz 1/gün) · Motion Canvas/ffmpeg açık kaynak ·
Pixabay bedava · Graph API bedava · GitHub Actions (public sınırsız / private 2000dk, biz ~75dk/ay) ·
IG hesap bedava. Domain gerekmiyor.

## Repo Yerleşimi (`16-byteflow-engine/`)
```
fetch/            aşama 1
brain/            aşama 2-3 (gemini client + schema + seed-backlog.json)
render/           aşama 4 (motion-canvas, generic template + render-runner playwright)
publish/          aşama 5-6 (ffmpeg post-process + graph api client)
assets/music/     royalty-free tracklar
assets/brand/     intro/outro kartları, logo
scene-spec.schema.json     SÖZLEŞME
.github/workflows/daily.yml  cron
.env.example      GEMINI_API_KEY, IG_USER_ID, IG_ACCESS_TOKEN, FB_PAGE_ID
docs/
```

## Fazlı Kurulum
- **Faz 0 — Hesaplar (kullanıcı elle, adım adım yönlendirilir):** IG Business/Creator + FB Sayfa
  bağlama, Meta App + uzun-ömürlü token, Google AI Studio Gemini key. Hepsi ücretsiz.
- **Faz 1 — Çekirdek:** generic Motion Canvas şablonu + `scene-spec` sözleşmesi + elle 1 spec'ten
  uçtan uca 1 dikey+müzikli video. Kaliteyi kilitle (henüz otomasyon yok).
- **Faz 2 — Beyin:** fetch-trends + Gemini spec üretimi + schema/yedek + kalite kapısı.
- **Faz 3 — Yayın:** ffmpeg post-process + Graph API post + GitHub Actions cron → tam otonom.

## Riskler & Önlemler
- **CI'da headless render** en kırılgan nokta → Playwright ile dev server sürülür (POC'ta çalıştı);
  CI'da `xvfb`/headless Chromium gerekebilir, Faz 3'te doğrulanır.
- **Gemini kalite tutarsızlığı** → schema + filtre + seed yedek.
- **IG token süresi** (60 gün) → yenileme adımı cron'a eklenir veya uyarı.
- **Graph API Reels yayın kısıtları** → video spec (süre/oran/codec) IG gereksinimlerine sabitlenir.

## Kapsam Dışı (YAGNI)
Seslendirme/TTS, altyazı motoru, çoklu platform (TikTok/YT), web dashboard, domain/site.
Sonra ayrı proje olarak eklenebilir.
