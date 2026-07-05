// Üretilen spec'in caption'ıyla, verilen public video URL'inden IG Reel yayınlar.
// Kullanım: node --env-file=.env publish/publish-latest.mjs <videoUrl> [specPath]
import {readFileSync} from 'node:fs';
import {publishReel} from './instagram-publish.mjs';
import {publishFacebookVideo} from './facebook-publish.mjs';

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
console.log('✓ INSTAGRAM — media id:', id);

// Facebook cross-post (best-effort: IG başarılıysa akış başarılı sayılır).
if (process.env.FB_PAGE_ID) {
  try {
    const fbId = await publishFacebookVideo({
      userToken: process.env.IG_ACCESS_TOKEN,
      pageId: process.env.FB_PAGE_ID,
      videoUrl,
      description: caption,
    });
    console.log('✓ FACEBOOK — video id:', fbId);
  } catch (e) {
    console.error('⚠ Facebook cross-post atlandı:', e.message);
  }
}
