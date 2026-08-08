# Plan: reels-kalite

**Spec:** yok (bulgu listesi bu planın girdisi — bkz. "Ölçüm dürüstlüğü")
**Tarih:** 2026-08-09
**Boy:** M (6 faz, her faz tek başına yayınlanabilir)

## Hedef
`f284915` (kinetik biçim + retansiyon denetçisi) üstüne, ÖLÇÜLEBİLİR kalite açıklarını kapatmak:
bozuk kapak karesi, sentetik müzik, videoyu tekrarlayan caption, dar b-roll havuzu, marka ayrışması.
Plan bittiğinde iki sayfa aynı hattan çıkan ama birbirine benzemeyen videolar üretiyor olacak.

## Ölçüm dürüstlüğü (bu plan boyunca geçerli)
n=13, izlenme ile hiçbir metrik korele değil (~0), 5 günde 1652 erişim → net ~0 takipçi.
**Bu planda hiçbir madde "şu kadar takipçi getirir" demiyor.** Her fazın kapısı iki bölümdür:
`DOĞRULANAN` (komutla kanıtlanan, ikili) ve `UMULAN` (ölçemediğimiz, kanıtlanmamış beklenti).
Araştırma bulguları (karaoke altyazı, kesme sıklığı, süre) ZAYIF kaynaklı — hipotez olarak,
marka dosyasından ayarlanabilir knob olarak uygulanıyor; sabit karar olarak DEĞİL.

## Yaklaşım
Her fazda mantık YENİ ve SAF bir modüle çıkar (`publish/*.mjs`), `run-daily.mjs`'e tek satırlık
kablolama yapılır. Böylece hem birim testi yazılabilir (ffmpeg enjekte edilen `run` ile taklit
edilir — mevcut desen), hem paralel geliştiricide tek dosya sahipliği korunur. Sıra maliyet/etki:
önce kırık olan (kapak) + en yüksek kaldıraç (müzik), sonra ucuz prompt işi, en sona render işi.

## Ödünleşimler

| Alternatif | Artı | Eksi | Karar |
|---|---|---|---|
| Saf modül + run-daily kablolaması (seçilen) | test edilebilir, paralel çalışılır, geri alması tek satır | dosya sayısı artar | ✅ |
| Doğrudan `run-daily.mjs` içinde düzeltme | daha az dosya | 3 faz aynı dosyaya yazar, test yazılamaz | ❌ paralel çalışma imkânsızlaşır |
| Önce büyük yeniden yazım (biçim motoru v2) | tutarlı sonuç | 13 yayınlık veriyle yön belirsiz, geri dönüş yok | ❌ ölçemediğimiz şeye büyük bahis |
| Kapak zamanını render tarafında hesaplatıp dosyaya yazmak | tam doğru an | Motion Canvas'tan dosya yazmak kırılgan | ❌ beat sonundan geri sayma yeterli |

---

## Faz 1 — Kapak tam cümle + gerçek müzik (uçtan uca dilim)

Bir video üretildiğinde: kapak karesi TAM bir cümle gösteriyor ve arkada marka-özel, dönen,
gerçek bir müzik parçası var. Tek koşuda yayınlanabilir iyileşme.

| # | Görev | Dosya (sahiplik) | Doğrulama |
|---|---|---|---|
| 1.1 | Saf `kapakAni(beats, durSec, {pay=0.3})`: hook beat'inin SONUNDAN geri say (`start+dur-pay`), `[0.8, durSec*0.5]` aralığına kıs, beat yoksa 1.3. CLI: `<video> <spec>` → `dist/kapak.png` çıkarır ve saniyeyi basar | `publish/kapak-ani.mjs` (yeni) | `node publish/kapak-ani.mjs dist/final.mp4 brands/state/ciltkodu-spec.json` |
| 1.2 | Testler: tek kelimelik hook, 6sn'lik uzun beat, beat yok, `dur<pay` (negatife düşmemeli) | `publish/kapak-ani.test.mjs` (yeni) | `node --test publish/kapak-ani.test.mjs` |
| 1.3 | Saf `secMuzik({dosyalar, gecmis, kacGeri=3})`: `_` ile başlayanı atla, son 3 koşuda kullanılanı dışla, hiç uygun yoksa en eskiye dön. `denetleParca(dosya, probe)`: ffprobe bit_rate <96k veya ad `byteflow-ambient` → `sentetik:true`. CLI `--denetle <dizin>` | `publish/muzik-sec.mjs` (yeni) | `node publish/muzik-sec.mjs --denetle assets/music/ciltkodu` |
| 1.4 | Testler: rotasyon 4 parçada 4 tur döner, tek parçada kilitlenmez, sentetik parça uyarı listesine düşer (ffprobe taklit `probe` ile) | `publish/muzik-sec.test.mjs` (yeni) | `node --test publish/muzik-sec.test.mjs` |
| 1.5 | Kablolama: `:266` seçim → `secMuzik(history)`, `:323` `hookPeak` → `kapakAni(spec.beats, durSec)`; geçmişe `music: <dosya adı>` alanı yaz | `run-daily.mjs` | `node --test` yeşil + koşu logunda `✓ kapak:` ve `✓ müzik:` satırları |
| 1.6 | `musicDir` → `assets/music/ciltkodu` | `brands/ciltkodu.json` | `node -e` yok; 1.3 CLI dizini bulmalı |
| 1.7 | `musicDir` → `assets/music/kizlarkodu` | `brands/kizlarkodu.json` | aynı |
| 1.8 | Kaynak/lisans notu + "sentetik drone kullanma" kuralı | `assets/music/README.md` | dosya var |
| 1.9 | **SERDAR (kod değil):** her iki dizine ≥4 telifsiz parça (Uppbeat/Pixabay), markalar farklı tür — cilt: yumuşak/lo-fi, kızlar: ritmik/pop | `assets/music/*/` | 1.3 CLI → `0 sentetik` |

**FAZ KAPISI:** `node --test brain/*.test.mjs publish/*.test.mjs` → ≥227 yeşil **VE**
`node publish/muzik-sec.mjs --denetle assets/music/ciltkodu` → `≥4 uygun · 0 sentetik` **VE**
tam koşu sonrası `dist/kapak.png` gözle okunduğunda cümle YARIM DEĞİL.
**DOĞRULANAN:** kapak tam cümle; iki markanın müziği farklı ve arka arkaya tekrar etmiyor.
**UMULAN (ölçemiyoruz):** ızgarada tıklanma ve ilk 2 saniyede kalma artışı.
**Geri alma:** `git revert`; `musicDir`'ları `assets/music`'e geri al (boş dizin fallback'i zaten var).

---

## Faz 2 — Caption videoyu tekrar etmesin

| # | Görev | Dosya (sahiplik) | Doğrulama |
|---|---|---|---|
| 2.1 | Caption prompt'unu değiştir: numaralı "tam ders" listesi YOK. Yeni yapı: (1) hook'u yankılayan tek satır, (2) videoda OLMAYAN bir ek bilgi/istisna, (3) kaydet CTA, (4) `sendTo` kişisini adıyla anan gönder CTA, (5) `soru`, (6) byline, (7) tagline | `brain/generate-spec.mjs` | `node --test brain/generate-spec.test.mjs` |
| 2.2 | `formatCaption` numaralı-madde desenine BAĞIMLI olmasın: CTA/imza/tagline/cümle-sonu kurallarıyla da satırlasın | `brain/sanitize.mjs` | `node --test brain/sanitize.test.mjs` |
| 2.3 | `normalizeHashtags` yeni caption yapısında etiketleri hâlâ tek satıra topluyor mu — regresyon testi ekle | `brain/repair.mjs` | `node --test brain/repair.test.mjs` |
| 2.4 | Yapı testi: numaralı liste YOK, tagline SON satır, ≤2200 karakter, iki CTA ayrı satırda (fixture caption üzerinden) | `brain/caption-yapisi.test.mjs` (yeni) | `node --test brain/caption-yapisi.test.mjs` |

**FAZ KAPISI:** `node --test brain/*.test.mjs` → yeşil **VE** bir sonraki gerçek koşunun
spec'inde `caption` içinde `/^\d+\.\s/m` eşleşmesi YOK, son satır tam olarak `persona.tagline`.
**DOĞRULANAN:** caption artık videonun cevabını vermiyor, yapı testle kilitli.
**UMULAN:** okuyanın videoya/profile geçme sebebi doğması — atıf yapılamaz.
**Geri alma:** `git revert` (prompt + regex tek commit'te tutulsun; ayrılırsa sanitize eski
caption'ları bozar).

---

## Faz 3 — Aktif kelime vurgusu (karaoke) + anahtar kelime rengi

| # | Görev | Dosya (sahiplik) | Doğrulama |
|---|---|---|---|
| 3.1 | `renderKinetik`: giren kelime ~0.18sn ACCENT + `scale 1.06`, sonra `COLORS.text`'e döner; `beat.vurgu` ile eşleşen kelime kalıcı ACCENT kalır | `render/src/scenes/explainer.tsx` | yerel render + 3.4 kapısı |
| 3.2 | Şemaya opsiyonel `beats[].vurgu` (string, tek kelime) ekle; eski spec'ler geçerli kalsın | `brain/validate.mjs` | `node --test brain/validate.test.mjs` |
| 3.3 | Prompt: her anlatım cümlesi için cümlede GEÇEN tek bir vurgu kelimesi iste (uydurma kelime yasak) | `brain/generate-spec.mjs` | `node --test brain/generate-spec.test.mjs` |

**FAZ KAPISI:** yerel tam koşu sonrası `node publish/retansiyon-denetci.mjs dist/final.mp4` →
`gecti: true` ve olay/sn ≥ 8,5 (mevcut taban), canlı kare oranı düşmemiş.
**DOĞRULANAN:** vurgu eklemek hareketi azaltmadı (denetçi ölçtü), vurgu kapak karesinde görünüyor.
**UMULAN:** okunabilirlik/tutma artışı — kaynaklar zayıf, ölçemiyoruz.
**Geri alma:** `git revert`; `beats[].vurgu` opsiyonel olduğu için eski render dosyası tek başına
geri alınabilir.

---

## Faz 4 — B-roll: insan engelini daralt, tekrarı kes

| # | Görev | Dosya (sahiplik) | Doğrulama |
|---|---|---|---|
| 4.1 | `PEOPLE` regex'inden `hands?`, `typing`, `working`, `sitting`, `thinking`, `smiling` çıkar; `face`, `portrait`, `person`, `crowd`, `model` kalsın | `fetch/fetch-footage.mjs` | `node --test fetch/fetch-footage.test.mjs` |
| 4.2 | `SOFT_FOOTAGE`/`FABRIC_FOOTAGE`'e el+ürün etkileşimli 4'er sorgu ekle (ör. `hand applying cream macro`, `hand folding shirt close up`) — YÜZ yok | `fetch/fetch-footage.mjs` (4.1 ile aynı sahip, sıralı) | aynı test |
| 4.3 | `fetchFootage`'a `haric: string[]` parametresi: son 3 koşunun `provider:query` çiftleri aday havuzundan düşülsün | `fetch/fetch-footage.mjs` | aynı test (yeni vaka) |
| 4.4 | `haric`'i geçmişten üret ve `fetchFootage`'a geçir | `run-daily.mjs` | koşu logu: seçilen sorgular önceki koşudan farklı |

**FAZ KAPISI:** `node --test fetch/*.test.mjs` → yeşil **VE** ardışık iki gerçek koşudan sonra
`brands/state/ciltkodu-history.json` son iki kaydının `footage` dizilerinin kesişimi BOŞ.
**DOĞRULANAN:** aynı klip iki gün üst üste kullanılmıyor; beyaz liste insanlı ürün çekimlerini
artık kendi kendine engellemiyor.
**UMULAN:** güzellik nişinde daha "gerçek" görünen b-roll — algoritmik etkisi ölçülemez.
**Geri alma:** `git revert`; regex tek satır olduğu için kısmi geri alma da mümkün.

---

## Faz 5 — Marka ayrışması + süre knob'u

| # | Görev | Dosya (sahiplik) | Doğrulama |
|---|---|---|---|
| 5.1 | `render/src/scenes/explainer.tsx:140` `const hedefSure = 20` sabitini `spec.video?.targetSec ?? 20` yap; `tipografi` (fontFamily, punto çarpanı, letterSpacing) spec'ten okunsun | `render/src/scenes/explainer.tsx` | yerel render iki markada da düşmeden biter |
| 5.2 | `brand.video` + `brand.tipografi`'yi spec'e taşı (render bunları görebilsin) | `run-daily.mjs` | üretilen `render/scene-spec.json` içinde `video` ve `tipografi` alanları var |
| 5.3 | `tipografi` bloğu + `video.targetSec: 20` (yumuşak, sıkı harf aralığı) | `brands/ciltkodu.json` | 5.1 kapısı |
| 5.4 | `tipografi` bloğu + `video.targetSec: 30` (geniş, farklı ağırlık) + `motionSet` farkı — **süre knob'u burada sınanıyor, sabit karar değil** | `brands/kizlarkodu.json` | 5.1 kapısı |

**FAZ KAPISI:** iki markada tam koşu → `dist/kapak.png` dosyaları yan yana konduğunda tipografi
ve renk olarak ayırt edilebiliyor **VE** `ffprobe` süreleri 20±2sn / 30±3sn.
**DOĞRULANAN:** süre artık marka dosyasından ayarlanan bir knob; iki sayfa görsel olarak ayrı.
**UMULAN:** hangi sürenin daha iyi olduğu — n yetersiz, bu plan bu soruyu CEVAPLAMIYOR, sadece
sonradan cevaplanabilir hâle getiriyor (`history.durSec` zaten kaydediliyor).
**Geri alma:** `brands/*.json`'dan `tipografi`/`video.targetSec` alanlarını sil → varsayılana döner
(kod tarafında `??` fallback var, revert gerekmez).

---

## Faz 6 — Yüzey genişletme + özgünlük denetimi

| # | Görev | Dosya (sahiplik) | Doğrulama |
|---|---|---|---|
| 6.1 | **SERDAR:** `THREADS_USER_ID` / `THREADS_TOKEN` → `.env` + GitHub Secrets (kod hazır, `publish-latest.mjs:76`) | `.env` / repo secrets | yayın logunda `✓ THREADS —` |
| 6.2 | `ozgunlukRaporu(history, {sonN=10})`: müzik, footage sorgusu, tipografi, süre, hook kalıbı tekrar oranlarını basar; %60 üstü tekrar → uyarı | `publish/ozgunluk-raporu.mjs` (yeni) | `node publish/ozgunluk-raporu.mjs brands/state/ciltkodu-history.json` |
| 6.3 | Testler: tamamen aynı 10 kayıt → %100 tekrar uyarısı; çeşitli 10 kayıt → uyarı yok | `publish/ozgunluk-raporu.test.mjs` (yeni) | `node --test publish/ozgunluk-raporu.test.mjs` |

**FAZ KAPISI:** `node publish/ozgunluk-raporu.mjs brands/state/ciltkodu-history.json` → müzik ve
footage tekrar oranı <%60, çıkış kodu 0.
**DOĞRULANAN:** hattın ürettiği çeşitlilik artık ölçülüyor ve regresyonu görünür.
**UMULAN:** Meta'nın "özgün olmayan içerik" değerlendirmesindeki konumumuz — bu mekanizma
DIŞARIDAN ÖLÇÜLEMEZ; rapor yalnızca kendi tekrarımızı ölçer, platformun kararını değil.
**Geri alma:** `git revert` (rapor okuma-yazma yapmıyor, hattı kırmaz).

---

## Tuzaklar

- `render/src/scenes/explainer.tsx:225-228` — kelime girişi `perKelime*1.6` animasyon + `perKelime*0.6`
  bekleme; yani cümlenin TAMAMI ekrana `n*perKelime*2.2` sonra oturuyor, `girisPenceresi`'nden UZUN
  olabilir. Bu yüzden kapak zamanı baştan ileri sayarak DEĞİL, beat sonundan geri sayarak bulunmalı
  (Faz 1.1). Render matematiğini `publish/` tarafında kopyalama — iki yerde bozulur.
- `run-daily.mjs:323` — mevcut `Math.min(1.1, dur*0.5)` tam da yarım cümle anına denk geliyor;
  ölçülen kanıt: kapak "Yumuşatıcı yazlık giysini tek" diye kesiliyor.
- `render/src/scenes/explainer.tsx:246` — beat sonunda blok 0.22sn'de sönüyor; kapak payı 0.3'ten
  KÜÇÜK seçilirse sönmeye başlamış kareyi yakalarsın.
- `brain/sanitize.mjs:51` — satırlama deseni `\d+\.` numaralı maddeye bağlı. Faz 2 numaralı listeyi
  kaldırınca bu desen HİÇBİR ŞEY bölmez ve caption tek paragraf duvarı olur. 2.1 ve 2.2 aynı
  commit'te gitmeli.
- `render/src/scenes/explainer.tsx:202` — JSX'e dizi çocuk vermek bu depoda sahneyi düşürüyor;
  Faz 3'te vurgu eklerken çocuklar TEK TEK eklenmeye devam etmeli.
- `render/src/scenes/explainer.tsx:148-152` — okunabilirlik yastığında DÜZ RENK dolgu kullanma:
  denendi, "kart" görüntüsü geri geldi ve canlı kare oranı %37→%21 düştü.
- Yerelde Inter YOK (CI'da var). Faz 3 ve 5'te yerel kapak PNG'sine bakarken FONT hakkında karar
  verme — yalnız hareket, renk ve kırpma değerlendirilir. Tipografi kararı ancak Actions çıktısı
  ya da yerel Inter kurulumundan sonra doğrulanır.
- Testler ffmpeg'i enjekte edilen `run`/`probe` ile taklit ediyor; yeni testler GERÇEK ffmpeg
  çağırmamalı (CI'da ~/bin/ffmpeg yok sayılmalı).
- Onay kuyruğunda bekleyen kalem varken yeni video ÜRETİLMİYOR. Faz kapıları "tam koşu" istiyorsa
  önce kuyruğu boşalt; aksi halde kapı sessizce çalışmaz.
- `brands/*.json` `format` alanı kaldırılırsa eski diyagram yoluna dönülür — Faz 3/5 render
  değişiklikleri bu yolu BOZMAMALI (kinetik dışı dal aynen kalsın).

## Riskler

| Risk | Olasılık | Etki | Azaltma |
|---|---|---|---|
| Serdar müzik parçalarını koymadan Faz 1 kapısı geçilemez | Orta | Faz 1 bloke | 1.9 ilk gün istenir; fallback `assets/music` kökü hattı ayakta tutar |
| Caption değişimi sanitize/repair regexlerini sessizce bozar | Yüksek | Bozuk yayın | 2.1-2.3 tek commit + 2.4 yapı testi |
| Vurgu animasyonu render süresini uzatır / sahneyi düşürür | Orta | Yerel 3-5dk döngü uzar | tek beat'lik fixture ile önce dene, sonra tam koşu |
| İnsan engeli gevşeyince kadraja yüz girer (faceless bozulur) | Orta | Marka kimliği | `face/portrait/person/crowd` engeli KALIYOR; ilk 3 koşuda kapak PNG'si gözle denetlenir |
| Meta özgünlük mekanizması varsayımı yanlış çıkar | Orta | Faz 6 boşa emek | Faz 6 yalnız KENDİ tekrarımızı ölçüyor; platform iddiası kurmuyor |

## Kapsam dışı
- Yüz/insan görünen içerik biçimine geçiş (yüzsüz tavan iddiası doğrulanamadı).
- Reklam, satın alınmış erişim, takipçi hedefi ya da herhangi bir büyüme taahhüdü.
- Yeni platform (TikTok/YouTube Shorts) — Threads dışında yüzey açılmıyor.
- Skor tablosu/atıf modeli yeniden yazımı — n=13'te anlamlı model kurulamaz.
- Seslendirme motoru/ses değişimi, onay akışı ve `38-onaybox` tarafı.

---
<!--
  KABUL ÖLÇÜTÜ:
  [x] Her fazın çalıştırılabilir doğrulama komutu var
  [x] Faz 1 uçtan uca dikey dilim (üretim → kapak → müzik → yayınlanabilir video)
  [x] Her görev 2-15 dakikalık
  [x] Her görevin dosya sahipliği net (aynı dosyaya iki görev varsa aynı faz içinde sıralı)
  [x] 4 alternatif değerlendirildi
  [x] Her faz için geri alma yolu yazılı
  [x] Plan ≤200 satır
  [ ] karsi-gorus incelemesinden geçti
-->

---

# ⚠ REVİZYON (2026-08-09) — ONAYLANAN SÜRÜM BU

Yukarıdaki 6 fazlık plan `karsi-gorus` incelemesinden sonra kesildi. İki maddesi
**olgusal olarak yanlış zemindeydi** ve kodla doğrulandı:

1. **"Müzik fallback'i var" YANLIŞ.** `run-daily.mjs:267` → uygun `.mp3` yoksa
   `process.exit(1)`. `assets/music` köküne dönen hiçbir kod yolu yok. Marka başına
   dizin ayırıp dizin boş kalırsa **iki sayfa da yayın yapamaz**.
2. **`hedefSure` ÖLÜ KNOB.** `explainer.tsx:140-141,184-190` — `hedefSure`/`esitSure`/
   `toplamSure` yalnız `beats` boşken çalışıyor. Seslendirme her koşuda üretildiği için
   süreyi **anlatım uzunluğu** belirliyor. Süre zaten `brands/*.json → video.seconds`
   üzerinden prompt'a bağlı. Eski Faz 5.1 hiçbir şey yapmazdı, kapısı garantili kırmızıydı.

## Onaylanan fazlar

**Faz 1 — Kapak + müzik.** Kapak matematiği `publish/` tarafında KOPYALANMAZ; kaynakta
düzeltilir ve tek modülden paylaşılır (`render/src/lib/kinetik-zaman.mjs`): kelime girişi
beat'in ilk yarısında biter, kapak = giriş bitişi + pay. Müzik: rotasyon + ZİNCİR fallback
(marka dizini → `assets/music` kökü → uyar, asla `exit` etme). Serdar görevi marka başına
**2** parça. "Sentetik tespiti" bitrate ile YAPILMAZ (320 kbps drone yeşil yanar, düşük
bitrate'li gerçek parça kırmızı) — mevcut `byteflow-ambient.mp3` adı kara listede.

**Faz 2 — B-roll tekrarı + insan engeli.** `PEOPLE` regex'inden `hands/typing/working/
sitting` çıkar, `face/portrait/crowd` KALIR. Son 3 koşunun klipleri dışlanır.
Kapı gerçekten kırmızı yanabilir: ardışık iki koşunun `footage` kesişimi boş olmalı.

**Faz 3 — Profil dönüşümü + Threads.** Threads token (kod hazır, sır eksik) + profil
paketi (bio, arama odaklı isim, sabit 3 post). Bakım maliyeti sıfır.

**Faz 4 — Marka ayrışması + aktif kelime vurgusu.** İki sayfa farklı tipografi + farklı
müzik dizini. Karaoke vurgusu üç tuzak kapatılarak: accent süresi `perKelime`'ye bağlı,
`vurgu` kelimesi `beat.text` içinde geçmeli (yoksa sessiz başarısızlık), kapı gerçek
kırmızı yanabilir.

## Atılanlar

| Atılan | Sebep |
|---|---|
| `hedefSure` knob'u (Faz 5.1) | Ölü kod; süreyi beats belirliyor |
| Caption yön değişikliği (Faz 2) | Sıfır kanıtla bilinçli kararı tersine çevirmek. Yerine yalnız `caption_lines: string[]` → `formatCaption` regex arkeolojisi silinir, bakım AZALIR |
| Özgünlük raporu (Faz 6.2) | %60 eşiği keyfi, uyarınca ne yapılacağı yazılı değil |
| Marka başına 8 parça | Serdar'ın 45 dk'sı, ölçülemez etki |

## Ölçüm dürüstlüğü (değişmedi)

n=13'te izlenme ile hiçbir metrik korele değil. Bu plan **hiçbir fazda** takipçi/erişim
vaadi vermez. Katman itirazı kayda geçsin: 40 profil ziyareti → ~0 takipçi ve erişimin
%98 çökmesi, video estetiğinin bağlayıcı kısıt OLMADIĞINI gösteriyor olabilir. Faz 3 tam
bu yüzden var; Faz 1/2/4 ölçülemeyen bir eksene yatırımdır ve bu bilinerek onaylandı.
