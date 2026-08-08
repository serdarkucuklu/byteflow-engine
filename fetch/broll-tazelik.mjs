// fetch/broll-tazelik.mjs — b-roll sorgularının koşudan koşuya TEKRAR ETMEMESİ.
//
// ÖLÇÜLEN SORUN (2026-08-09, brands/state/*-history.json):
//   @cilt.kodu 21 videoda → "cream texture macro" 11×, "serum drop close up" 8×
//   20 ardışık video çiftinin 14'ünde aynı b-roll sorgusu tekrar ediyor.
// Yani sayfayı kaydıran izleyici aynı krem/serum görüntüsünü tekrar tekrar görüyor.
// Araştırmanın "şablon görsel" uyarısı tam bu: içerik özgün olsa bile GÖRÜNTÜ aynı.
//
// Beyin `footage_queries` üretiyor ama beyaz listeyle sınırlı olduğu için sürekli aynı
// birkaç sorguya yakınsıyor. Burada son koşuların sorguları elenip yerine listeden taze
// olanlar konuyor. SAF — dosya/ağ yok.

/** Son `pencere` koşuda kullanılmış sorgular ("provider:sorgu" → "sorgu"). SAF. */
export function gecmisSorgulari(history = [], pencere = 3) {
  return history
    .filter(h => Array.isArray(h?.footage))
    .slice(-pencere)
    .flatMap(h => h.footage)
    .map(f => String(f).split(':').slice(1).join(':').trim())
    .filter(Boolean);
}

/**
 * İstenen sorgulardan son koşularda kullanılanları TAZE olanlarla değiştirir. SAF.
 * Havuz tükenirse yine de sorgu döner — klip indirilemezse video zeminini kaybeder,
 * bu yüzden boş dönmek yasak.
 */
export function tazeSorgular({istenen = [], gecmis = [], liste = [],
  sec = a => a[Math.floor(Math.random() * a.length)]}) {
  const yasak = new Set(gecmis.map(q => String(q).toLowerCase()));
  const kullanilan = new Set();
  const out = [];

  for (const q of istenen) {
    const norm = String(q ?? '').toLowerCase();
    if (q && !yasak.has(norm) && !kullanilan.has(norm)) {
      out.push(q);
      kullanilan.add(norm);
      continue;
    }
    // Değiştir: ne yakın geçmişte ne de bu koşuda kullanılmış bir sorgu.
    const havuz = liste.filter(c => {
      const n = c.toLowerCase();
      return !yasak.has(n) && !kullanilan.has(n);
    });
    if (havuz.length) {
      const yeni = sec(havuz);
      out.push(yeni);
      kullanilan.add(yeni.toLowerCase());
    } else {
      // Havuz tükendi: en azından bu koşu içinde tekrar etmeyeni al, o da yoksa olduğu gibi.
      const kalan = liste.filter(c => !kullanilan.has(c.toLowerCase()));
      const yedek = kalan.length ? sec(kalan) : q;
      out.push(yedek);
      kullanilan.add(String(yedek).toLowerCase());
    }
  }
  return out;
}
