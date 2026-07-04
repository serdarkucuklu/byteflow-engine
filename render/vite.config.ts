import {defineConfig} from 'vite';
import motionCanvasImport from '@motion-canvas/vite-plugin';
import ffmpegImport from '@motion-canvas/ffmpeg';

const motionCanvas = (motionCanvasImport as any).default ?? motionCanvasImport;
const ffmpeg = (ffmpegImport as any).default ?? ffmpegImport;

export default defineConfig({plugins: [motionCanvas(), ffmpeg()]});
