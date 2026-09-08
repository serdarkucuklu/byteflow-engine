## 2026-09-08 — Reels öznesi katalogla kilitlenir, soğuma tüm geçmiştir

**Ne:** Gemini’ye “farklı konu” demek yetmedi; `namedExamples` ve 8 postluk soğuma aynı özneyi (retinol, polyester) yeni gaf ile geri getirdi. `timelyPayi` yazılmazsa %75 timely ürün karşılaştırması.

**Neden önemli:** İzleyici açıyı değil özneyi görür. Kısa namedExamples + serbest üretim = tekrar.

**Nasıl uygulanır:** Yeni nişte (1) `brands/catalogs/<slug>.json` — özne kökleri çakışmasın, her kayıtta `ipucu`; (2) `recentSubjects` limiti kırma; (3) `timelyPayi` merak/sağlık sayfasında ≤0.25; (4) `forcedSubject` kaçarsa produce retry. Kardeş çit: kizlar davranış, cilt beden/ürün.
