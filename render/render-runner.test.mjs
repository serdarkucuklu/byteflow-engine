import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const mp4 = fileURLToPath(new URL('./output/project.mp4', import.meta.url));

test('render output exists', () => {
  assert.ok(existsSync(mp4), 'run `npm run render` first');
});

test('render is 1080x1920 h264', () => {
  const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,codec_name', '-of', 'default=noprint_wrappers=1', mp4]).toString();
  assert.match(out, /width=1080/);
  assert.match(out, /height=1920/);
  assert.match(out, /codec_name=h264/);
});
