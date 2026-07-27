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
