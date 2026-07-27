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
/**
 * Anlatım cümlelerini beat yapısına oturtur: [hook, ...her adım için bir cümle, kapanış].
 * Model sayıyı tutturamazsa eksikleri adımların status metninden üretir — seslendirme ve
 * altyazı sessizce desenkron olmaktansa biraz düz bir cümle söylesin.
 */
function repairNarration(out) {
  const first = (out.scenes ?? []).find(s => Array.isArray(s.steps) && s.steps.length);
  const steps = first?.steps ?? [];
  const want = steps.length + 3;   // hook + kurulum + adımlar + kapanış
  let given = (Array.isArray(out.narration) ? out.narration : [])
    .map(t => String(t).replace(/[*`]/g, '').trim()).filter(Boolean);
  // Fazla cümle: baştakileri koru ama KAPANIŞI kaybetme (son cümle kapanıştır).
  if (given.length > want) given = [...given.slice(0, want - 1), given[given.length - 1]];

  const sentence = t => (/[.!?]$/.test(t) ? t : `${t}.`);
  return Array.from({length: want}, (_, i) => {
    if (given[i]) return sentence(given[i]);
    if (i === 0) return sentence(out.hook ?? out.title ?? 'Here is how it actually works');
    if (i === 1) return `Here is what actually happens, in ${steps.length} steps.`;
    if (i === want - 1) return sentence(out.takeaway ?? 'That is the whole mechanism');
    return sentence(cap(steps[i - 2]?.status ?? 'the next step runs'));
  });
}

const cap = t => String(t).charAt(0).toUpperCase() + String(t).slice(1);

export function repairSpec(spec) {
  const out = {...spec};
  if (!Array.isArray(out.hashtags) || out.hashtags.length === 0) out.hashtags = [...DEFAULT_HASHTAGS];
  for (const key of ['title', 'hook', 'takeaway']) if (key in out) out[key] = cut(out[key], LIMITS[key]);

  const scenes = (spec.scenes ?? []).map(repairScene).filter(s =>
    s.kind === 'code' ? Boolean(s.code) : (s.nodes?.length >= 3 && s.steps?.length >= 1));
  // Hepsi düşerse orijinali bırak: validateSpec kararı versin, sessizce boş spec üretme.
  out.scenes = scenes.length ? scenes.slice(0, 2) : (spec.scenes ?? []);
  out.narration = repairNarration(out);
  return out;
}
