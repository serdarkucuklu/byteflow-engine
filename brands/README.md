# Markalar — aynı motor, farklı sayfalar

Motor tek bir Instagram sayfasına bağlı değil. Kimlik, ton, konu havuzu, kaynaklar, sesler ve
durum dosyaları **marka dosyasından** gelir. Yeni sayfa açmak kod çatallamayı değil, bir JSON
eklemeyi gerektirir.

## Yeni marka eklemek

1. **`brands/<slug>.json`** oluştur (`byteflow.json`'ı örnek al):

```jsonc
{
  "slug": "cutfx",
  "handle": "@cutfxlab",
  "displayName": "CutFX Lab",
  "persona": {
    "name": "Mia",                       // caption'daki "Written by ..." satırı
    "audience": "an Instagram page about VIDEO EDITING with AI",
    "voice": "a practical editor's voice: what saves hours, what looks cheap",
    "signoff": "editing, not magic",
    "tagline": "Follow @cutfxlab for editing, not magic."
  },
  "themes": ["#ff7a59", "#7aa2ff"],      // video başına dönen aksan renkleri
  "narrationVoices": ["Aoede", "Puck"],  // Gemini TTS sesleri
  "pillarSet": "ai-engineering",         // brain/pillars.mjs → PILLAR_SETS
  "feedSet": "ai-news",                  // fetch/fetch-trends.mjs → FEED_SETS
  "seedBacklog": "brain/seed-backlog.json",
  "musicDir": "assets/music",
  "publish": {                            // SIR DEĞİL, secret ADLARI
    "instagram": {"userId": "CUTFX_IG_USER_ID", "token": "CUTFX_IG_TOKEN"},
    "facebook": {"pageId": "CUTFX_FB_PAGE_ID"}
  },
  "state": {
    "history": "brands/state/cutfx-history.json",
    "spec": "brands/state/cutfx-spec.json"
  }
}
```

2. **Konu havuzu** başka bir niş ise `brain/pillars.mjs` içine yeni bir `PILLAR_SETS` girdisi,
   kaynaklar farklıysa `fetch/fetch-trends.mjs` içine yeni bir `FEED_SETS` girdisi ekle.
   Aynı nişte ikinci bir sayfa açıyorsan mevcut kümeleri kullanabilirsin.

3. **Secret'ları** GitHub'a ekle (`gh secret set CUTFX_IG_USER_ID` …) ve
   `.github/workflows/daily.yml` içindeki **matrix listesine slug'ı** + yayın adımına
   secret'ları ekle.

4. Test: `BYTEFLOW_BRAND=cutfx npm run daily` (yayınlamaz, sadece üretir) ya da
   Actions'tan `workflow_dispatch` → `brand: cutfx`, `publish: false`.

## Neden secret ADI, sır değil?

Marka dosyaları repoda duruyor. İçinde token olsaydı ilk push'ta sızardı. Dosya yalnızca
"benim token'ım şu isimli env değişkeninde" der; değeri GitHub Secrets / `.env` verir.

## Durum dosyaları

Her markanın kendi `history` dosyası var: yayın geçmişi, insight'lar ve skor tablosu marka
bazında birikir — bir sayfanın performansı diğerinin konu seçimini etkilemez.
