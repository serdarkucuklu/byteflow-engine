// Üretilen spec'teki KÜÇÜK, deterministik olarak düzeltilebilir kusurları onarır.
//
// Neden: Gemini'nin responseSchema'sı koşullu zorunluluk ifade edemiyor. Model düzenli olarak
// `kind: "code"` sahnesi üretip `code` alanını boş bırakıyor, ya da label/packet/status
// uzunluk sınırlarını 1-2 karakter aşıyor. Bunların her biri validateSpec'i düşürüyor ve
// yeterince denemede seed fallback'e — yani markasız/jenerik bir videoya — yol açıyor
// (2026-07-27'de iki koşuda da tam olarak bu oldu). Yeniden denemek yerine düzeltilebileni
// düzelt: yayın kalitesi denemenin şansına bağlı kalmasın.
const LIMITS = {nodes: 5, steps: 4, label: 18, packet: 6, status: 40, heading: 48, annotation: 80, title: 60, hook: 70, takeaway: 80};

const cut = (s, n) => (typeof s === 'string' && s.length > n ? s.slice(0, n).trim() : s);

function repairScene(scene) {
  const s = {...scene};

  // Kod sahnesi ilan edip kod vermemiş → elde diyagram verisi varsa diyagrama çevir.
  if (s.kind === 'code' && !s.code) {
    delete s.kind;
    delete s.language;
    delete s.reveal;
  }
  if (s.kind === 'code') {
    s.language = 'python';                 // şema python'dan başkasını kabul etmiyor
    delete s.nodes;                        // kod sahnesinde artık alanlar kafa karıştırıyor
    delete s.steps;
    s.heading = cut(s.heading, LIMITS.heading);
    s.annotation = cut(s.annotation, LIMITS.annotation);
    return s;
  }

  s.heading = cut(s.heading, LIMITS.heading);
  if (Array.isArray(s.nodes)) {
    // Sadelik tavanı: 5 karttan fazlası 9:16'da okunmuyor. Fazlasını ATMA yerine
    // KIRP — model 6-7 kart verdiğinde videoyu seed'e düşürmek yerine sadeleştir.
    s.nodes = s.nodes.slice(0, LIMITS.nodes).map(n => ({...n, label: cut(n.label, LIMITS.label)}));
  }
  if (Array.isArray(s.steps)) {
    const ids = new Set((s.nodes ?? []).map(n => n.id));
    s.steps = s.steps
      .filter(st => ids.has(st.from) && ids.has(st.to))   // var olmayan node'a giden adım = ölü adım
      .slice(0, LIMITS.steps)                              // 4 beat'ten fazlası izleyiciyi kaybettiriyor
      .map(st => ({...st, packet: cut(st.packet, LIMITS.packet), status: cut(st.status, LIMITS.status)}));
  }
  return s;
}

// Hashtag'siz spec de şemadan düşüyor (model ara sıra boş dizi veriyor) — yayını
// bunun için harcamaya değmez, markanın sabit etiketleriyle doldur.
const DEFAULT_HASHTAGS = ['#llm', '#aiengineering', '#aiagents'];

/** Onarılmış spec'i döndürür (girdi mutasyona uğramaz). Onarılamayan sahne düşürülür. */
export function repairSpec(spec) {
  const out = {...spec};
  if (!Array.isArray(out.hashtags) || out.hashtags.length === 0) out.hashtags = [...DEFAULT_HASHTAGS];
  for (const key of ['title', 'hook', 'takeaway']) if (key in out) out[key] = cut(out[key], LIMITS[key]);

  const scenes = (spec.scenes ?? []).map(repairScene).filter(s =>
    s.kind === 'code' ? Boolean(s.code) : (s.nodes?.length >= 3 && s.steps?.length >= 1));
  // Hepsi düşerse orijinali bırak: validateSpec kararı versin, sessizce boş spec üretme.
  out.scenes = scenes.length ? scenes.slice(0, 2) : (spec.scenes ?? []);
  return out;
}
