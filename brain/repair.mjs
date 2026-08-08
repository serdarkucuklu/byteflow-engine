// Üretilen spec'teki KÜÇÜK, deterministik olarak düzeltilebilir kusurları onarır.
//
// Neden: Gemini'nin responseSchema'sı koşullu zorunluluk ifade edemiyor. Model düzenli olarak
// `kind: "code"` sahnesi üretip `code` alanını boş bırakıyor, ya da label/packet/status
// uzunluk sınırlarını 1-2 karakter aşıyor. Bunların her biri validateSpec'i düşürüyor ve
// yeterince denemede seed fallback'e — yani markasız/jenerik bir videoya — yol açıyor
// (2026-07-27'de iki koşuda da tam olarak bu oldu). Yeniden denemek yerine düzeltilebileni
// düzelt: yayın kalitesi denemenin şansına bağlı kalmasın.
const LIMITS = {nodes: 5, steps: 4, label: 18, packet: 6, status: 40, heading: 48, annotation: 80, title: 60, hook: 70, takeaway: 80};

// KELİMENİN ORTASINDAN KESME. 2026-08-08'de yayınlanan @cilt.kodu videosunda hem hook hem
// kapanış cümlesi kelime ortasında kopmuştu:
//   hook     : "Filtresiz o gece fotoğrafında hortlak gibi parlamanın suçlusunu açıklı"
//   takeaway : "Mendille silip yatarsan, o flaşlı fotoğrafta mum gibi eriyip etiketlenmeye her z"
// Sebep: `s.slice(0, n)` ham karakter kesiyordu. Videonun ilk 2 saniyesi ve punchline'ı —
// yani izlenmeyi belirleyen İKİ cümle — böyle sakatlanıyor.
export const kirp = (s, n) => {
  if (typeof s !== 'string' || s.length <= n) return s;
  const ham = s.slice(0, n);
  const bosluk = ham.lastIndexOf(' ');
  // Boşluk yoksa (tek uzun kelime) ham kesmeye mecburuz; varsa son tam kelimede dur.
  const kesik = (bosluk > 0 ? ham.slice(0, bosluk) : ham).trim();
  // Sondaki yarım noktalama/bağlaç izini temizle: "… eriyip," → "… eriyip"
  return kesik.replace(/[,;:\-–—]+$/, '').trim();
};

const cut = kirp;

/**
 * Hook ve takeaway VİDEONUN KENDİSİ: biri ilk 2 saniyeyi, diğeri punchline'ı taşıyor.
 * Bunlar sınırı aşarsa SESSİZCE KIRPILMAZ — kırpılmış bir punchline, punchline değildir.
 * Uzunsa alan olduğu gibi bırakılır, validateSpec düşer ve produceSpec yeniden üretir
 * (5 deneme var; tek alan taşması nadir). Kırpma yalnızca ekrandaki yardımcı yazılarda
 * (label, packet, status, heading) meşru.
 */
export function tasanKilitAlanlar(spec) {
  return ['hook', 'takeaway'].filter(
    k => typeof spec?.[k] === 'string' && spec[k].length > LIMITS[k],
  );
}

function repairScene(scene, maxSteps = LIMITS.steps) {
  const s = {...scene};

  // versus: nodes/steps aranmaz; satır sayısı 4'te tavanlanır.
  if (s.kind === 'versus') {
    if (Array.isArray(s.rows)) {
      s.rows = s.rows.slice(0, 4).map(r => ({
        ...r,
        label: cut(r.label, 22), left: cut(r.left, 26), right: cut(r.right, 26),
      }));
    }
    s.left = cut(s.left, 22);
    s.right = cut(s.right, 22);
    delete s.nodes; delete s.steps;
    return s;
  }

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
      .slice(0, maxSteps)                                  // beat tavanı markadan (video uzunluğu)
      .map(st => ({...st, packet: cut(st.packet, LIMITS.packet), status: cut(st.status, LIMITS.status)}));
  }
  return s;
}

// Etiketler artık AÇIKLAMANIN İÇİNDE (2026-07-27) → sayısı ve biçimi doğrudan erişimi
// etkiliyor. Model bazen tek etiket veriyordu (canlı örnek: sadece "#microsoft"); az etiket
// keşifte kayıp demek. Burada normalize edip tabana tamamlıyoruz.
// ⚠ MARKAYA BAĞLI. 2026-07-28: bu liste sabit AI etiketleriyken cilt bakımı sayfasının
// gönderisine model 6'dan az etiket döndüğünde '#ai #llm #aiengineering' ekleniyordu.
// brands/<slug>.json → defaultHashtags ile ezilir.
const DEFAULT_HASHTAGS = ['#ai', '#llm', '#aiengineering', '#aiagents', '#tech', '#developers'];
const MIN_TAGS = 6, MAX_TAGS = 9;

// Türkçe harfler KORUNUR. Eskiden [^a-z0-9#_] süzgeci vardı ve '#güneşbakımı' → '#gnebakm'
// oluyordu: anlamsız, hiç aranmayan bir etiket. Türkçe bir sayfada keşfi doğrudan öldürüyor.
const TAG_STRIP = /[^0-9a-zçğıöşü#_]/g;

function normalizeHashtags(list, defaults = DEFAULT_HASHTAGS) {
  const clean = (Array.isArray(list) ? list : [])
    .map(t => String(t).toLocaleLowerCase('tr').replace(TAG_STRIP, ''))
    .map(t => (t.startsWith('#') ? t : `#${t}`))
    .filter(t => t.length > 2);
  const out = [...new Set(clean)];
  for (const d of defaults) {
    if (out.length >= MIN_TAGS) break;
    if (!out.includes(d)) out.push(d);
  }
  return out.slice(0, MAX_TAGS);
}

/** Onarılmış spec'i döndürür (girdi mutasyona uğramaz). Onarılamayan sahne düşürülür. */
/**
 * Anlatım cümlelerini beat yapısına oturtur: [hook, ...her adım için bir cümle, kapanış].
 * Model sayıyı tutturamazsa eksikleri adımların status metninden üretir — seslendirme ve
 * altyazı sessizce desenkron olmaktansa biraz düz bir cümle söylesin.
 */
function repairNarration(out, kinetik = false) {
  // Beat sayısı sahne tipine göre: diyagramda adım başına, versus'ta SATIR başına bir cümle.
  const first = (out.scenes ?? []).find(s => (s.steps?.length ?? 0) || (s.rows?.length ?? 0));
  const steps = first?.kind === 'versus' ? (first.rows ?? []) : (first?.steps ?? []);
  // KİNETİK BİÇİMDE KURULUM CÜMLESİ YOK: ekranda tanıtılacak "parçalar" (kutular, oklar)
  // bulunmuyor. "Şimdi üç adımda ne oluyor bakalım" cümlesi 20 saniyelik videonun ~4
  // saniyesini hiçbir şey söylemeden harcıyor.
  const ekstra = kinetik ? 2 : 3;      // hook [+ kurulum] + adımlar/satırlar + kapanış
  const want = steps.length + ekstra;
  let given = (Array.isArray(out.narration) ? out.narration : [])
    .map(t => String(t).replace(/[*`]/g, '').trim()).filter(Boolean);
  // Fazla cümle: baştakileri koru ama KAPANIŞI kaybetme (son cümle kapanıştır).
  if (given.length > want) given = [...given.slice(0, want - 1), given[given.length - 1]];

  const sentence = t => (/[.!?]$/.test(t) ? t : `${t}.`);
  // Adımların anlatımda nereden başladığı: kinetikte 1, klasikte 2 (kurulum bir yer tutuyor).
  const adimBas = ekstra - 1;
  return Array.from({length: want}, (_, i) => {
    if (given[i]) return sentence(given[i]);
    if (i === 0) return sentence(out.hook ?? out.title ?? 'Here is how it actually works');
    if (!kinetik && i === 1) return `Here is what actually happens, in ${steps.length} steps.`;
    if (i === want - 1) return sentence(out.takeaway ?? 'That is the whole mechanism');
    const b = steps[i - adimBas];
    return sentence(cap(b?.status ?? b?.label ?? 'the next step runs'));
  });
}

const cap = t => String(t).charAt(0).toUpperCase() + String(t).slice(1);

export function repairSpec(spec, {defaultHashtags, maxSteps, format} = {}) {
  const kinetik = format === 'kinetik';
  const out = {...spec};
  out.hashtags = normalizeHashtags(out.hashtags, defaultHashtags?.length ? defaultHashtags : DEFAULT_HASHTAGS);
  // title kırpılabilir (ekranda başlık, anlamı taşımıyor). hook/takeaway kırpılmaz —
  // taşarlarsa olduğu gibi bırakılır ki validateSpec düşsün ve yeniden üretilsin.
  if ('title' in out) out.title = cut(out.title, LIMITS.title);
  const tasan = tasanKilitAlanlar(out);
  if (tasan.length) {
    console.error(`[repair] ${tasan.join('+')} sınırı aştı → kırpılmıyor, yeniden üretilecek`);
  }

  const scenes = (spec.scenes ?? []).map(sc => repairScene(sc, maxSteps)).filter(s =>
    s.kind === 'code' ? Boolean(s.code)
      : s.kind === 'versus' ? (s.rows?.length >= 2 && s.left && s.right)
      : (s.nodes?.length >= 3 && s.steps?.length >= 1));
  // Hepsi düşerse orijinali bırak: validateSpec kararı versin, sessizce boş spec üretme.
  out.scenes = scenes.length ? scenes.slice(0, 2) : (spec.scenes ?? []);
  out.narration = repairNarration(out, kinetik);
  return out;
}
