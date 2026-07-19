# ByteFlow Animasyon Dili v2 — "Kademeli Kurulum" Tasarımı

**Tarih:** 2026-07-19
**Proje:** `16-byteflow-engine` (@byteflowlabs)
**Durum:** Onaylı tasarım — implementation planına hazır

## Problem (Serdar geri bildirimi)

Mevcut diyagram animasyonları beğenilmiyor:
- **Çakışma bug'ı:** "bazen yazıların üzerine şekiller geliyor" (paket/şekil label'ın üstünde render oluyor)
- **Ölçek:** şekiller büyük/az; "daha küçük ve daha çok sayıda şekil" isteniyor
- **Anlatım:** "daha complex mimariden daha basit anlatımla" — karmaşık sistemler basit anlatılmalı
- **Timing:** kaybolacak yazı ekranda +0.5s daha kalmalı (okunabilirlik)
- **Genel:** "daha çok uğraşılmalı" — mevcut 12-preset varyasyon sistemi savruk/tutarsız hissi veriyor

## Kök tanı

Mevcut render (`explainer.tsx`): birkaç BÜYÜK kutu (nodes-flow, ~430px) hepsi aynı anda girer →
tüm bağlantılar çizilir → paketler uçar. Üstüne **12 motion preset** (burst/punch/wave/neon/matrix...)
"oynatış çeşidi" katıyor. Bu preset'ler hem "yazı üstüne şekil" çakışmasının hem de genel
beğenmemenin muhtemel kaynağı (bazıları şekilleri savuruyor, tutarsız).

## Karar (kilitli)

| Karar | Seçim |
|---|---|
| Animasyon dili | **Kademeli Kurulum** (progressive build-up) — sistem parça parça, gözün önünde kurulur |
| 12 motion preset | **EMEKLİYE AYRILIR** — tek tutarlı build-up koreografisi; tazelik tema/accent + ince pacing varyasyonundan |
| Şekil ölçeği | Küçülür; node sayısı max **4→6** (daha küçük + daha çok) |
| Yazı timing | Kaybolacak her yazı fade'den önce **+0.5s** ekranda kalır |
| Çakışma bug'ı | Teşhis + fix (z-order/konum denetimi) |
| Kapsam dışı (dokunulmaz) | Kod sahnesi (Faz B), persona (Faz C1), beyin niş/hook/caption (Faz A), publish/insights |

## Tasarım

### 1. Kademeli kurulum koreografisi (çekirdek)

Mevcut "hepsi-girer → hepsi-bağlanır → paketler-uçar" düzeni yerine **parça-parça kurulum**:

1. İlk node küçük belirir (scale/fade-in).
2. Bir sonraki node'a bağlantı çizgisi **uzar/büyür** (connector grow).
3. Sonraki node belirir.
4. O bağlantı üzerinde **küçük bir paket bir kez** akar (o adımın veri akışı; `steps` verisinden).
5. 2-4 tekrarlar → sistem tam kurulana kadar.
6. Kısa **"tüm akış" özeti** (paket baştan sona bir kez koşar) → hold.

Böylece karmaşık mimari "tek seferde bir parça" ile basitleşir; küçük öğeler sırayla belirir =
"daha küçük + daha çok şekil" hissi, kalabalık olmadan.

**Node ↔ step örgüsü:** `steps` verisi zaten `from→to` ikilileri. Build-up, node'ları ilk
görünüş sırasına göre açar (scene.nodes sırası) ve her step'i ilgili bağlantı kurulduğunda/hemen
sonrasında bir kez oynatır. Layout (nodes-flow/vertical-stack/hub-spoke/cycle) konumları korunur;
sadece GİRİŞ sıralı/kademeli olur.

### 2. Ölçek + yoğunluk

- Node kartları küçülür (`spec.ts boxSize` değerleri düşürülür; okunabilir kalır).
- `scene-spec.schema.json` + Gemini `RESPONSE_SCHEMA`: node `maxItems` **4→6**; brain prompt
  "2-3 node" → "2-5 node" (daha çok öğe, hâlâ okunabilir).
- Küçük kutular + kademeli giriş → zengin ama sade.

### 3. Motion tutarlılığı (12 preset → tek build-up)

- `motion.ts` (runtime koreografi hook'ları) + `motion-registry.mjs` (metadata): 12 preset
  yerine **tek `buildup` koreografisi**. `pickMotion(n)` / `resolvePreset` sadeleşir.
- Tazelik: mevcut **tema (6) + accent** rotasyonu + ince pacing varyasyonu korunur; vahşi
  hareket (savurma/patlama) YOK. Determinizm korunur (no Math.random/Date.now render'da).
- `explainer.tsx` build-up'ı tek yol olarak kullanır; preset-dallanması kalkar.

### 4. Timing / okunabilirlik

- Kaybolacak her yazı (heading, per-step status, gerekirse label) fade-out'tan ÖNCE **+0.5s**
  ekranda tutulur. `explainer.tsx`'teki `waitFor`/exit beat'lerine +0.5s eklenir.
- `pacing.ts` governor kademeli-kuruluma göre yeniden kalibre edilir (her adım = node-giriş +
  connector-grow + paket + +0.5s hold sub-beat'leri). Toplam süre **15-20s** bandında kalır
  (governor'ın mevcut felsefesi: sparse→uzun hold, dense→sıkıştır).

### 5. Çakışma bug'ı teşhis + fix

- Kök neden bulunur (muhtemel adaylar: bir motion preset'in paketi label üstüne getirmesi;
  status text y-konumunun kutu/paketle çakışması; glow orb z-order). preset'ler kalkınca büyük
  ihtimalle çözülür; kalan çakışmalar konum/z-order denetimiyle giderilir.
- Kural: paket/glow/connector asla label text'in ÜSTÜNDE render olmaz (z-sıra: glow < connector
  < box < label < paket-yol; paket kutu merkezleri arası uçar, label kutu içinde/altında sabit).

## Risk & Sıra

| Aşama | Risk | Not |
|---|---|---|
| Build-up koreografi | Orta | explainer.tsx scene-loop yeniden yazımı; render doğrulaması şart |
| 12 preset kaldırma | Düşük | Sadeleştirme; motion.ts/registry + pacing sadeleşir |
| Ölçek/schema | Düşük | boxSize + maxItems + prompt |
| Timing + çakışma fix | Düşük | render frame doğrulamasıyla |

**Doğrulama:** her aşama gerçek MC render frame'i/kısa video ile görsel doğrulanır (Faz B'deki
kod-sahne doğrulaması gibi). CI gotcha'ları (xvfb + RENDER_HEADED + process.exit(0) +
dosya-stabilizasyon) DOKUNULMAZ.

## Başarı kriteri

- Diyagram gözün önünde parça parça kurulur; aynı anda ekranda az ama zengin.
- Hiçbir şekil/paket label yazısının üstünde render olmaz.
- Node'lar daha küçük, sayıca daha çok (max 6).
- Kaybolacak yazı +0.5s fazla kalır.
- Toplam süre 15-20s; determinizm + CI-safe korunur.
- Serdar görsel onayı (render frame'leri).

## Açık (bu tasarımın DIŞINDA)

- İçerik konu genişliği (model karşılaştırmaları, RAG/STT/TTS/görsel/video pillar'ları) — AYRI
  iş kolu, ayrı tasarım (Serdar "önce görsel" dedi).
- edge-tts ses (Faz C2/C3) — A/B insights sinyaline ertelendi.
