// B-roll footage fetcher — ByteFlow reel'lerinin arkasına GERÇEK hareketli görüntü koyar.
// Noble Vision'daki (02-auto-poster-agent) kanıtlanmış Pexels yaklaşımının Node karşılığı,
// çok sağlayıcılı: Pexels → Pixabay → Coverr. Hiçbir anahtar yoksa boş dizi döner ve
// çağıran taraf eski (düz arka planlı) render'a düşer — günlük akış asla kırılmaz.
//
// Lisanslar: Pexels License / Pixabay Content License / Coverr License — üçü de ticari
// kullanıma ve atıfsız yayına izin verir (yine de credit'i posted-history'ye yazıyoruz).
import {writeFileSync, mkdirSync, existsSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const MIN_BYTES = 200_000;      // bundan küçük indirme = bozuk/placeholder
const MIN_DURATION = 4;         // 4sn altı klipler loop gibi görünüyor
const TOP_POOL = 8;             // kalite sıralamasında ilk N aday arasından rastgele seç

// Konu → b-roll sorgusu için yedek havuz (beyin sorgu üretmezse). Hepsi "AI/sistem/kod"
// estetiğinde, dikey stok videoda bolca karşılığı olan terimler.
// İnsansız: sayfa faceless — arkada yüz/insan görünmesi markayı bozuyor (2026-07-27 outro'da
// bir portre çıktı). Sadece makine, mekân, yüzey ve soyut hareket.
// BEYAZ LİSTE — beyin b-roll konusunu yalnızca buradan seçebilir (responseSchema enum'u).
// Neden liste: serbest metin sorgusu yetmiyor. "server racks blinking blue lights" gibi
// tamamen makine odaklı bir sorgu bile Pexels'te teknisyenli klip döndürdü (2026-07-27,
// 4. koşu hook karesi) — sayfa faceless olduğu için bu kabul edilemez. Buradaki konular
// insanın PRATİKTE kadraja girmediği çekimler: makro, soyut, doku, boş mekân, hava çekimi.
const TECH_FOOTAGE = [
  'abstract digital particles',
  'ink drop in water macro',
  'circuit board macro',
  'microchip macro closeup',
  'fiber optic strands',
  'network connection lines abstract',
  'light streaks long exposure',
  'smoke swirling dark background',
  'rain on glass at night',
  'water surface ripples dark',
  'city night timelapse neon',
  'aerial highway at night',
  'clouds timelapse dark sky',
  'northern lights time lapse',
  'sand dunes aerial',
  'ocean waves aerial dark',
  'empty data center aisle',
  'server led lights macro',
  'glass building reflection abstract',
  'geometric neon grid motion',
];

// Cilt bakımı sayfası için: aynı insansız kural, farklı estetik — yumuşak doku, su, ışık.
// (Teknoloji b-roll'u kozmetik içeriğin altında yanlış duruyor.)
const SOFT_FOOTAGE = [
  'cream texture macro',
  'serum drop close up',
  'water droplets on glass',
  'silk fabric flowing',
  'sunlight through curtain',
  'marble surface texture',
  'ink in water slow motion',
  'soap bubbles macro',
  'green leaves morning light',
  'oil and water macro',
  'white sand ripples',
  'linen fabric texture',
  'clean bathroom tiles light',
  'flower petals close up',
  'steam rising slow motion',
  'gold glitter particles dark',
  // Makyaj b-roll'ü (2026-07-28): sayfa cilt kimyasının yanında makyaj da anlatıyor.
  // Hepsi YÜZSÜZ — sayfa faceless; ürün/doku çekimi, model değil.
  'makeup brushes flat lay',
  'lipstick close up macro',
  'loose powder texture macro',
  'liquid foundation swatch',
  'cosmetic bottles soft light',
  'mascara brush macro',
  'compact powder pressed texture',
  'nail polish drop macro',
  // EL ÇEKİMLERİ (2026-08-09): `hands` engeli kaldırıldıktan sonra açıldı. Güzellik
  // nişinde en çok işleyen çekim türü bu — ürünün KULLANILDIĞI an, yüz olmadan.
  // Hepsi hâlâ yüzsüz: kadraja el ve ürün giriyor, model girmiyor.
  'hands applying cream close up',
  'hand holding serum dropper',
  'hands rubbing lotion macro',
  'hand pumping bottle close up',
  'fingers touching cream texture',
  'hand opening jar macro',
];


// @etiket.kodu için: giyim/kumaş estetiği. Aynı YÜZSÜZ kural — kumaş, dikiş, askı, ayakkabı,
// alışveriş nesneleri. Model/manken YOK: sayfa faceless ve stok "moda" kliplerinin çoğunda
// insan var, bu yüzden liste bilinçli olarak doku/nesne çekimlerinden kuruldu.
const FABRIC_FOOTAGE = [
  'folded clothes stack close up',
  'clothing rack hangers minimal',
  'denim fabric texture macro',
  'knitted wool texture macro',
  'cotton fabric weave macro',
  'silk fabric flowing',
  'linen fabric texture',
  'sewing machine stitching close up',
  'thread spools close up',
  'zipper macro detail',
  'button on fabric macro',
  'clothing label tag close up',
  'washing machine drum spinning',
  'laundry detergent pouring close up',
  'clothes drying on line',
  'iron pressing fabric steam',
  'leather texture macro',
  'shoe sole close up',
  'sneakers on plain background',
  'handbag on plain surface',
  'jewelry on dark surface macro',
  'shopping bags flat lay',
  'cardboard parcel box close up',
  'price tag close up macro',
  'measuring tape and fabric',
  'wardrobe interior minimal',
  'fabric dye in water macro',
  'marble surface texture',
  // EL ÇEKİMLERİ (2026-08-09) — bkz. SOFT_FOOTAGE'daki not. Kumaşa dokunan el,
  // etiketi okuyan el: yüzsüz kalırken "biri bunu yaşıyor" hissi veriyor.
  'hands folding clothes close up',
  'hand touching fabric texture',
  'hands sorting laundry close up',
  'hand holding clothing label',
  'hands opening parcel box',
];

// @kizlar.kodu merak açığı ekseni (docs/plan/kizlarkodu-merak-acigi.md, Faz 1.9): kumaş
// makrosu DEĞİL, günlük hayat çekimleri — yastık/yatak, sabah uyanma, ayna, ev içi. Aynı
// YÜZSÜZ kural: kadraja sadece el/mekân/nesne girer, model/manken YOK.
const GUNLUK_FOOTAGE = [
  'pillow and bed sheets morning light',
  'waking up stretching in bed close up',
  'hand hitting alarm clock morning',
  'hairbrush on hair close up',
  'mirror reflection morning routine',
  'coffee cup steam morning light',
  'sweaty gym towel close up',
  'socks and feet on floor close up',
  'cozy home interior soft light',
  'wardrobe door opening close up',
  'hand washing dishes close up',
  'night lamp warm glow bedroom',
  'window fog condensation morning',
  'hand pulling blanket close up',
  'slippers on wooden floor close up',
  'steam from hot shower bathroom',
];

export const FOOTAGE_SETS = {tech: TECH_FOOTAGE, soft: SOFT_FOOTAGE, fabric: FABRIC_FOOTAGE, gunluk: GUNLUK_FOOTAGE};

/** Marka dosyasındaki footageSet adına göre beyaz liste (varsayılan: tech). */
export function footageSetFor(name = 'tech') {
  return FOOTAGE_SETS[name] ?? TECH_FOOTAGE;
}

// Geriye uyum + varsayılan.
export const SAFE_FOOTAGE_QUERIES = TECH_FOOTAGE;
export const FALLBACK_QUERIES = TECH_FOOTAGE.slice(0, 8);

/** Beyaz listede olmayan sorguyu güvenli bir konuyla değiştir (indeksle deterministik). */
export function toSafeQuery(q, i = 0, list = SAFE_FOOTAGE_QUERIES) {
  const norm = String(q ?? '').trim().toLowerCase();
  const hit = list.find(s => s.toLowerCase() === norm);
  return hit ?? list[i % list.length];
}

// Sorguda insan geçiyorsa kullanma (beyin kuralı çiğnerse ikinci savunma hattı).
// İNSAN ENGELİ — sayfa YÜZSÜZ kalmalı, ama "el" yasak değil.
// 2026-08-09: liste fazla genişti. `hands|typing|working|sitting|thinking|smiling` de
// engelleniyordu; oysa güzellik/bakım nişinde EL ve ÜRÜN makro çekimi (kremi süren el,
// serumu damlatan el) tam da işleyen çekim. Yüz/kişi/kalabalık engeli AYNEN duruyor:
// sayfanın yüzsüz kimliği ondan geliyor, elden değil.
const PEOPLE = /\b(people|person|man|men|woman|women|girl|boy|guy|human|face|portrait|team|developer|programmer|engineer|coder|worker|student|crowd|meeting)\b/i;

export function isPeopleQuery(q) {
  return PEOPLE.test(String(q ?? ''));
}

const STOP = new Set(['the', 'and', 'with', 'from', 'that', 'this', 'your', 'how', 'why', 'what',
  'does', 'work', 'works', 'using', 'into', 'when', 'için', 'nedir', 'nasıl']);

/** Başlıktan makul bir stok-video sorgusu türet (beyin sorgu vermediyse). */
export function queryFromTitle(title = '') {
  const words = String(title).toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const kws = words.filter(w => w.length > 2 && !STOP.has(w)).slice(0, 3);
  return kws.length ? `${kws.join(' ')} technology abstract` : FALLBACK_QUERIES[0];
}

/** Dikeye yakın + yeterince uzun mu? (portrait tercih, 1:1'e kadar kabul) */
function usable(w, h, duration) {
  if (duration && duration < MIN_DURATION) return false;
  return h >= 1080 && h >= w * 0.95;
}

async function searchPexels({query, key, fetchFn}) {
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}`
    + '&orientation=portrait&size=medium&per_page=25';
  const r = await fetchFn(url, {headers: {Authorization: key}});
  if (!r.ok) throw new Error(`pexels ${r.status}`);
  const body = await r.json();
  const out = [];
  for (const vid of body.videos ?? []) {
    // Bu video için en iyi dikey dosyayı seç: yükseklik ≥1080, genişlik ≤1400 (aşırı
    // büyük 4K dosyaları indirme süresini şişiriyor).
    let best = null;
    for (const f of vid.video_files ?? []) {
      const w = f.width ?? 0, h = f.height ?? 0;
      if (!usable(w, h, vid.duration) || w > 1400) continue;
      if (!best || w * h > best.width * best.height) best = {width: w, height: h, url: f.link};
    }
    if (best) {
      out.push({...best, provider: 'pexels', id: String(vid.id), duration: vid.duration ?? 0,
        credit: `${vid.user?.name ?? 'Pexels'} (Pexels)`});
    }
  }
  return out;
}

async function searchPixabay({query, key, fetchFn}) {
  const url = `https://pixabay.com/api/videos/?key=${encodeURIComponent(key)}`
    + `&q=${encodeURIComponent(query)}&per_page=30&safesearch=true&order=popular`;
  const r = await fetchFn(url);
  if (!r.ok) throw new Error(`pixabay ${r.status}`);
  const body = await r.json();
  const out = [];
  for (const hit of body.hits ?? []) {
    // Pixabay'de orientation filtresi yok → gelen dosyalardan dikey olanı biz seçiyoruz.
    let best = null;
    for (const f of Object.values(hit.videos ?? {})) {
      const w = f.width ?? 0, h = f.height ?? 0;
      if (!usable(w, h, hit.duration) || w > 1400) continue;
      if (!best || w * h > best.width * best.height) best = {width: w, height: h, url: f.url};
    }
    if (best) {
      out.push({...best, provider: 'pixabay', id: String(hit.id), duration: hit.duration ?? 0,
        credit: `${hit.user ?? 'Pixabay'} (Pixabay)`});
    }
  }
  return out;
}

async function searchCoverr({query, key, fetchFn}) {
  const url = `https://api.coverr.co/videos?query=${encodeURIComponent(query)}`
    + `&urls=true&page_size=20&api_key=${encodeURIComponent(key)}`;
  const r = await fetchFn(url);
  if (!r.ok) throw new Error(`coverr ${r.status}`);
  const body = await r.json();
  const out = [];
  for (const hit of body.hits ?? []) {
    const link = hit.urls?.mp4_download ?? hit.urls?.mp4;
    if (!link) continue;
    const w = hit.width ?? 0, h = hit.height ?? 0;
    // Coverr yatay ağırlıklı: boyut bilinmiyorsa yine de aday say (ffmpeg dikeye kırpıyor),
    // biliniyorsa dikey filtresini uygula.
    if (w && h && !usable(w, h, hit.duration)) continue;
    out.push({width: w || 1080, height: h || 1920, url: link, provider: 'coverr',
      id: String(hit.id ?? link), duration: hit.duration ?? 0,
      credit: `${hit.owner?.name ?? 'Coverr'} (Coverr)`});
  }
  return out;
}

const SEARCHERS = [
  {name: 'pexels', envKey: 'PEXELS_API_KEY', search: searchPexels},
  {name: 'pixabay', envKey: 'PIXABAY_API_KEY', search: searchPixabay},
  {name: 'coverr', envKey: 'COVERR_API_KEY', search: searchCoverr},
];

/** Tek sorgu için tüm sağlayıcılarda ara; ilk sonuç veren kazanır (sıra = kalite tercihi). */
export async function searchClips({query, keys = {}, fetchFn = fetch}) {
  for (const {name, envKey, search} of SEARCHERS) {
    const key = keys[envKey];
    if (!key) continue;
    try {
      const hits = await search({query, key, fetchFn});
      if (hits.length) return hits;
    } catch (e) {
      console.error(`[footage] ${name} "${query}" başarısız: ${e.message}`);
    }
  }
  return [];
}

/**
 * Sorgu listesi için klip indirir.
 * @returns [{path, provider, query, credit}] — hiçbir şey bulunamazsa [].
 */
export async function fetchFootage({
  queries = [], count = 3, outDir, keys = process.env, fetchFn = fetch,
  allowed = SAFE_FOOTAGE_QUERIES,
  pick = arr => arr[Math.floor(Math.random() * arr.length)],
} = {}) {
  // Her sorgu beyaz listeye eşlenir: liste dışı/insanlı sorgu güvenli bir konuyla değişir.
  const requested = (queries.length ? queries : allowed.slice(0, 8)).map((q, i) => {
    const safe = toSafeQuery(q, i, allowed);
    if (safe !== q) console.error(`[footage] "${q}" → "${safe}" (beyaz liste dışı)`);
    return safe;
  });
  const qs = [];
  for (const q of requested) if (!qs.includes(q) && qs.length < count) qs.push(q);
  for (let i = 0; qs.length < count; i++) {
    const q = allowed[(qs.length + i) % allowed.length];
    if (!qs.includes(q)) qs.push(q);
  }

  if (!existsSync(outDir)) mkdirSync(outDir, {recursive: true});
  const seen = new Set();
  const clips = [];

  for (const query of qs.slice(0, count)) {
    const hits = (await searchClips({query, keys, fetchFn}))
      .filter(h => !seen.has(`${h.provider}:${h.id}`))
      .sort((a, b) => b.width * b.height - a.width * a.height);
    if (!hits.length) {
      console.error(`[footage] "${query}" için klip yok`);
      continue;
    }
    // Kalitede ilk TOP_POOL aday arasından rastgele → aynı konu her seferinde farklı klip.
    const chosen = pick(hits.slice(0, TOP_POOL));
    try {
      const res = await fetchFn(chosen.url);
      if (!res.ok) throw new Error(`download ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < MIN_BYTES) throw new Error(`too small (${buf.length}B)`);
      // ⚠ `id` SAĞLAYICI YANITINDAN geliyor ve Coverr'da id yoksa TAM URL'ye düşüyor
      // (searchClips: `String(hit.id ?? link)`). Ham hâlde dosya adına konursa `../` içeren
      // bir değer join()'den sonra render/footage DIŞINA yazar — CI o ağacı commit+push
      // ediyor. Güvenli karakterlere indirgeniyor.
      const guvenliId = String(chosen.id).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40)
        || String(clips.length);
      const path = join(outDir, `clip${clips.length}-${chosen.provider}-${guvenliId}.mp4`);
      writeFileSync(path, buf);
      seen.add(`${chosen.provider}:${chosen.id}`);
      clips.push({path, provider: chosen.provider, query, credit: chosen.credit});
      console.log(`[footage] ✓ ${chosen.provider} "${query}" → ${(buf.length / 1e6).toFixed(1)}MB`);
    } catch (e) {
      console.error(`[footage] indirme başarısız (${chosen.provider} "${query}"): ${e.message}`);
    }
  }
  return clips;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const outDir = fileURLToPath(new URL('../render/footage/', import.meta.url));
  const clips = await fetchFootage({queries: process.argv.slice(2), count: 3, outDir});
  for (const c of clips) console.log(`${c.provider}\t${statSync(c.path).size}\t${c.path}`);
  console.log(`✓ ${clips.length} klip`);
  process.exit(0);
}
