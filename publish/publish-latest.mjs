// Çok-platform yayın: IG Reel + ilk yorum(hashtag) + Story, Facebook, (Threads varsa).
// Kullanım: node --env-file=.env publish/publish-latest.mjs <videoUrl> [specPath]
import {readFileSync, writeFileSync} from 'node:fs';
import {publishReel, publishStory, postComment} from './instagram-publish.mjs';
import {publishFacebookVideo} from './facebook-publish.mjs';
import {publishThread} from './threads-publish.mjs';

const videoUrl = process.argv[2];
const specPath = process.argv[3] ?? new URL('../scene-spec.generated.json', import.meta.url);
if (!videoUrl) throw new Error('videoUrl arg gerekli');

const spec = JSON.parse(readFileSync(specPath));
const caption = spec.caption;                       // temiz caption (hashtag YOK)
const hashtags = spec.hashtags.join(' ');
const fullCaption = `${caption}\n\n${hashtags}`;    // FB/Threads için tam metin
const IG = {igUserId: process.env.IG_USER_ID, token: process.env.IG_ACCESS_TOKEN};
console.log('▶ yayınlanıyor:', spec.title);

// 1) Instagram Reel (zorunlu — hata verirse tüm akış başarısız)
// thumbOffset (ms): kapak karesi = tam-diyagram anı (run-daily hesaplar, spec'e yazar)
const reelId = await publishReel({...IG, videoUrl, caption, thumbOffset: spec.thumbOffset, onStatus: s => console.log('  ·', s)});
console.log('✓ INSTAGRAM REEL —', reelId);

// mediaId'yi geçmişin son kaydına işaretle — insights backfill (bir sonraki koşu) bulsun.
try {
  const histPath = new URL('../posted-history.json', import.meta.url);
  const hist = JSON.parse(readFileSync(histPath));
  if (hist.length) {
    hist[hist.length - 1].mediaId = reelId;
    hist[hist.length - 1].postedAt = new Date().toISOString();
    writeFileSync(histPath, JSON.stringify(hist, null, 2));
    console.log('✓ mediaId geçmişe yazıldı');
  }
} catch (e) { console.error('⚠ history mediaId yazılamadı:', e.message); }

// 2) Hashtag'ler ilk yorumda (temiz caption + daha iyi erişim) — best-effort
try {
  await postComment({mediaId: reelId, token: IG.token, message: hashtags});
  console.log('✓ hashtag ilk yorum');
} catch (e) { console.error('⚠ ilk yorum atlandı:', e.message); }

// 3) Story'e de at (24s erişim) — best-effort
try {
  const storyId = await publishStory({...IG, videoUrl, onStatus: s => console.log('  ·', s)});
  console.log('✓ INSTAGRAM STORY —', storyId);
} catch (e) { console.error('⚠ Story atlandı:', e.message); }

// 4) Facebook cross-post — best-effort
if (process.env.FB_PAGE_ID) {
  try {
    const fbId = await publishFacebookVideo({userToken: IG.token, pageId: process.env.FB_PAGE_ID, videoUrl, description: fullCaption});
    console.log('✓ FACEBOOK —', fbId);
  } catch (e) { console.error('⚠ Facebook atlandı:', e.message); }
}

// 5) Threads — token varsa (ayrı Threads API), best-effort
if (process.env.THREADS_USER_ID && process.env.THREADS_TOKEN) {
  try {
    const thId = await publishThread({
      userId: process.env.THREADS_USER_ID, token: process.env.THREADS_TOKEN,
      videoUrl, text: `${caption}\n\n${hashtags}`, onStatus: s => console.log('  ·', s),
    });
    console.log('✓ THREADS —', thId);
  } catch (e) { console.error('⚠ Threads atlandı:', e.message); }
} else {
  console.log('· Threads atlandı (THREADS_USER_ID/THREADS_TOKEN yok)');
}
