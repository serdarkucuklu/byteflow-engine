// Ekranda görünen metinlerden markdown vurgusunu temizler.
// Gemini zaman zaman "your *real* safety net" gibi yıldızlı vurgu üretiyor; Motion Canvas
// bunu düz metin basıyor ve ekranda yıldız olarak görünüyor (2026-07-27 CI çıktısında
// outro'da görüldü). Kod sahneleri DOKUNULMAZ — orada `*` gerçek operatör olabilir.
const strip = s => (typeof s === 'string' ? s.replace(/[*`]/g, '').replace(/\s{2,}/g, ' ').trim() : s);

export function stripMarkdown(spec) {
  const out = {...spec};
  for (const key of ['title', 'hook', 'takeaway']) if (key in out) out[key] = strip(out[key]);
  out.scenes = (spec.scenes ?? []).map(scene => {
    const s = {...scene};
    if ('heading' in s) s.heading = strip(s.heading);
    if ('annotation' in s) s.annotation = strip(s.annotation);
    if (Array.isArray(s.nodes)) s.nodes = s.nodes.map(n => ({...n, label: strip(n.label)}));
    if (Array.isArray(s.steps)) {
      s.steps = s.steps.map(st => ({...st, packet: strip(st.packet), status: strip(st.status)}));
    }
    return s;                                  // s.code bilerek dokunulmadan geçer
  });
  return out;
}

// Etiketlerden yabancı alfabe/çöp karakterleri atar.
// 2026-07-28: Gemini "#ciltbakimi创业" üretti — Çince karakterler etiketin içine kaynamıştı.
// Instagram bunu geçerli bir etiket saymıyor ve gönderi o etiketten hiç keşfedilmiyor;
// üstelik Türkçe bir sayfada gözle görülür bir hata olarak duruyor.
// Türkçe harfler KORUNUR (#güneşbakımı gerçek bir etiket).
const TAG_OK = /[^0-9a-zçğıöşü]/gi;
export function sanitizeHashtags(tags = []) {
  const seen = new Set();
  return tags
    .map(t => '#' + String(t).replace(/^#+/, '').replace(TAG_OK, '').toLowerCase())
    .filter(t => {
      if (t.length < 3 || seen.has(t)) return false;   // "#" + en az 2 harf
      seen.add(t);
      return true;
    });
}

// Açıklamayı okunur satırlara böler.
// Prompt "her CTA kendi satırında" diyor ama model bazen tek paragraf döndürüyor
// (2026-07-28 @cilt.kodu adayı: 1 satır). Instagram'da duvar gibi metin okunmuyor —
// numaralı maddeler ve CTA'lar satır başına çekiliyor. Zaten satırlıysa dokunulmaz.
export function formatCaption(caption) {
  if (typeof caption !== 'string' || caption.includes('\n')) return caption;
  return caption
    // "… cümle. 1. Madde — …" → numaralı maddeler kendi satırına
    .replace(/\s+(?=\d+\.\s+\p{Lu})/gu, '\n')
    // emoji CTA'lar, imza ve tagline kendi satırına
    .replace(/\s+(?=(📌|🔁|↗|Written by |Yazan ))/gu, '\n\n')
    .replace(/\s+(?=(Takip et:|Follow @))/gu, '\n')
    .trim();
}
