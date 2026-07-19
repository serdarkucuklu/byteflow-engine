import {writeFileSync, readFileSync, mkdirSync, readdirSync, existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {fetchTrends} from './fetch/fetch-trends.mjs';
import {produceSpec} from './brain/produce-spec.mjs';
import {postProcess} from './publish/post-process.mjs';
import {pickMotion} from './render/src/lib/motion-registry.mjs';
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

// Görsel çeşitlilik: ardışık videolar aynı tema/motion olmasın (deterministik rotasyon).
// Layout artık sabit: 'nodes-flow' (dikey kareyi dolduran serpentine dizilim) — tek layout.
const n = history.length;
const layout = 'nodes-flow';
const theme = THEMES[(n * 5 + 1) % THEMES.length]; // *5: eski layout rotasyonuyla senkron olmasın diye kalan ofset
const motion = pickMotion(n).name;                 // bağımsız eksen: animasyon oynatış çeşidi
spec.theme = theme;
spec.motion = motion;
for (const sc of spec.scenes) sc.layout = layout;
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
console.log(`✓ done (${source}): ${out}`);
