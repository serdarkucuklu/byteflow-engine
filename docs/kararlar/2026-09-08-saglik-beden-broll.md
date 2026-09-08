## 2026-09-08 — cilt sağlık Reels'i `soft` krem makrosu kullanmaz

**Ne:** `footageSet` marka-seviyesi tek alandı. `@cilt.kodu` `soft` (cream/serum) olduğu için `SAGLIK_BEDEN` pillar'ında da krem makro geliyordu.

**Neden önemli:** İzleyici konuyu değil görüntüyü okur. Ferritin/glukoz anlatırken kavanoz = yanlış sayfa.

**Nasıl uygulanır:**
1. Set `beden` (`fetch-footage.mjs`) — yüzsüz nesne, krem/yüz yasağı testte.
2. `ciltkodu.json` `footageSet: soft` + `altFootageSet: beden`.
3. `resolveFootageSet(brand, pillarKey)` — yalnız `SAGLIK_BEDEN_KEYS` iken alt set; yoksa `footageSet`. Bilinmeyen ad **throw** (`footageSetFor` hâlâ sessiz tech).
4. `run-daily`: catalog hizasından **sonra** tek `const footageQueries = footageSetFor(resolveFootageSet(brand, pillar.key))` — beyin, tazelik, `allowed` aynı dizi.
5. Alan adı `altFootageSet` (jenerik; kizlar sonra aynı kancayı kullanabilir). Bu turda kizlar dokunulmadı.

**Elendi:** pillar.`group` şeması; 9'lu json map; `ciltkodu.footageSet = beden` (skincare ölür); `healthFootageSet` (tek kullanımlık ad).
