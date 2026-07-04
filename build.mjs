import {execFileSync} from 'node:child_process';
import {readFileSync, copyFileSync, mkdirSync, readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {validateSpec} from './brain/validate.mjs';
import {postProcess} from './publish/post-process.mjs';

const root = new URL('./', import.meta.url);
const specPath = process.argv[2] ?? fileURLToPath(new URL('scene-spec.example.json', root));

// 1. Doğrula
const spec = JSON.parse(readFileSync(specPath));
const {valid, errors} = validateSpec(spec);
if (!valid) { console.error('✗ invalid spec:\n' + errors.join('\n')); process.exit(1); }
console.log('✓ spec valid:', spec.title);

// 2. render'a kopyala
copyFileSync(specPath, fileURLToPath(new URL('render/scene-spec.json', root)));

// 3. render (sessiz mp4)
execFileSync('npm', ['run', 'render'], {cwd: fileURLToPath(new URL('render/', root)), stdio: 'inherit', shell: true});

// 4. müzik seç + post-process
const musicDir = fileURLToPath(new URL('assets/music/', root));
const mp3 = readdirSync(musicDir).find(f => f.endsWith('.mp3') && !f.startsWith('_'));
if (!mp3) { console.error('✗ assets/music içine bir .mp3 koy'); process.exit(1); }
mkdirSync(fileURLToPath(new URL('dist/', root)), {recursive: true});
const out = postProcess({
  videoPath: fileURLToPath(new URL('render/output/project.mp4', root)),
  musicPath: musicDir + '/' + mp3,
  outPath: fileURLToPath(new URL('dist/final.mp4', root)),
});
console.log('✓ done:', out);
