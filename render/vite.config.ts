import {defineConfig} from 'vite';
import motionCanvasImport from '@motion-canvas/vite-plugin';
import ffmpegImport from '@motion-canvas/ffmpeg';

const motionCanvas = (motionCanvasImport as any).default ?? motionCanvasImport;
const ffmpeg = (ffmpegImport as any).default ?? ffmpegImport;

// RENDER_DEV_HOST: WSL'de IPv4 loopback Hyper-V duvarıyla engelli — lokal koşuda '::'
// verilir (IPv6 dinle), CI'da boş kalır (vite varsayılanı). render-runner.mjs aynı env'e bakar.
export default defineConfig({
  plugins: [motionCanvas(), ffmpeg()],
  server: {host: process.env.RENDER_DEV_HOST || undefined},
});
