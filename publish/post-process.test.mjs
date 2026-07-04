import {test, before} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {postProcess} from './post-process.mjs';

const root = new URL('../', import.meta.url);
const video = fileURLToPath(new URL('render/output/project.mp4', root));
const distDir = fileURLToPath(new URL('dist/', root));
const out = fileURLToPath(new URL('dist/final.mp4', root));
const musicDir = fileURLToPath(new URL('assets/music/', root));
const tone = fileURLToPath(new URL('assets/music/_test_tone.mp3', root));

before(() => {
  mkdirSync(distDir, {recursive: true});
  const mp3 = readdirSync(musicDir).find(f => f.endsWith('.mp3'));
  if (!mp3) {
    // sentetik ton üret
    execFileSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'sine=frequency=220:duration=30',
      '-c:a', 'libmp3lame', tone]);
  }
});

test('produces final mp4 with audio at 1080x1920', () => {
  assert.ok(existsSync(video), 'render first');
  const mp3 = readdirSync(musicDir).find(f => f.endsWith('.mp3'));
  postProcess({videoPath: video, musicPath: join(musicDir, mp3), outPath: out});
  assert.ok(existsSync(out));
  const probe = execFileSync('ffprobe', ['-v', 'error', '-show_entries',
    'stream=codec_type,width,height', '-of', 'default=noprint_wrappers=1', out]).toString();
  assert.match(probe, /width=1080/);
  assert.match(probe, /height=1920/);
  assert.match(probe, /codec_type=audio/);
});
