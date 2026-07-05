// Üretilen spec'in caption'ıyla, verilen public video URL'inden IG Reel yayınlar.
// Kullanım: node --env-file=.env publish/publish-latest.mjs <videoUrl> [specPath]
import {readFileSync} from 'node:fs';
import {publishReel} from './instagram-publish.mjs';

const videoUrl = process.argv[2];
const specPath = process.argv[3] ?? new URL('../scene-spec.generated.json', import.meta.url);
if (!videoUrl) throw new Error('videoUrl arg gerekli');

const spec = JSON.parse(readFileSync(specPath));
const caption = `${spec.caption}\n\n${spec.hashtags.join(' ')}`;
console.log('▶ yayınlanıyor:', spec.title);

const id = await publishReel({
  videoUrl,
  caption,
  igUserId: process.env.IG_USER_ID,
  token: process.env.IG_ACCESS_TOKEN,
  onStatus: s => console.log('  ·', s),
});
console.log('✓ PUBLISHED — media id:', id);
