import {writeFileSync, mkdirSync, readdirSync, existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {fetchTrends} from './fetch/fetch-trends.mjs';
import {produceSpec} from './brain/produce-spec.mjs';
import {postProcess} from './publish/post-process.mjs';

const root = fileURLToPath(new URL('./', import.meta.url));
const apiKey = process.env.GEMINI_API_KEY;

function randomSeed(seeds) {
  // Math.random burada serbest (CLI, resume yok)
  return seeds[Math.floor(Math.random() * seeds.length)];
}

const candidates = await fetchTrends({limit: 15});
console.log(`✓ ${candidates.length} trends`);
const {spec, source} = await produceSpec({candidates, apiKey, pickSeed: randomSeed});
console.log(`✓ spec (${source}): ${spec.title}`);

const specPath = join(root, 'scene-spec.generated.json');
writeFileSync(specPath, JSON.stringify(spec, null, 2));
writeFileSync(join(root, 'render', 'scene-spec.json'), JSON.stringify(spec, null, 2));

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
