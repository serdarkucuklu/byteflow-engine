// Yerelleştirme — spec'in EKRANDA/SESTE görünen her metnini hedef dile çevirir.
//
// Neden ayrı bir adım: prompt'a "Türkçe yaz" demek yetmedi. Kural prompt'un ilk satırında ve
// beş ayrı alanda tekrarlanmasına rağmen model İngilizce üretmeye devam etti (canlı koşuda
// üç kez: "Sunscreen Stick Coverage", "Sunscreen Stick SPF Fallacy"...). Üretimi umuda
// bırakmak yerine ayrı, dar kapsamlı ve DOĞRULANABİLİR bir çeviri çağrısı yapıyoruz:
// yapı korunur (id'ler, adım bağlantıları, renkler), yalnızca insan metinleri değişir.
//
// Çeviri başarısız olursa spec olduğu gibi döner — yayın akışı kırılmaz (kötü dil, yayın
// yokluğundan iyidir; ayrıca CI logunda görünür).
const MODELS = ['gemini-3.6-flash', 'gemini-2.5-flash'];
const LANG_NAMES = {tr: 'Turkish', en: 'English', de: 'German', es: 'Spanish'};

const SCHEMA = {
  type: 'OBJECT',
  required: ['title', 'hook', 'takeaway', 'caption', 'hashtags', 'narration', 'scenes'],
  properties: {
    title: {type: 'STRING'},
    hook: {type: 'STRING'},
    takeaway: {type: 'STRING'},
    caption: {type: 'STRING'},
    hashtags: {type: 'ARRAY', items: {type: 'STRING'}},
    narration: {type: 'ARRAY', items: {type: 'STRING'}},
    scenes: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          heading: {type: 'STRING'},
          annotation: {type: 'STRING'},
          labels: {type: 'ARRAY', items: {type: 'STRING'}},   // node etiketleri, SIRAYLA
          statuses: {type: 'ARRAY', items: {type: 'STRING'}}, // adım açıklamaları, SIRAYLA
        },
      },
    },
  },
};

/** Metin ağırlıklı olarak hedef dilde mi? (kaba ama ucuz kontrol) */
export function looksLocalized(spec, lang) {
  if (lang !== 'tr') return false;
  const text = [spec.title, spec.hook, spec.takeaway, ...(spec.narration ?? [])].join(' ');
  if (/[çğıöşüÇĞİÖŞÜ]/.test(text)) return true;
  // Türkçe'de çok sık geçen ekler/kelimeler
  return /\b(bir|için|değil|ile|ama|daha|çok|nasıl|neden)\b/i.test(text);
}

const PROMPT = (spec, langName) => `Translate this Instagram video script into ${langName}.

RULES:
- Translate ONLY the human-readable strings. Keep the meaning, the tone (calm, evidence-based,
  no hype) and the sentence COUNT identical.
- narration: same number of sentences, same order, each <= 9 words, natural spoken ${langName}.
- Node labels: SHORT (<= 18 characters), UPPERCASE, same order as given.
- Step statuses: lowercase, <= 40 characters, same order as given.
- caption: translate fully, keep the numbered structure, keep emoji lines, keep the final
  handle/tagline lines exactly as they are written (they are already localized).
- hashtags: give 6-9 tags that a ${langName} speaking audience actually searches; keep the
  clearly international ones (e.g. #skincare) and localize the rest.
- Scientific terms stay as they are used in ${langName} (retinol, niasinamid, SPF...).
- Never add, drop or reorder items.

SOURCE:
${JSON.stringify({
  title: spec.title, hook: spec.hook, takeaway: spec.takeaway,
  caption: spec.caption, hashtags: spec.hashtags, narration: spec.narration,
  scenes: (spec.scenes ?? []).map(s => ({
    heading: s.heading, annotation: s.annotation,
    labels: (s.nodes ?? []).map(n => n.label),
    statuses: (s.steps ?? []).map(st => st.status),
  })),
}, null, 1)}`;

/** Çevrilmiş spec döndürür (girdi mutasyona uğramaz). Hata/atlama durumunda aynısını döndürür. */
export async function localizeSpec({spec, language, apiKey, fetchFn = fetch, retries = 1}) {
  if (!language || language === 'en' || !apiKey) return spec;
  if (looksLocalized(spec, language)) return spec;              // seed'ler zaten hedef dilde
  const langName = LANG_NAMES[language] ?? language;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const model = MODELS[Math.min(attempt, MODELS.length - 1)];
    try {
      const res = await fetchFn(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            contents: [{parts: [{text: PROMPT(spec, langName)}]}],
            generationConfig: {responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.3},
          }),
        });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('boş yanıt');
      return applyTranslation(spec, JSON.parse(text));
    } catch (e) {
      console.error(`[localize] deneme ${attempt} (${model}): ${e.message}`);
    }
  }
  console.error('⚠ yerelleştirme başarısız — spec kaynak dilinde kalıyor');
  return spec;
}

/** Çeviriyi yapıyı BOZMADAN uygular: id, bağlantı, renk, kod dokunulmaz. */
export function applyTranslation(spec, t) {
  const pick = (val, fallback) => (typeof val === 'string' && val.trim() ? val.trim() : fallback);
  const out = {
    ...spec,
    title: pick(t.title, spec.title),
    hook: pick(t.hook, spec.hook),
    takeaway: pick(t.takeaway, spec.takeaway),
    caption: pick(t.caption, spec.caption),
    hashtags: Array.isArray(t.hashtags) && t.hashtags.length ? t.hashtags : spec.hashtags,
    narration: Array.isArray(t.narration) && t.narration.length === (spec.narration?.length ?? 0)
      ? t.narration : spec.narration,
  };
  out.scenes = (spec.scenes ?? []).map((scene, i) => {
    const ts = t.scenes?.[i] ?? {};
    const s = {...scene};
    if (scene.heading) s.heading = pick(ts.heading, scene.heading);
    if (scene.annotation) s.annotation = pick(ts.annotation, scene.annotation);
    if (Array.isArray(scene.nodes) && Array.isArray(ts.labels) && ts.labels.length === scene.nodes.length) {
      s.nodes = scene.nodes.map((n, j) => ({...n, label: pick(ts.labels[j], n.label)}));
    }
    if (Array.isArray(scene.steps) && Array.isArray(ts.statuses) && ts.statuses.length === scene.steps.length) {
      s.steps = scene.steps.map((st, j) => ({...st, status: pick(ts.statuses[j], st.status)}));
    }
    return s;                                   // s.code, s.layout, from/to, packet, color aynen kalır
  });
  return out;
}
