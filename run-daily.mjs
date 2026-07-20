import {writeFileSync, readFileSync, mkdirSync, readdirSync, existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {fetchTrends} from './fetch/fetch-trends.mjs';
import {produceSpec} from './brain/produce-spec.mjs';
import {postProcess} from './publish/post-process.mjs';
import {PILLARS, selectPillar} from './brain/pillars.mjs';

const root = fileURLToPath(new URL('./', import.meta.url));
const apiKey = process.env.GEMINI_API_KEY;

// render/src/lib/spec.ts ile SENKRON tutulmalı — tema rotasyonu için.
const THEMES = ['#58a6ff', '#bc8cff', '#39d3c3', '#f778ba', '#e3b341', '#3fb950'];

function randomSeed(seeds) {
  return seeds[Math.floor(Math.random() * seeds.length)];
}

// Yayın geçmişi — konu tekrarını önle + layout/tema rotasyonunu belirle.
const historyPath = join(root, 'posted-history.json');
const history = existsSync(historyPath) ? JSON.parse(readFileSync(historyPath)) : [];
const recentTitles = history.slice(-15).map(h => h.title);

const candidates = await fetchTrends({limit: 15});
console.log(`✓ ${candidates.length} trends`);

// Pillar rotasyonu: son (PILLARS.length-1) postun pillar'ını atla (niş içi çeşitlilik).
const recentPillars = history.slice(-(PILLARS.length - 1)).map(h => h.pillar).filter(Boolean);
const pillar = selectPillar(recentPillars);
console.log(`✓ pillar: ${pillar.key}`);

const {spec, source} = await produceSpec({candidates, apiKey, recentTitles, pillar, pickSeed: randomSeed});

// Görsel çeşitlilik: ardışık videolar aynı tema olmasın (deterministik rotasyon).
// Layout'u BEYİN seçer (konsepti en iyi öğreten kompozisyon: flow/stack/hub/cycle) —
// eksik/geçersizse deterministik rotasyona düş. Koreografi tek: 'buildup'.
const LAYOUTS = ['nodes-flow', 'vertical-stack', 'hub-spoke', 'cycle']; // render/src/lib/spec.ts ile senkron
const n = history.length;
const theme = THEMES[(n * 5 + 1) % THEMES.length]; // *5: eski layout rotasyonuyla senkron olmasın diye kalan ofset
const motion = 'buildup';                           // tek koreografi (kademeli kurulum)
spec.theme = theme;
spec.motion = motion;
spec.scenes.forEach((sc, i) => {
  if (!LAYOUTS.includes(sc.layout)) sc.layout = LAYOUTS[(n + i) % LAYOUTS.length];
});
const layout = spec.scenes.map(sc => sc.kind === 'code' ? 'code' : sc.layout).join('+');
console.log(`✓ spec (${source}): ${spec.title} [${layout} / ${motion} / ${theme}]`);

const specPath = join(root, 'scene-spec.generated.json');
writeFileSync(specPath, JSON.stringify(spec, null, 2));
writeFileSync(join(root, 'render', 'scene-spec.json'), JSON.stringify(spec, null, 2));

// Geçmişe ekle (workflow posted-history.json'ı commit eder).
history.push({title: spec.title, pillar: spec.pillar ?? pillar.key, layout, motion, theme, source, date: new Date().toISOString().slice(0, 10)});
writeFileSync(historyPath, JSON.stringify(history, null, 2));

// Fail fast on a missing music asset BEFORE the expensive render step, not after.
const musicDir = join(root, 'assets', 'music');
const mp3 = existsSync(musicDir)
  ? readdirSync(musicDir).find(f => f.endsWith('.mp3') && !f.startsWith('_'))
  : undefined;
if (!mp3) {
  console.error('✗ no usable .mp3 in assets/music/ — add a royalty-free track');
  process.exit(1);
}

execFileSync('npm', ['run', 'render'], {cwd: join(root, 'render'), stdio: 'inherit', shell: true});

mkdirSync(join(root, 'dist'), {recursive: true});
const out = postProcess({
  videoPath: join(root, 'render', 'output', 'project.mp4'),
  musicPath: join(musicDir, mp3),
  outPath: join(root, 'dist', 'final.mp4'),
});

// Reel kapak karesi: ilk kare karanlık hook — kapak olarak kötü. thumb_offset'i videonun
// ~%58'ine ayarla (tam-kurulmuş renkli diyagram anı; outro'dan önce). Spec'e yaz →
// publish-latest.mjs bunu publishReel'e geçirir.
try {
  const durSec = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries',
    'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', out]).toString().trim());
  spec.thumbOffset = Math.round(durSec * 1000 * 0.58);
  writeFileSync(specPath, JSON.stringify(spec, null, 2));
  console.log(`✓ kapak thumb_offset: ${spec.thumbOffset}ms (${durSec.toFixed(1)}s videonun %58'i)`);
} catch (e) {
  console.error('⚠ thumb_offset hesaplanamadı (kapak varsayılan kalır):', e.message);
}

console.log(`✓ done (${source}): ${out}`);
