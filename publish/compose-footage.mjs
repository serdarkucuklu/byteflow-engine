// Footage compositor — stok b-roll klipleri sinematik bir arka plan şeridine çevirir ve
// Motion Canvas'ın şeffaf (alpha PNG) diyagram katmanını üstüne bindirir.
//
// Zincir:  klipler → normalize (dikey kırp + yavaş kamera hareketi + blur + karartma)
//          → xfade zinciri → bg.mp4 → alpha PNG overlay → sessiz mp4 → (müzik: post-process)
//
// Okunabilirlik sözleşmesi: diyagram katmanı ASLA footage'a yenilmez — gövde segmentleri
// güçlü blur + %60 siyah scrim ile "doku" seviyesine indirilir; sadece hook ve outro
// anlarında footage öne çıkar (sinematik giriş/çıkış hissi).
import {execFileSync, spawnSync} from 'node:child_process';
import {readdirSync, existsSync} from 'node:fs';

export const W = 1080;
export const H = 1920;
export const XF = 0.8;            // xfade süresi (sn)
const PAN_HEADROOM = 1.16;        // pan/zoom için fazladan çerçeve payı

const defaultRun = (bin, args) => execFileSync(bin, args, {stdio: 'inherit'});

// ffmpeg'in metadata=print çıktısı stderr'e INFO seviyesinde yazılır → ayrıca yakalıyoruz.
const defaultProbe = (bin, args) => {
  const r = spawnSync(bin, args, {encoding: 'utf8'});
  return `${r.stdout ?? ''}${r.stderr ?? ''}`;
};

/** Klibin ortalama parlaklığı (0-255) — ölçülemezse null. */
export function measureLuma(src, probe = defaultProbe) {
  try {
    const out = probe('ffmpeg', ['-v', 'info', '-i', src,
      '-vf', 'select=not(mod(n\\,90)),signalstats,metadata=print:key=lavfi.signalstats.YAVG',
      '-fps_mode', 'vfr', '-frames:v', '6', '-f', 'null', '-']);
    const vals = [...String(out).matchAll(/YAVG=([\d.]+)/g)].map(m => Number(m[1]));
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  } catch {
    return null;
  }
}

/**
 * Karanlık klipte scrim'i hafiflet. Çok koyu bir b-roll üstüne %52 siyah bindirince kadraj
 * neredeyse düz siyah oluyor ve footage'ın varlığı hissedilmiyor (2026-07-27 3. koşuda
 * "server rack dark room" klibinde görüldü). Parlak klipte karartma aynen kalır.
 */
export function adaptDim(dim, luma) {
  if (luma == null) return dim;
  if (luma < 30) return Math.round(dim * 0.35 * 100) / 100;
  if (luma < 60) return Math.round(dim * 0.6 * 100) / 100;
  if (luma < 90) return Math.round(dim * 0.85 * 100) / 100;
  return dim;
}

/**
 * Segment süreleri + karartma seviyeleri.
 * Hook (ilk ~2.4s) ve outro (son ~3.2s) az karartılır → footage görünür; ortadaki
 * öğretici segmentler ağır karartılır → diyagram okunur.
 */
export function planSegments({total, clipCount, hook = 3.4, outro = 4.2, xf = XF}) {
  const n = Math.max(1, clipCount);
  // xfade her geçişte xf saniye "yer" → görünen süre = sum(durs) - (segment-1)*xf.
  // DİKKAT: span, klip sayısına değil ÜRETİLEN SEGMENT sayısına göre hesaplanır.
  if (n === 1) return {durations: [total], dims: [0.5], kinds: ['clip']};
  if (n === 2) {
    const span2 = total + xf;
    return {durations: [span2 * 0.45, span2 * 0.55], dims: [0.26, 0.42], kinds: ['clip', 'clip']};
  }
  const span = total + 2 * xf;   // üç segment → iki geçiş

  // ÜÇ BÖLÜM: sinematik giriş (klip) → ÖĞRETİCİ GÖVDE (tasarlanmış sade zemin) → çıkış (klip).
  // Serdar (2026-07-27): "arka plan süper olsa ne, görseller iyi olmadıkça" + "video karmaşık".
  // Gövdede gerçek görüntü diyagramla yarışıyordu; artık orada sakin bir aksan zemini var,
  // b-roll yalnızca açılış ve kapanışta — noktalama işareti gibi.
  const head = Math.min(hook + xf, span * 0.22);
  const tail = Math.min(outro + xf, span * 0.26);
  const body = span - head - tail;
  return {
    durations: [head, body, tail].map(d => Math.max(1.2, d)),
    dims: [0.26, 0.86, 0.40],
    kinds: ['clip', 'surface', 'clip'],
  };
}

/** Tek klibi 1080x1920'ye getirir + yavaş kamera hareketi + grade/blur/scrim uygular. */
export function normalizeClip({src, outPath, seconds, panDir = 0, dim = 0.6, fps = 60, run = defaultRun}) {
  const sw = Math.round(W * PAN_HEADROOM), sh = Math.round(H * PAN_HEADROOM);
  const dx = sw - W, dy = sh - H;
  const t = seconds.toFixed(3);
  // 0=sol→sağ, 1=sağ→sol, 2=yukarı→aşağı, 3=çapraz push — klip başına farklı yön (çeşitlilik).
  const [xe, ye] = panDir === 0 ? [`(${dx})*t/${t}`, `${Math.round(dy / 2)}`]
    : panDir === 1 ? [`${dx}-(${dx})*t/${t}`, `${Math.round(dy / 2)}`]
    : panDir === 2 ? [`${Math.round(dx / 2)}`, `(${dy})*t/${t}`]
    : [`(${dx})*t/${t}`, `(${dy})*t/${t}`];
  // Karartma ne kadar yüksekse blur o kadar güçlü (metin altındaki detay silinsin).
  const sigma = (3 + dim * 14).toFixed(1);
  const vf = [
    `scale=${sw}:${sh}:force_original_aspect_ratio=increase`,
    `crop=${sw}:${sh}`,
    `crop=${W}:${H}:x='${xe}':y='${ye}'`,
    `fps=${fps}`,
    'setsar=1',
    `gblur=sigma=${sigma}`,
    'eq=saturation=0.72:contrast=1.06',
    `drawbox=x=0:y=0:w=${W}:h=${H}:color=black@${dim.toFixed(2)}:t=fill`,
    'noise=alls=4:allf=t',
    'vignette',
  ].join(',');
  run('ffmpeg', ['-y', '-stream_loop', '-1', '-i', src, '-t', String(seconds),
    '-vf', vf, '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20',
    '-r', String(fps), outPath]);
  return outPath;
}

/**
 * Öğretici gövdenin zemini: çok yavaş sürüklenen koyu aksan gradyanı + hafif grain.
 * Amaç DİKKAT ÇEKMEK DEĞİL, diyagramı taşımak — donuk düz siyahtan canlı, ama
 * hiçbir detayıyla metinle yarışmayan bir yüzey. (dim yüksekse neredeyse siyaha yakın.)
 */
export function surfaceClip({outPath, seconds, accent = '#58a6ff', dim = 0.86, fps = 60, run = defaultRun}) {
  const hex = accent.replace('#', '');
  const src = `gradients=s=${W}x${H}:c0=0x0d1117:c1=0x${hex}:d=${seconds}:speed=0.06:rate=${fps}`;
  run('ffmpeg', ['-y', '-f', 'lavfi', '-i', src,
    '-vf', [`fps=${fps}`, 'setsar=1', 'gblur=sigma=26',
      `drawbox=x=0:y=0:w=${W}:h=${H}:color=black@${dim.toFixed(2)}:t=fill`,
      'noise=alls=3:allf=t', 'vignette'].join(','),
    '-t', String(seconds), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20',
    '-r', String(fps), outPath]);
  return outPath;
}

/** Hiç klip yoksa son çare: hareketli koyu gradient (donuk kare asla olmasın). */
export function motionBgClip({outPath, seconds, accent = '#58a6ff', fps = 60, run = defaultRun}) {
  return surfaceClip({outPath, seconds, accent, dim: 0.55, fps, run});
}

const TRANSITIONS = ['fade', 'fadeblack', 'smoothleft', 'smoothup', 'circleopen', 'dissolve'];

/** Normalize edilmiş segmentleri xfade ile zincirler. */
export function xfadeChain({clips, durations, outPath, fps = 60, xf = XF, transitions = TRANSITIONS, run = defaultRun}) {
  if (clips.length === 1) {
    run('ffmpeg', ['-y', '-i', clips[0], '-c', 'copy', outPath]);
    return outPath;
  }
  const inputs = clips.flatMap(c => ['-i', c]);
  let fc = '', cur = '[0:v]', cum = durations[0];
  for (let k = 1; k < clips.length; k++) {
    const off = cum - xf;
    const trans = transitions[(k - 1) % transitions.length];
    fc += `${cur}[${k}:v]xfade=transition=${trans}:duration=${xf}:offset=${off.toFixed(3)}[x${k}];`;
    cur = `[x${k}]`;
    cum += durations[k] - xf;
  }
  fc += `${cur}format=yuv420p[v]`;
  run('ffmpeg', ['-y', ...inputs, '-filter_complex', fc, '-map', '[v]',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-r', String(fps), outPath]);
  return outPath;
}

/** Arka plan şeridi + alpha PNG dizisi → sessiz mp4 (süre = kare sayısı/fps, overlay otorite). */
export function compositeOverlay({bgPath, framesDir, frames, fps = 60, outPath, run = defaultRun}) {
  const total = (frames / fps).toFixed(2);
  run('ffmpeg', ['-y', '-i', bgPath, '-framerate', String(fps), '-start_number', '0',
    '-i', `${framesDir}/%06d.png`,
    '-filter_complex', '[0:v][1:v]overlay=0:0:format=auto,format=yuv420p[v]',
    '-map', '[v]', '-t', total,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20',
    '-maxrate', '9M', '-bufsize', '12M', '-r', String(fps),
    '-movflags', '+faststart', outPath]);
  return outPath;
}

/** MC image-sequence çıktısındaki PNG karelerini say. */
export function countFrames(dir) {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter(f => f.endsWith('.png')).length;
}

/**
 * PNG karelerinin GERÇEKTE durduğu dizini bul (BFS). MC sürümüne göre çıktı
 * output/project/ altında düz ya da bir alt klasörde olabiliyor; ffmpeg'e %06d yolunu
 * verirken yanlış dizin = "hiç kare yok" hatası → burada bir kez çözüyoruz.
 */
export function findFramesDir(root) {
  const queue = [root];
  while (queue.length) {
    const dir = queue.shift();
    if (!existsSync(dir)) continue;
    const entries = readdirSync(dir, {withFileTypes: true});
    if (entries.some(e => e.isFile() && e.name.endsWith('.png'))) return dir;
    for (const e of entries) if (e.isDirectory()) queue.push(`${dir}/${e.name}`);
  }
  return null;
}

/**
 * Uçtan uca: klipler + alpha kareler → sessiz kompozit mp4.
 * clips boşsa hareketli gradient arka plana düşer.
 */
export function composeFootageVideo({
  clips, framesDir, frames, tmpDir, outPath, fps = 60, accent = '#58a6ff',
  run = defaultRun, probe = defaultProbe,
}) {
  const total = frames / fps;
  const usable = clips.length ? clips : [];
  const {durations, dims, kinds} = planSegments({total, clipCount: Math.max(usable.length, 1)});
  // Klip başına parlaklık: koyu klipte scrim hafifler, yoksa footage kaybolur.
  const lumas = usable.map(c => measureLuma(c.path, probe));

  const segs = durations.map((seconds, i) => {
    const seg = `${tmpDir}/seg${i}.mp4`;
    // 'surface' = öğretici gövde: gerçek görüntü YOK, tasarlanmış sakin zemin var.
    if (kinds?.[i] === 'surface' || !usable.length) {
      surfaceClip({outPath: seg, seconds, accent, dim: kinds?.[i] === 'surface' ? dims[i] : 0.55, fps, run});
      return seg;
    }
    // Klipler yalnızca açılış/kapanışta: ilki hook, sonuncusu outro.
    const idx = (i === 0 ? 0 : usable.length - 1) % usable.length;
    const dim = adaptDim(dims[i], lumas[idx]);
    if (dim !== dims[i]) {
      console.log(`  segment ${i}: koyu klip (luma ${lumas[idx].toFixed(0)}) → scrim ${dims[i]} → ${dim}`);
    }
    normalizeClip({src: usable[idx].path, outPath: seg, seconds, panDir: i % 4, dim, fps, run});
    return seg;
  });

  const bg = `${tmpDir}/bg.mp4`;
  xfadeChain({clips: segs, durations, outPath: bg, fps, run});
  return compositeOverlay({bgPath: bg, framesDir, frames, fps, outPath, run});
}
