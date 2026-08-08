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
import {readdirSync, existsSync, writeFileSync} from 'node:fs';

export const W = 1080;
export const H = 1920;
export const XF = 0.8;            // xfade süresi (sn)
const PAN_HEADROOM = 1.16;        // pan/zoom için fazladan çerçeve payı

const defaultRun = (bin, args) => execFileSync(bin, args, {stdio: 'inherit'});
const defaultWriteList = (path, body) => writeFileSync(path, body);

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
  if (luma < 25) return Math.round(dim * 0.55 * 100) / 100;
  if (luma < 45) return Math.round(dim * 0.8 * 100) / 100;
  return dim;      // 45 üstü: karartmayı DÜŞÜRME — parlak klipte yazı kayboluyor
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
  const span = total + 2 * xf;   // her koşulda üç segment → iki geçiş

  // ÜÇ BÖLÜM: sinematik giriş (klip) → ÖĞRETİCİ GÖVDE (tasarlanmış sade zemin) → çıkış (klip).
  // Serdar (2026-07-27): "arka plan süper olsa ne, görseller iyi olmadıkça" + "video karmaşık".
  // Gövdede gerçek görüntü diyagramla yarışıyordu; artık orada sakin bir aksan zemini var,
  // b-roll yalnızca açılış ve kapanışta — noktalama işareti gibi.
  const head = Math.min(hook + xf, span * 0.22);
  const tail = Math.min(outro + xf, span * 0.26);
  const body = span - head - tail;
  return {
    durations: [head, body, tail].map(d => Math.max(1.2, d)),
    dims: [0.44, 0.88, 0.52],
    kinds: ['clip', 'surface', 'clip'],
  };
}

// ─── KİNETİK ZEMİN (2026-08-08) ──────────────────────────────────────────────
// planSegments'in ['clip','surface','clip'] düzeni videonun GÖVDESİNİ — yani süresinin
// ~%70'ini — %88 karartılmış, sigma 26 blur'lu, "çok yavaş sürüklenen" bir gradyana
// çeviriyordu. Ölçüm sonucu (publish/retansiyon-denetci.mjs):
//   ciltkodu-latest: canlı kare %1 · en uzun donuk 12,6s · 0,15 olay/sn
// Yani ekran videonun neredeyse tamamında DONUKTU. O düzen, önünde yoğun bir diyagram
// varken doğruydu (footage diyagramla yarışmasın); tek büyük cümleye geçen yeni biçimde
// zemin görüntüyü TAŞIMAK zorunda.
//
// Kinetik düzen: video boyunca ~2s'lik segmentler, aralarında SERT kesme (xfade yok —
// 0,8s'lik geçiş kesmeyi sıvayıp olay sinyalini yok ediyor), her segmentte hissedilir
// kamera hareketi. Açılış rampalı: ilk kesmeler hızlı, sonra ritim oturur.
//
// Ölçülen (proxy 540x960@30, iki gerçek Pexels klibi, 20s):
//   seg 2,0 · dim 0,40 · blur 5 · zoom 1,34 → canlı kare %54 · 4,1 olay/sn · en uzun donuk 2,0s
// Karşılaştırma: eski düzen aynı ölçümde canlı kare %1.
export const KINETIK = {
  seg: 2.0,          // oturmuş segment süresi (sn)
  acilis: [0.9, 1.3], // rampalı açılış — ilk kesme 0,9s'de, ritim hemen görünür
  dim: 0.4,          // siyah scrim (eski gövde: 0,88)
  blur: 6,           // 1080p gblur sigma. 9 idi; scrim'le birlikte dokuyu tamamen
                     // siliyordu (2026-08-09 koşusu). Yazının kontrastı gradyan yastıktan
                     // geliyor, blur'dan değil.
  zoom: 1.34,        // pan/zoom çerçeve payı (eski: 1,16 — hareket hissedilmiyordu)
};

/**
 * Kinetik zeminde scrim İKİ YÖNLÜ ayarlanır.
 *
 * `adaptDim` yalnızca KOYU klipte karartmayı düşürür; parlak klipte hiç dokunmaz — çünkü
 * eski biçimde yazı zaten opak kartların içindeydi, zemin okunabilirliği belirlemiyordu.
 * Kinetik biçimde kart YOK: yazı doğrudan görüntünün üstünde duruyor. İlk kinetik denemede
 * (2026-08-08) beyaz çarşaf kadrajlarında beyaz yazı kayboluyordu. Parlak klipte scrim
 * ARTMALI. Koyu klip davranışı `adaptDim` ile aynı kalır.
 */
export function kinetikDim(base, luma) {
  if (luma == null) return base;
  if (luma < 25) return yuvarla2(base * 0.62);
  if (luma < 45) return yuvarla2(base * 0.84);
  // ⚠ PARLAK KLİPTE ÖLÇÜLÜ ARTIR. İlk sürümde +0,22/+0,13 idi (scrim 0,62/0,53) ve
  // 2026-08-09 gerçek koşusunda kadraj neredeyse siyaha döndü: seçilen dört klibin lumaı
  // 96-142'ydi, hepsi en üst basamağa düştü, blur 9 + vignette ile birleşince b-roll
  // görsel olarak yok oldu. Okunabilirliği zaten YAZININ ARKASINDAKİ radyal gradyan
  // (explainer.tsx → yastik) yerel olarak garantiliyor; buradaki scrim'in işi sadece
  // kadrajın göz almasını engellemek. Bu yüzden artış küçük.
  if (luma > 135) return yuvarla2(Math.min(0.52, base + 0.1));
  if (luma > 95) return yuvarla2(Math.min(0.48, base + 0.05));
  return base;
}
const yuvarla2 = v => Math.round(v * 100) / 100;

/**
 * Kinetik segment planı: rampalı açılış + sabit ritim, hepsi gerçek klip.
 * SAF. `total` videonun toplam süresi.
 */
export function planKinetik({total, clipCount, k = KINETIK}) {
  const n = Math.max(1, clipCount);
  const durations = [];
  let acc = 0;
  for (const d of k.acilis) {
    if (acc + d >= total) break;
    durations.push(d); acc += d;
  }
  while (acc < total - 0.05) {
    const d = Math.min(k.seg, total - acc);
    // Son kırıntı segmenti kendi başına ayakta duramaz → öncekine ekle.
    if (d < 0.6 && durations.length) { durations[durations.length - 1] += d; acc += d; break; }
    durations.push(d); acc += d;
  }
  if (!durations.length) durations.push(total);
  return {
    durations,
    // Klipler sırayla döner; klip sayısı azsa aynı klip tekrar gelir ama YÖN ve
    // kaynak içindeki BAŞLANGIÇ ANI değiştiği için kesme olarak okunur.
    clipIdx: durations.map((_, i) => i % n),
    panDirs: durations.map((_, i) => i % 4),
    seeks: durations.map((_, i) => Math.round(((i * 3.7) % 8) * 100) / 100),
    dims: durations.map(() => k.dim),
  };
}

/** Tek klibi 1080x1920'ye getirir + yavaş kamera hareketi + grade/blur/scrim uygular. */
export function normalizeClip({src, outPath, seconds, panDir = 0, dim = 0.6, fps = 60,
  zoom = PAN_HEADROOM, blur = null, seek = 0, sat = 0.72, run = defaultRun}) {
  const sw = Math.round(W * zoom), sh = Math.round(H * zoom);
  const dx = sw - W, dy = sh - H;
  const t = seconds.toFixed(3);
  // 0=sol→sağ, 1=sağ→sol, 2=yukarı→aşağı, 3=çapraz push — klip başına farklı yön (çeşitlilik).
  const [xe, ye] = panDir === 0 ? [`(${dx})*t/${t}`, `${Math.round(dy / 2)}`]
    : panDir === 1 ? [`${dx}-(${dx})*t/${t}`, `${Math.round(dy / 2)}`]
    : panDir === 2 ? [`${Math.round(dx / 2)}`, `(${dy})*t/${t}`]
    : [`(${dx})*t/${t}`, `(${dy})*t/${t}`];
  // Karartma ne kadar yüksekse blur o kadar güçlü (metin altındaki detay silinsin).
  // Kinetik zeminde blur AÇIKÇA verilir: zemin artık görüntüyü taşıyor, silmiyor.
  const sigma = (blur == null ? 3 + dim * 14 : blur).toFixed(1);
  const vf = [
    `scale=${sw}:${sh}:force_original_aspect_ratio=increase`,
    `crop=${sw}:${sh}`,
    `crop=${W}:${H}:x='${xe}':y='${ye}'`,
    `fps=${fps}`,
    'setsar=1',
    `gblur=sigma=${sigma}`,
    `eq=saturation=${sat}:contrast=1.06`,
    `drawbox=x=0:y=0:w=${W}:h=${H}:color=black@${dim.toFixed(2)}:t=fill`,
    'noise=alls=4:allf=t',
    'vignette',
  ].join(',');
  // -ss girdiden ÖNCE: kaynağın farklı anından başla ki tekrar eden klip aynı kareyi
  // göstermesin (kinetik düzende 2-3 klip 10 segmente dağıtılıyor).
  const seekArgs = seek > 0 ? ['-ss', String(seek)] : [];
  run('ffmpeg', ['-y', ...seekArgs, '-stream_loop', '-1', '-i', src, '-t', String(seconds),
    '-vf', vf, '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20',
    '-r', String(fps), outPath]);
  return outPath;
}

/** Segmentleri SERT kesmeyle birleştirir (kinetik düzen — geçiş yok, olay sinyali korunur). */
export function hardCutChain({clips, outPath, fps = 60, run = defaultRun, writeList}) {
  if (clips.length === 1) {
    run('ffmpeg', ['-y', '-i', clips[0], '-c', 'copy', outPath]);
    return outPath;
  }
  const listPath = `${outPath}.txt`;
  // ffconcat sözdiziminde tek tırnak kaçışı: yol içinde ' olursa satırdan çıkıp ffmpeg'e
  // ek direktif ekletebilir. Bugün yollar içeride üretiliyor (ulaşılamaz), ama savunma ucuz.
  const kacir = (c) => String(c).replace(/'/g, "'\\''");
  for (const c of clips) {
    if (/[\r\n]/.test(String(c))) throw new Error(`concat yolunda satır sonu: ${c}`);
  }
  writeList(listPath, clips.map(c => `file '${kacir(c)}'`).join('\n') + '\n');
  run('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listPath,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-r', String(fps), outPath]);
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
  // EN ÇOK PNG içeren klasörü seç, ilk rastlananı DEĞİL. CI'da output/ tertemiz olduğu için
  // "ilk PNG'li klasör" yetiyordu; geliştirme makinesinde output/ kökünde eski duman testi
  // kareleri duruyor ve BFS render'ın 2727 karesi yerine o 25 artığı seçip koşuyu düşürüyordu.
  // Kare dizisi her zaman en kalabalık klasördür — kıyas tek satırda tuzağı kapatıyor.
  let best = null, bestCount = 0;
  const queue = [root];
  while (queue.length) {
    const dir = queue.shift();
    if (!existsSync(dir)) continue;
    const entries = readdirSync(dir, {withFileTypes: true});
    const pngs = entries.filter(e => e.isFile() && e.name.endsWith('.png')).length;
    if (pngs > bestCount) { best = dir; bestCount = pngs; }
    for (const e of entries) if (e.isDirectory()) queue.push(`${dir}/${e.name}`);
  }
  return best;
}

/**
 * Uçtan uca: klipler + alpha kareler → sessiz kompozit mp4.
 * clips boşsa hareketli gradient arka plana düşer.
 */
export function composeFootageVideo({
  clips, framesDir, frames, tmpDir, outPath, fps = 60, accent = '#58a6ff',
  kinetik = true, run = defaultRun, probe = defaultProbe, writeList = defaultWriteList,
}) {
  const total = frames / fps;
  const usable = clips.length ? clips : [];

  // KİNETİK DÜZEN (varsayılan): video boyunca kısa segment + sert kesme + belirgin hareket.
  // Klip yoksa eski gradient yoluna düşer — akış hiçbir koşulda kırılmaz.
  if (kinetik && usable.length) {
    const plan = planKinetik({total, clipCount: usable.length});
    const lumas = usable.map(c => measureLuma(c.path, probe));
    const segs = plan.durations.map((seconds, i) => {
      const seg = `${tmpDir}/kseg${i}.mp4`;
      const idx = plan.clipIdx[i];
      // İKİ YÖNLÜ scrim: kart olmadığı için okunabilirliği zemin belirliyor.
      const dim = kinetikDim(plan.dims[i], lumas[idx]);
      normalizeClip({
        src: usable[idx].path, outPath: seg, seconds, panDir: plan.panDirs[i],
        dim, zoom: KINETIK.zoom, blur: KINETIK.blur, seek: plan.seeks[i], sat: 0.9, fps, run,
      });
      return seg;
    });
    console.log(`  kinetik zemin: ${segs.length} segment · ortalama ` +
      `${(total / segs.length).toFixed(1)}s · sert kesme`);
    const bgK = `${tmpDir}/bg.mp4`;
    hardCutChain({clips: segs, outPath: bgK, fps, run, writeList});
    return compositeOverlay({bgPath: bgK, framesDir, frames, fps, outPath, run});
  }

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
