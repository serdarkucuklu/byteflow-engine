// Seslendirme — Gemini TTS ile cümle cümle konuşma + KESİN zamanlama.
//
// Neden: 2026 kısa-video verisi net — kazanan formatta ses + yazı birlikte çalışıyor
// (klip'lerin %80'inde altyazı var, %78'i animasyonlu; TikTok artık SESİ de indeksliyor).
// Bizde sadece müzik vardı: izleyici sessiz izlediğinde hiçbir şey "anlatmıyordu".
//
// Mimari kararı: her cümle AYRI sentezlenir. Böylece hizalama modeline (whisper vb.)
// gerek kalmadan her cümlenin süresi ffprobe ile ÖLÇÜLÜR → görsel ritim sesin ritmine
// birebir oturur (ses otorite, görsel ona uyar).
//
// Anahtar zaten var (GEMINI_API_KEY) → ek bağımlılık, ek model indirmesi, ek servis yok.
import {execFileSync} from 'node:child_process';
import {writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {join} from 'node:path';

const MODEL = 'gemini-2.5-flash-preview-tts';
const RATE = 24000;                 // Gemini TTS çıktısı: 24kHz, 16-bit, mono PCM
export const VOICES = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Aoede'];
const GAP = 0.16;                   // cümleler arası nefes payı (sn)

const defaultRun = (bin, args) => execFileSync(bin, args, {stdio: ['ignore', 'pipe', 'pipe']});

/** Ham PCM'i wav'a sarar ve süresini döndürür. */
function pcmToWav({pcm, outPath, run}) {
  writeFileSync(`${outPath}.pcm`, pcm);
  run('ffmpeg', ['-y', '-f', 's16le', '-ar', String(RATE), '-ac', '1', '-i', `${outPath}.pcm`,
    '-c:a', 'pcm_s16le', outPath]);
  return outPath;
}

export function durationOf(path, run = defaultRun) {
  const out = run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=nw=1:nk=1', path]);
  return parseFloat(String(out).trim());
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * TÜM anlatımı TEK çağrıda seslendirir (cümle başına ayrı istek ücretsiz kotayı 429'a
 * sokuyordu — 5. cümlede doğrulandı), sonra sessizliklerden cümle sınırlarını çıkarır.
 * @returns {file, total, phrases:[{text,start,dur}]} | null
 */
export async function synthesizeScript({
  phrases, outDir, apiKey, voice = VOICES[0],
  style = 'Narrate this like a sharp, energetic tech explainer for a 20-second social video. '
    + 'Brisk pace, crisp diction, no dramatic pauses, keep it moving',
  targetSec = 23, maxTempo = 1.3,
  fetchFn = fetch, run = defaultRun, retries = 2,
} = {}) {
  const lines = (phrases ?? []).map(p => String(p).trim()).filter(Boolean);
  if (!apiKey || !lines.length) return null;
  if (!existsSync(outDir)) mkdirSync(outDir, {recursive: true});

  const script = lines.join('\n');
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchFn(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
        {
          method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            contents: [{parts: [{text: `${style}:\n\n${script}`}]}],
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {voiceConfig: {prebuiltVoiceConfig: {voiceName: voice}}},
            },
          }),
        });
      if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);
      const data = await res.json();
      const inline = data?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData;
      if (!inline?.data) throw new Error('TTS ses döndürmedi');
      let file = join(outDir, 'narration.wav');
      pcmToWav({pcm: Buffer.from(inline.data, 'base64'), outPath: file, run});
      let total = durationOf(file, run);

      // SÜRE TAVANI: TTS bazen çok ağır okuyor (ilk canlı koşuda 6 cümle = 35.5s → video 37s,
      // hedef bandın çok üstü). Metni kısaltmak tek başına yetmiyor; burada deterministik
      // olarak tempoyu yükseltiyoruz. 1.3x'e kadar doğal duruyor, üstü cıvıyor.
      if (total > targetSec) {
        const tempo = Math.min(maxTempo, total / targetSec);
        const fast = join(outDir, 'narration-fast.wav');
        run('ffmpeg', ['-y', '-i', file, '-filter:a', `atempo=${tempo.toFixed(3)}`,
          '-c:a', 'pcm_s16le', fast]);
        file = fast;
        total = durationOf(file, run);
        console.log(`[vo] tempo ${tempo.toFixed(2)}x → ${total.toFixed(1)}s`);
      }
      return {file, total, phrases: alignPhrases({file, lines, total, run})};
    } catch (e) {
      console.error(`[vo] deneme ${attempt}: ${e.message}`);
      if (attempt < retries) await sleep(4000 * (attempt + 1));   // 429 dalgasını bekle
    }
  }
  return null;
}

/**
 * Cümle sınırlarını sessizlikten çıkarır; sayı tutmazsa harf uzunluğuna göre orantılar.
 * (Kusursuz hizalama şart değil — altyazı ile ses arasındaki ~0.2sn kayma göze batmıyor;
 *  ama tamamen yanlış bir bölme videoyu desenkron gösterir, o yüzden yedek yol deterministik.)
 */
export function alignPhrases({file, lines, total, run = defaultRun, silenceDb = -32, minSilence = 0.28}) {
  let cuts = [];
  try {
    const out = String(run('ffmpeg', ['-hide_banner', '-i', file,
      '-af', `silencedetect=noise=${silenceDb}dB:d=${minSilence}`, '-f', 'null', '-']));
    const starts = [...out.matchAll(/silence_start:\s*([\d.]+)/g)].map(m => Number(m[1]));
    const ends = [...out.matchAll(/silence_end:\s*([\d.]+)/g)].map(m => Number(m[1]));
    // her sessizliğin ORTASI = cümle sınırı
    cuts = starts.map((s, i) => (ends[i] != null ? (s + ends[i]) / 2 : s)).filter(t => t > 0.35 && t < total - 0.3);
  } catch {}

  if (cuts.length !== lines.length - 1) {
    // Yedek: konuşma süresini harf sayısına göre paylaştır.
    const weights = lines.map(l => Math.max(l.length, 8));
    const sum = weights.reduce((a, b) => a + b, 0);
    let t = 0;
    cuts = weights.slice(0, -1).map(w => (t += (w / sum) * total));
  }

  const bounds = [0, ...cuts, total];
  return lines.map((text, i) => ({
    text,
    start: Math.round(bounds[i] * 1000) / 1000,
    dur: Math.round((bounds[i + 1] - bounds[i]) * 1000) / 1000,
  }));
}

/**
 * Anlatım parçasını videonun ses yatağı hâline getirir: başta kısa nefes, sonda kapanış payı.
 * @returns {path, beats: [{text, start, dur}], total} — beat'ler GÖRSEL zamanlamayı belirler.
 */
export function buildVoiceTrack({narration, outPath, leadIn = 0.35, tailSec = 1.1, run = defaultRun}) {
  if (!narration?.phrases?.length) return null;
  run('ffmpeg', ['-y', '-i', narration.file,
    '-af', `adelay=${Math.round(leadIn * 1000)}|${Math.round(leadIn * 1000)},apad=pad_dur=${tailSec}`,
    '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', outPath]);
  const total = Math.round((narration.total + leadIn + tailSec) * 1000) / 1000;
  const beats = narration.phrases.map((p, i) => ({
    text: p.text,
    start: Math.round((p.start + leadIn) * 1000) / 1000,
    // son cümle kapanış payını da tutar (video sesle birlikte bitmesin, nefes alsın)
    dur: Math.round((p.dur + (i === narration.phrases.length - 1 ? tailSec : 0)) * 1000) / 1000,
  }));
  return {path: outPath, beats, total};
}

/** Seslendirme + müzik → tek ses parçası (müzik konuşmanın ALTINDA kalır). */
export function mixVoiceAndMusic({voicePath, musicPath, outPath, total, run = defaultRun}) {
  const fadeOut = Math.max(0.1, total - 1.6);
  const fc = [
    `[1:a]volume=0.16,afade=t=in:st=0:d=1.0,afade=t=out:st=${fadeOut.toFixed(2)}:d=1.5[bed]`,
    `[0:a]volume=1.0,dynaudnorm=f=200:g=5[vo]`,
    `[vo][bed]amix=inputs=2:duration=first:dropout_transition=0,loudnorm=I=-14:TP=-1.5:LRA=11[out]`,
  ].join(';');
  run('ffmpeg', ['-y', '-i', voicePath, '-stream_loop', '-1', '-i', musicPath,
    '-filter_complex', fc, '-map', '[out]', '-t', String(total),
    '-c:a', 'pcm_s16le', outPath]);
  return outPath;
}
