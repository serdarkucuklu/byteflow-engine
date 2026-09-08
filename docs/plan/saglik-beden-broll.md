# Plan: cilt.kodu sağlık pillar'ları — `beden` b-roll

**Tarih:** 2026-09-08 · **Boy:** S · **Sayfa:** @cilt.kodu (`beauty-tr`)
**Revizyon:** tur 1 — `karsi-gorus` KRİTİK+ÖNEMLİ uygulandı

## Hedef
Sağlık/spor Reels'inde (`SAGLIK_BEDEN`) krem/serum makro gelmesin. Yeni set `beden`.
Skincare `soft` kalsın. kizlar.kodu dokunulmaz.

## Yaklaşım
Seçim bugün **BRAND-ONLY** (`run-daily.mjs:146/286/298` — `brand.footageSet`). Katalog
`forcedSubject.pillar` ile pillar'ı **sonradan değiştirebilir** (`:129-135`). Bu yüzden set
adı catalog hizasından **SONRA bir kez** çözülür ve üç tüketici aynı diziye bakar:

```js
const footageQueries = footageSetFor(resolveFootageSet(brand, pillar.key));
```

`SAGLIK_BEDEN` → `brand.altFootageSet` (`beden`); aksi / alan yok → `brand.footageSet`
(`soft`). Helper `brain/footage-set.mjs` (pillars'a footage sızmaz). Yeni API yok.

## Ödünleşimler

| Alternatif | Artı | Eksi | Karar |
|---|---|---|---|
| **A** `altFootageSet: "beden"` + `SAGLIK_BEDEN_KEYS` + tek `footageQueries` const | 1 json alanı, mevcut dizi, kizlar aynı kancayı sonra kullanır | catalog sonrası tek atama disiplin ister | ✅ |
| **B** pillar.`group` + `brand.footageByGroup` | esnek | group şeması tüm pillar'lara yayılır | ❌ şema şişer |
| **C** 9 key'i json'da map | açık tablo | yeni pillar unutulur | ❌ sürüklenme |
| 3× `resolveFootageSet` (eski 2.5) | her site kendi çözer | catalog öncesi / site sapması; krem sızar | ❌ tur 1 |
| `healthFootageSet` adı | niyet okunur | kizlar kancayı paylaşamaz | ❌ jenerik `altFootageSet` |
| `resolveFootageSet` `pillars.mjs` içinde | az dosya | footage politikası pillar'a sızar | ❌ ayrı helper |
| `ciltkodu.footageSet` = `beden` | tek satır | skincare krem makrosunu kaybeder | ❌ |

---

## Faz 1 — `beden` seti (dikey dilim)

`run-daily` yok. `footageSetFor('beden')` krem/yüz dönmesin. Sıra zorunlu: önce küme
(`footageSetFor` bilinmeyeni sessizce TECH'e düşürür — `:157-159`; throw Faz 2'de).

v1 **≥16** (gunluk tabanı), ~20 yüzsüz nesne. `hand`/`stretching` zorunlu değil.

Önerilen liste: empty yoga mat on wooden floor · dumbbell on gym floor close up · running
shoes on plain background · water bottle on wooden table close up · foam roller on floor
close up · jump rope on gym floor close up · resistance band on floor close up · fitness
watch on table macro · fruit and water glass still life · kettlebell on gym floor close up
· exercise mat rolled up close up · protein shaker bottle close up · athletic sneakers
flat lay · yoga block on wooden floor · barbell plates on floor close up · sleep mask on
nightstand close up · herbal tea cup steam close up · bathroom scale on floor close up ·
ice pack on wooden surface close up · gym towel folded on bench close up.

| # | Görev | Dosya (sahiplik) | Doğrulama |
|---|---|---|---|
| 1.1 | `BEDEN_FOOTAGE` + `FOOTAGE_SETS.beden`. `tech/soft/fabric/gunluk`'e dokunma | `fetch/fetch-footage.mjs` | 1.2 |
| 1.2 | (a) `length >= 16` (b) `cream\|serum\|lipstick\|foundation\|mascara` yok (c) `woman\|girl\|man\|person\|people\|model\|face` yok (d) bilinmeyen ad hâlâ `tech` (e) **gunluk guard'ını kopyalama** — `hand\|body\|stretching` yasağı gunluk'e özel | `fetch/fetch-footage.test.mjs` | kapı |

**FAZ KAPISI:** `cd /mnt/d/AI/Playground/16-byteflow-engine && node --test fetch/fetch-footage.test.mjs`
→ fail 0; `beden` ≥16; krem/yüz yasağı yeşil; gunluk guard eskisi gibi; bilinmeyen→tech.
**Geri alma:** `git revert <sha>` — referanssız ölü kod.

---

## Faz 2 — tek const + `altFootageSet` (Gemini yok)

```js
// brain/pillars.mjs — yalnız key seti; footage yok
export const SAGLIK_BEDEN_KEYS = new Set(SAGLIK_BEDEN.map(p => p.key));

// brain/footage-set.mjs — FOOTAGE_SETS + SAGLIK_BEDEN_KEYS
export function resolveFootageSet(brand, pillarKey) {
  const name = (brand?.altFootageSet && SAGLIK_BEDEN_KEYS.has(pillarKey))
    ? brand.altFootageSet : (brand?.footageSet ?? 'tech');
  if (!Object.hasOwn(FOOTAGE_SETS, name)) throw new Error(`unknown footageSet: ${name}`);
  return name;
}
```

`footageSetFor` imzasına `{strict}` **ekleme** — bilinmeyen→tech kalsın. Throw yalnız
`resolveFootageSet`. Key kaynağı dizi (kopya liste yok). Skincare: `SKINCARE_SCIENCE[0].key`.

| # | Görev | Dosya (sahiplik) | Doğrulama |
|---|---|---|---|
| 2.1 | `SAGLIK_BEDEN_KEYS` export. Footage/resolve **yok** | `brain/pillars.mjs` | 2.3 |
| 2.2 | `resolveFootageSet` (yukarı). `fetch-footage.mjs` pillars import etmez | `brain/footage-set.mjs` | 2.3 |
| 2.3 | (a) `{footageSet:'soft', altFootageSet:'beden'}` × `hormon-enerji` → `'beden'`; liste `cream\|serum\|lipstick` **yok** (b) × `SKINCARE_SCIENCE[0].key` → `'soft'`; liste `footageSetFor('soft')` (c) `altFootageSet` yok × sağlık key → `footageSet` (d) `altFootageSet:'body'` **throw** (e) `footageSetFor('yok')` hâlâ tech — 1.2 kilidi | `brain/footage-set.test.mjs` | kapı |
| 2.4 | `"altFootageSet": "beden"`; `"footageSet": "soft"` aynen. kizlarkodu'ya alan **yok** | `brands/ciltkodu.json` | 2.5 |
| 2.5 | `load()` ile: `ciltkodu.footageSet==='soft'` · `altFootageSet==='beden'` · kizlar `gunluk` ve `altFootageSet` yok. Allowlist varsa alanı geçir | `brands/load.test.mjs` · gerekirse `brands/load.mjs` | kapı |
| 2.6 | Catalog hizası **sonra** (`pickCatalogSubject` / `:123-136` sonrası, `brandForBrain` `:146` öncesi) **tek** `const footageQueries = footageSetFor(resolveFootageSet(brand, pillar.key))`. Paylaş: `brandForBrain.footageQueries`, `tazeSorgular.liste`, `fetchFootage.allowed`. `resolveFootageSet` **1 kez**. `footageSetFor(brand.footageSet)` kalıntı **0**. `generate-spec.mjs`'e dokunma | `run-daily.mjs` | kapı |

**FAZ KAPISI:** Gemini **koşturma**.
```
cd /mnt/d/AI/Playground/16-byteflow-engine && node --test brands/load.test.mjs brain/footage-set.test.mjs fetch/fetch-footage.test.mjs
node -e "import {readFileSync} from 'node:fs'; const s=readFileSync('run-daily.mjs','utf8'); if ((s.match(/resolveFootageSet/g)||[]).length!==1) process.exit(1); if (!/const footageQueries\s*=\s*footageSetFor\(\s*resolveFootageSet\(brand,\s*pillar\.key\)\s*\)/.test(s)) process.exit(2); if (/footageSetFor\(\s*brand\.footageSet\s*\)/.test(s)) process.exit(3); const a=s.indexOf('pillar kataloğa hizalandı'), b=s.indexOf('const footageQueries'); if (a<0\|\|b<0\|\|b<a) process.exit(4); console.log('OK');"
```
→ test fail 0; ikinci komut `OK`.
**Geri alma:** `git revert <sha>`; kısmi = json'dan `altFootageSet` sil (resolve `soft`).

---

## Tuzaklar

- Catalog hizası (`:129-135`) pillar'ı değiştirir. `footageQueries` **ondan önce** çözülürse
  sağlık Reels'i `soft` (krem) alır — kapı `hizalandı` indeksini const'tan küçük ister.
- 3 ayrı resolve = 3 sapma penceresi. Paylaşılan tek dizi; `toSafeQuery`/`allowed` aynı referans.
- `footageSetFor('body')` TECH'e düşer (kırılmaz). Yanlış `altFootageSet` **throw** etmeli
  (sessiz devre kartı yok). İsim kilidi `'beden'`. Faz 1'siz Faz 2 throw eder — sıra zorunlu.
- `load.mjs` allowlist `altFootageSet`'i düşürürse resolve hep `soft`; 2.5 `load()` ile kilitler.
- gunluk guard'ı (`hand\|body\|stretching`) tüm setlere genelleştirme. `model` PEOPLE'da yok (`:179`).
- Pexels `"yoga mat"` insan döner → `empty` / `on floor` / `close up` / `still life`. Serum
  şişesine benzeyen supplement şişesi yazma.
- `pillars` objesinde `group`/`footageSet` yok — B/C'ye kayma.

## Riskler

| Risk | Olasılık | Etki | Azaltma |
|---|---|---|---|
| Nesne sorgusu yine krem/yüz klip | orta | yanlış estetik | beyaz liste + 2.3 cream-free; PEOPLE ikinci hat |
| Const catalog öncesi | orta | sağlık←soft | kapı: hizalama satırı < const |
| `load()` alanı düşürür | düşük | hep `soft` | 2.5 `load()` kilidi |
| Yeni sağlık key `SAGLIK_BEDEN` dışında | düşük | o konu `soft` | KEYS diziden türetilir |

## Kapsam dışı

- kizlar.kodu (kanca `altFootageSet` jenerik ama bu planda yazılmaz)
- Yayın, render, catalog doldurma, `daily.yml`, Gemini / `dene-spec`
- Yeni stok API, `SOFT_FOOTAGE`'dan cream silmek, `generate-spec.mjs`
- Pillar `group`, 9'lu json map, `footageSetFor` varsayılanını throw'a çevirmek

## İşletme
Her faz ayrı commit; imza `Serdar Küçüklü <serdarkucuklu@gmail.com>`; Claude/Anthropic atfı YOK.
Faz 1 kapısı geçmeden Faz 2 yok. `karsi-gorus` tur 1 düzeltildi (tek const, ≥16,
`altFootageSet`, helper ayrı, throw, cream-free birim).

---
<!--
  [x] Her fazın çalıştırılabilir doğrulama komutu var
  [x] Faz 1 dikey dilim (set tek başına ölçülür)
  [x] Görevler 2-15 dk, tek dosya sahipliği
  [x] ≥2 alternatif
  [x] Geri alma yazılı
  [x] ≤200 satır
  [x] karsi-gorus incelemesi (tur 1 düzeltildi)
-->
