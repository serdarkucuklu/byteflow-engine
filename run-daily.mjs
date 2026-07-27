import {writeFileSync, readFileSync, mkdirSync, readdirSync, existsSync, rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {fetchTrends, feedsFor} from './fetch/fetch-trends.mjs';
import {fetchFootage, queryFromTitle, footageSetFor} from './fetch/fetch-footage.mjs';
import {produceSpec} from './brain/produce-spec.mjs';
import {stripMarkdown} from './brain/sanitize.mjs';
import {localizeSpec} from './brain/localize.mjs';
import {postProcess} from './publish/post-process.mjs';
import {composeFootageVideo, countFrames, findFramesDir} from './publish/compose-footage.mjs';
import {synthesizeScript, buildVoiceTrack, mixVoiceAndMusic, VOICES} from './publish/voiceover.mjs';
import {pillarsFor, selectPillar} from './brain/pillars.mjs';
import {loadBrand} from './brands/load.mjs';
import {aggregate, pickWeighted, leaderboard} from './brain/scoreboard.mjs';

const root = fileURLToPath(new URL('./', import.meta.url));
const apiKey = process.env.GEMINI_API_KEY;

// MARKA: kimlik, konu havuzu, kaynaklar, seed'ler, ses ve durum dosyaları buradan gelir.
// Yeni sayfa açmak = brands/<slug>.json + kendi secret'ları (kod çatallamak YOK).
const brand = loadBrand();
// Marka durum dosyalarının dizini repoda olmayabilir (git boş dizin tutmuyor) — canlı
// koşuda ENOENT ile düştü. Yazmadan önce garanti et.
for (const p of [brand.paths.spec, brand.paths.history]) mkdirSync(dirname(p), {recursive: true});
const PILLARS = pillarsFor(brand.pillarSet);
console.log(`▣ marka: ${brand.slug} (${brand.handle})`);

// render/src/lib/spec.ts ile SENKRON tutulmalı — tema rotasyonu için.
const THEMES = brand.themes;

function randomSeed(seeds) {
  return seeds[Math.floor(Math.random() * seeds.length)];
}

// Yayın geçmişi — konu tekrarını önle + layout/tema rotasyonunu belirle.
const historyPath = brand.paths.history;
const history = existsSync(historyPath) ? JSON.parse(readFileSync(historyPath)) : [];
const recentTitles = history.slice(-15).map(h => h.title);

const candidates = await fetchTrends({limit: 15, feeds: feedsFor(brand.feedSet)});
console.log(`✓ ${candidates.length} trends`);

// Pillar rotasyonu: son (PILLARS.length-1) postun pillar'ını atla (niş içi çeşitlilik).
// %75 kuralı: history.length'e göre 4 postta 3'ü timely (güncel özellik/model haberi) pillar'dan seçilir.
const recentPillars = history.slice(-(PILLARS.length - 1)).map(h => h.pillar).filter(Boolean);
// GERİ BESLEME: yayınlanmış postların gerçek performansı konu seçimini etkiliyor.
const pillarStats = aggregate(history, 'pillar');
console.log('★ skor tablosu:');
console.log(leaderboard(history));
// DİKKAT: pillar havuzu MARKADAN gelir. 5. argüman geçilmezse modülün varsayılan AI havuzu
// kullanılıyordu ve cilt bakımı markası 'model-releases' konusu üretmişti (canlı görüldü).
const pillar = selectPillar(recentPillars, history.length, pillarStats,
  (cands, st) => pickWeighted(cands, st), PILLARS);
console.log(`✓ pillar: ${pillar.key}${pillar.timely ? ' (timely)' : ''}` +
  (pillarStats.groups.get(pillar.key) ? ` [skor ${pillarStats.groups.get(pillar.key).score}]` : ' [veri yok]'));

// TEST KANCASI: BYTEFLOW_SPEC verilirse beyin/çeviri atlanır ve o spec render edilir.
// Yeni sahne şablonlarını (ör. versus) gerçek render'da doğrulamak için — şablonun bozuk
// olduğunu YAYIN GÜNÜ öğrenmek kabul edilemez.
const fixturePath = process.env.BYTEFLOW_SPEC;

const seeds = JSON.parse(readFileSync(brand.paths.seeds, 'utf8'));
// Beyin, markanın b-roll beyaz listesini de görsün (yoksa teknoloji sorguları öneriyordu).
const brandForBrain = {...brand, footageQueries: footageSetFor(brand.footageSet)};
const {spec: rawSpec, source} = fixturePath
  ? {spec: JSON.parse(readFileSync(join(root, fixturePath), 'utf8')), source: 'fixture'}
  : await produceSpec({candidates, apiKey, recentTitles, pillar, brand: brandForBrain, seeds, pickSeed: randomSeed});
// Ekrandaki metinlerde markdown vurgusu kalmasın ("your *real* safety net" yıldızlarıyla basılıyordu).
// YERELLEŞTİRME: prompt'a "Türkçe yaz" demek yetmedi (model üç koşuda da İngilizce yazdı).
// Ayrı, dar kapsamlı bir çeviri adımı yapıyı bozmadan metinleri hedef dile çeviriyor.
const localized = fixturePath ? rawSpec : await localizeSpec({spec: rawSpec, language: brand.language, apiKey});
const spec = stripMarkdown(localized);

// Görsel çeşitlilik: ardışık videolar aynı tema olmasın (deterministik rotasyon).
// Layout'u BEYİN seçer (konsepti en iyi öğreten kompozisyon: flow/stack/hub/cycle) —
// eksik/geçersizse deterministik rotasyona düş. Koreografi tek: 'buildup'.
const LAYOUTS = ['nodes-flow', 'vertical-stack', 'hub-spoke', 'cycle']; // render/src/lib/spec.ts ile senkron
const n = history.length;
const theme = THEMES[(n * 5 + 1) % THEMES.length]; // *5: eski layout rotasyonuyla senkron olmasın diye kalan ofset
const motion = 'buildup';                           // tek koreografi (kademeli kurulum)
spec.theme = theme;
spec.brand = {handle: brand.handle, signoff: brand.persona?.signoff ?? '',
  shareCta: brand.persona?.shareCta ?? ''};
if (brand.palette) spec.palette = brand.palette;
if (brand.language) spec.language = brand.language;
spec.motion = motion;
spec.scenes.forEach((sc, i) => {
  if (!LAYOUTS.includes(sc.layout)) sc.layout = LAYOUTS[(n + i) % LAYOUTS.length];
});
const layout = spec.scenes.map(sc => sc.kind === 'code' ? 'code' : sc.layout).join('+');
console.log(`✓ spec (${source}): ${spec.title} [${layout} / ${motion} / ${theme}]`);

// ---- B-roll: gerçek hareketli görüntü indir (Pexels/Pixabay/Coverr) ----
// Klip inebildiyse spec.footage=true → sahne ŞEFFAF (alpha PNG) render edilir ve
// ffmpeg diyagramı footage'ın üstüne bindirir. İnemezse eski düz arka planlı akış aynen sürer.
// Artık 2 klip yetiyor: b-roll sadece AÇILIŞ ve KAPANIŞ'ta; öğretici gövde
// tasarlanmış sade zeminde (bkz. publish/compose-footage.mjs planSegments).
const FOOTAGE_CLIPS = 2;
const footageDir = join(root, 'render', 'footage');
if (existsSync(footageDir)) rmSync(footageDir, {recursive: true, force: true});

const queries = (Array.isArray(spec.footage_queries) ? spec.footage_queries : [])
  .map(q => String(q).trim()).filter(Boolean).slice(0, FOOTAGE_CLIPS);
if (!queries.length) queries.push(queryFromTitle(spec.title));

let clips = [];
if (process.env.BYTEFLOW_FOOTAGE === '0') {
  console.log('• footage kapalı (BYTEFLOW_FOOTAGE=0) → düz arka plan');
} else {
  try {
    clips = await fetchFootage({queries, count: FOOTAGE_CLIPS, outDir: footageDir,
      allowed: footageSetFor(brand.footageSet)});
  } catch (e) {
    console.error(`⚠ footage indirilemedi: ${e.message}`);
  }
}
spec.footage = clips.length > 0;
console.log(spec.footage
  ? `✓ footage: ${clips.length} klip [${clips.map(c => c.provider).join(', ')}]`
  : '• footage yok → düz arka plan (klasik render)');

// ---- Seslendirme: anlatım cümleleri → ses + ÖLÇÜLEN zamanlama ----
// Kısa-video verisi net: kazanan formatta ses + altyazı birlikte çalışıyor, TikTok sesi de
// indeksliyor. Ses BAŞARISIZ olursa video sessiz-müzikli eski hâline düşer (akış kırılmaz).
const voDir = join(root, 'dist', '_vo');
if (existsSync(voDir)) rmSync(voDir, {recursive: true, force: true});

let voice = null, voiceName = null;
if (process.env.BYTEFLOW_VOICE === '0') {
  console.log('• seslendirme kapalı (BYTEFLOW_VOICE=0)');
} else {
  try {
    // Ses tonu: ölçüm varsa tutan sesi daha sık kullan, yoksa sırayla dön.
    const voiceStats = aggregate(history, 'voice');
    const voices = brand.narrationVoices ?? VOICES;
    const picked = voiceStats.sampleSize >= 3
      ? pickWeighted(voices, voiceStats)
      : voices[history.length % voices.length];
    const style = brand.language === 'tr'
      ? 'Türkçe, sıcak ve net bir anlatıcı tonuyla oku. Akıcı tempo, abartısız, doğal vurgu'
      : undefined;
    const narration = await synthesizeScript({phrases: spec.narration, outDir: voDir, apiKey,
      voice: picked, ...(style ? {style} : {})});
    if (narration) {
      voice = buildVoiceTrack({narration, outPath: join(voDir, 'voice.wav')});
      spec.beats = voice.beats;
      voiceName = picked;
      console.log(`✓ seslendirme (${picked}): ${voice.beats.length} cümle, ${voice.total.toFixed(1)}s`);
    } else {
      console.log('• seslendirme üretilemedi → sessiz/müzikli akış');
    }
  } catch (e) {
    console.error(`⚠ seslendirme hatası: ${e.message}`);
  }
}

const specPath = brand.paths.spec;
writeFileSync(specPath, JSON.stringify(spec, null, 2));
writeFileSync(join(root, 'render', 'scene-spec.json'), JSON.stringify(spec, null, 2));

// Geçmişe ekle (workflow posted-history.json'ı commit eder).
history.push({title: spec.title, pillar: spec.pillar ?? pillar.key, layout, motion, theme, source,
  footage: spec.footage ? clips.map(c => `${c.provider}:${c.query}`) : null,
  voice: voice ? voice.beats.length : null,
  voiceName,
  date: new Date().toISOString().slice(0, 10)});
writeFileSync(historyPath, JSON.stringify(history, null, 2));

// Fail fast on a missing music asset BEFORE the expensive render step, not after.
const musicDir = brand.paths.music;
const mp3 = existsSync(musicDir)
  ? readdirSync(musicDir).find(f => f.endsWith('.mp3') && !f.startsWith('_'))
  : undefined;
if (!mp3) {
  console.error('✗ no usable .mp3 in assets/music/ — add a royalty-free track');
  process.exit(1);
}

execFileSync('npm', ['run', 'render'], {cwd: join(root, 'render'), stdio: 'inherit', shell: true});

mkdirSync(join(root, 'dist'), {recursive: true});

// Footage modunda render mp4 DEĞİL alpha PNG dizisi üretti → önce b-roll'la kompozit et.
// Kare sayısı süreyi belirler (overlay otorite): T = frames / 60.
let renderedVideo = join(root, 'render', 'output', 'project.mp4');
if (spec.footage) {
  const framesDir = findFramesDir(join(root, 'render', 'output'));
  const frames = framesDir ? countFrames(framesDir) : 0;
  if (frames < 60) throw new Error(`alpha PNG dizisi eksik (${frames} kare): ${framesDir}`);
  const tmpDir = join(root, 'dist', '_tmp');
  if (existsSync(tmpDir)) rmSync(tmpDir, {recursive: true, force: true});
  mkdirSync(tmpDir, {recursive: true});
  renderedVideo = composeFootageVideo({
    clips, framesDir, frames, tmpDir, accent: theme,
    outPath: join(tmpDir, 'composited.mp4'),
  });
  console.log(`✓ footage kompoziti: ${frames} kare → ${(frames / 60).toFixed(1)}s`);
}

// Ses yatağı: seslendirme önde, müzik ALTINDA (0.16) — konuşma anlaşılmalı.
let audioPath;
if (voice) {
  try {
    audioPath = mixVoiceAndMusic({
      voicePath: voice.path, musicPath: join(musicDir, mp3),
      outPath: join(voDir, 'mix.wav'), total: voice.total,
    });
  } catch (e) {
    console.error(`⚠ ses karışımı başarısız, müziğe düşülüyor: ${e.message}`);
  }
}

const out = postProcess({
  videoPath: renderedVideo,
  musicPath: join(musicDir, mp3),
  audioPath,
  outPath: join(root, 'dist', 'final.mp4'),
});

// Reel kapak karesi: ilk kare karanlık hook — kapak olarak kötü. thumb_offset'i videonun
// ~%58'ine ayarla (tam-kurulmuş renkli diyagram anı; outro'dan önce). Spec'e yaz →
// publish-latest.mjs bunu publishReel'e geçirir.
try {
  const durSec = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries',
    'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', out]).toString().trim());
  // KAPAK: profil ızgarasında ve Keşfet'te görünen kare. Videonun %58'i diyagramın yarısı
  // kurulmuş hâliydi — merak uyandırmıyor. Artık HOOK ANI: büyük, okunur problem cümlesi +
  // sinematik b-roll. İzleyici daha tıklamadan ne vaat ettiğimizi okuyor.
  const hookPeak = spec.beats?.[0] ? spec.beats[0].start + Math.min(1.1, spec.beats[0].dur * 0.5) : 1.3;
  spec.thumbOffset = Math.round(Math.min(hookPeak, durSec * 0.25) * 1000);
  writeFileSync(specPath, JSON.stringify(spec, null, 2));
  // durSec skor tablosunun PAYDASI (retention = izlenen süre / video süresi) — geçmişe yaz.
  history[history.length - 1].durSec = Math.round(durSec * 10) / 10;
  writeFileSync(historyPath, JSON.stringify(history, null, 2));
  console.log(`✓ kapak: ${spec.thumbOffset}ms (hook anı — ${durSec.toFixed(1)}s videoda)`);
} catch (e) {
  console.error('⚠ thumb_offset hesaplanamadı (kapak varsayılan kalır):', e.message);
}

console.log(`✓ done (${source}): ${out}`);
