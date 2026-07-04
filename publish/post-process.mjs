import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Videoya müziği bindirir: müziği video süresine kırpar, giriş/çıkış fade, video kopyalanır.
export function postProcess({videoPath, musicPath, outPath}) {
  const dur = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries',
    'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', videoPath]).toString().trim());
  const fadeOutStart = Math.max(0, dur - 1.2);
  execFileSync('ffmpeg', [
    '-y', '-i', videoPath, '-stream_loop', '-1', '-i', musicPath,
    '-filter_complex', `[1:a]afade=t=in:st=0:d=0.8,afade=t=out:st=${fadeOutStart}:d=1.2,volume=0.35[a]`,
    '-map', '0:v', '-map', '[a]',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
    '-t', String(dur), '-shortest', '-movflags', '+faststart', outPath,
  ], {stdio: 'inherit'});
  return outPath;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [video, music, out] = process.argv.slice(2);
  console.log('✓', postProcess({videoPath: video, musicPath: music, outPath: out}));
}
