# Profil dönüşüm paketi + Threads — Serdar'ın yapacakları

**Faz 3 / `docs/plan/reels-kalite.md`.** Bu fazın çıktısı kod değil: metinler hazır,
uygulaması Instagram uygulamasından ~15 dakika. API ile yapılamıyor (Graph API bio/ad
alanını bu hesap türlerinde değiştirmiyor).

## Neden bu faz var

Ölçüm (son 5 gün, `brands/state/*-hesap.json`):

```
1652 erişim → 40 profil ziyareti (%2,4) → net ~0 takipçi
```

Huninin **iki halkası da** zayıf. Video tarafını Faz 1/2/4 ele alıyor. Ama profil hiç
kurulmadı: ziyaret eden 40 kişi "bu sayfa ne yapar, neden takip edeyim" sorusunun
cevabını bulamadı. Bu fazın bakım maliyeti **sıfır** — bir kez yazılır, biter.

⚠ Dürüstlük notu: 40 ziyaret çok küçük bir sayı; buradan "profil suçlu" sonucu
çıkarılamaz. Bu faz kanıta değil **ucuzluğa** dayanıyor: kanıtlanmayı beklemeye değmeyecek
kadar az iş.

---

## 1. @cilt.kodu

**Ad alanı** (username değil — Instagram aramasında İNDEKSLENEN alan burası):
```
Cilt Kodu · cilt bakımı ve içindekiler
```
> Neden: "cilt bakımı" araması bu alandan eşleşiyor. Şu an ad alanında yalnız marka adı
> varsa hesap hiçbir konu aramasında çıkmıyor.

**Bio:**
```
Kavanozun içinde ne var, ne işe yarıyor, neye para ödüyorsun.
Reklam değil mekanizma — 20 saniyede bir kural.
Yazan: Derin
```

**Sabitlenecek 3 gönderi** (en çok izlenen + kimliği en iyi anlatanlar):
1. `Hyalüronik Asit: Parayı Neye Ödüyoruz?` — 1358 izlenme, sayfanın "para" ekseni
2. `Gliserin: Nem Çeken Basit Mucize` — 1188 izlenme
3. `Silikonlu Primer vs Su Bazlı Primer` — kaydetme oranı en yüksek (%4,4)

---

## 2. @kizlar.kodu

**Ad alanı:**
```
Kızlar Kodu · kumaş, alışveriş, gündelik merak
```

**Bio:**
```
"Bunu neden herkes yaşıyor?"
Kıyafet, dolap, alışveriş — her videoda bir merak, bir sebep, bir espri.
Yazan: Ece
```

**Sabitlenecek 3 gönderi:**
1. `Polyester Saten Abiye Neden Bir Kez Giyilir?` — 139 izlenme
2. `Kargo Bedava Takısının 3 Günde Yeşil Olma Rehberi` — 134 izlenme, paylaşım oranı en yüksek
3. `Yıkama Etiketindeki Kuru Temizleme Tuzağı`

---

## 3. Threads (bedava ek yüzey)

Kod **hazır ve tam** (`publish/threads-publish.mjs`, `publish/publish-latest.mjs:76`).
Yalnız iki sır eksik; konulduğu an her reel Threads'e de düşer.

1. Her iki IG hesabı için Threads profilini aç (IG uygulaması → Threads).
2. developers.facebook.com → uygulamaya **Threads API** ürününü ekle.
3. `threads_basic` + `threads_content_publish` izinleriyle uzun ömürlü token al.
4. GitHub repo secret olarak ekle:
   - `THREADS_USER_ID`, `THREADS_TOKEN` (@kizlar.kodu)
   - `NOBLE_THREADS_USER_ID`, `NOBLE_THREADS_TOKEN` (@cilt.kodu)
   ⚠ İkinci çift için `brands/ciltkodu.json` → `publish.threads` alanı da eklenmeli;
   şu an marka dosyasında Threads eşlemesi YOK (yalnız instagram + facebook var).

Token yoksa akış sessizce atlıyor (`· Threads atlandı`), hat kırılmıyor.

---

## Ne DOĞRULANDI / ne UMULUYOR

**Doğrulanan:** Threads kod yolu tam; eksik olan tek şey sır. Profil metinleri sayfa
kimliğiyle (`brands/*.json → persona`) tutarlı.

**Umulan ama ölçülemeyen:** profil ziyaretinin takibe dönüşmesi. n=40 ziyarette hiçbir şey
atfedilemez. Bu faz "kanıtlandı" diye değil "ucuz ve bir kez yapılır" diye var.
