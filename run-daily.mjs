import {writeFileSync, readFileSync, mkdirSync, readdirSync, existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {fetchTrends} from './fetch/fetch-trends.mjs';
import {produceSpec} from './brain/produce-spec.mjs';
import {postProcess} from './publish/post-process.mjs';

const root = fileURLToPath(new URL('./', import.meta.url));
const apiKey = process.env.GEMINI_API_KEY;

// render/src/lib/spec.ts ile SENKRON tutulmalı — her video farklı görünsün diye döner.
const LAYOUTS = ['nodes-flow', 'vertical-stack', 'hub-spoke', 'cycle'];
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
const {spec, source} = await produceSpec({candidates, apiKey, recentTitles, pickSeed: randomSeed});

// Görsel çeşitlilik: ardışık videolar aynı layout/tema olmasın (deterministik rotasyon).
const n = history.length;
const layout = LAYOUTS[n % LAYOUTS.length];
const theme = THEMES[(n * 5 + 1) % THEMES.length]; // *5: layout ile senkron olmasın
spec.theme = theme;
for (const sc of spec.scenes) sc.layout = layout;
console.log(`✓ spec (${source}): ${spec.title} [${layout} / ${theme}]`);

const specPath = join(root, 'scene-spec.generated.json');
writeFileSync(specPath, JSON.stringify(spec, null, 2));
writeFileSync(join(root, 'render', 'scene-spec.json'), JSON.stringify(spec, null, 2));

// Geçmişe ekle (workflow posted-history.json'ı commit eder).
history.push({title: spec.title, layout, theme, source, date: new Date().toISOString().slice(0, 10)});
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
