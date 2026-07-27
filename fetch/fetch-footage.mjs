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
export const SAFE_FOOTAGE_QUERIES = [
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

// Yedek havuz = beyaz listenin bir dilimi (aynı güvence).
export const FALLBACK_QUERIES = SAFE_FOOTAGE_QUERIES.slice(0, 8);

/** Beyaz listede olmayan sorguyu güvenli bir konuyla değiştir (indeksle deterministik). */
export function toSafeQuery(q, i = 0) {
  const norm = String(q ?? '').trim().toLowerCase();
  const hit = SAFE_FOOTAGE_QUERIES.find(s => s.toLowerCase() === norm);
  return hit ?? SAFE_FOOTAGE_QUERIES[i % SAFE_FOOTAGE_QUERIES.length];
}

// Sorguda insan geçiyorsa kullanma (beyin kuralı çiğnerse ikinci savunma hattı).
const PEOPLE = /\b(people|person|man|men|woman|women|girl|boy|guy|human|face|portrait|hands?|team|developer|programmer|engineer|coder|worker|student|crowd|meeting|typing|working|sitting|thinking|smiling)\b/i;

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
  pick = arr => arr[Math.floor(Math.random() * arr.length)],
} = {}) {
  // Her sorgu beyaz listeye eşlenir: liste dışı/insanlı sorgu güvenli bir konuyla değişir.
  const requested = (queries.length ? queries : FALLBACK_QUERIES).map((q, i) => {
    const safe = toSafeQuery(q, i);
    if (safe !== q) console.error(`[footage] "${q}" → "${safe}" (beyaz liste dışı)`);
    return safe;
  });
  const qs = [];
  for (const q of requested) if (!qs.includes(q) && qs.length < count) qs.push(q);
  for (let i = 0; qs.length < count; i++) {
    const q = SAFE_FOOTAGE_QUERIES[(qs.length + i) % SAFE_FOOTAGE_QUERIES.length];
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
      const path = join(outDir, `clip${clips.length}-${chosen.provider}-${chosen.id}.mp4`);
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
