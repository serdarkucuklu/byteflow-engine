// Çok-platform yayın: IG Reel + ilk yorum(hashtag) + Story, Facebook, (Threads varsa).
// Kullanım: node --env-file=.env publish/publish-latest.mjs <videoUrl> [specPath]
import {readFileSync, writeFileSync} from 'node:fs';
import {publishReel, publishStory, postComment} from './instagram-publish.mjs';
import {publishFacebookVideo} from './facebook-publish.mjs';
import {publishThread} from './threads-publish.mjs';
import {loadBrand, credentials} from '../brands/load.mjs';

const brand = loadBrand();
const cred = credentials(brand);
const videoUrl = process.argv.slice(2).find(a => !a.startsWith('--'));
const specPath = process.argv.slice(3).find(a => !a.startsWith('--')) ?? brand.paths.spec;
if (!videoUrl) throw new Error('videoUrl arg gerekli');

const spec = JSON.parse(readFileSync(specPath));
const hashtags = spec.hashtags.join(' ');
// Etiketler ARTIK açıklamanın içinde (Serdar, 2026-07-27). Önceden yalnızca ilk yorumdaydı;
// açıklamadaki etiketler hem keşif/arama tarafında hem de ekran görüntüsü paylaşımında görünür.
const caption = `${spec.caption}\n\n${hashtags}`;
const fullCaption = caption;                        // FB/Threads ile aynı metin
const IG = {igUserId: cred.igUserId, token: cred.igToken};
if (!IG.igUserId || !IG.token) throw new Error(`${brand.slug}: Instagram secret'ları eksik`);
console.log(`▶ yayınlanıyor [${brand.slug} ${brand.handle}]:`, spec.title);

// 1) Instagram Reel (zorunlu — hata verirse tüm akış başarısız)
// thumbOffset (ms): kapak karesi = tam-diyagram anı (run-daily hesaplar, spec'e yazar)
const reelId = await publishReel({...IG, videoUrl, caption, thumbOffset: spec.thumbOffset, onStatus: s => console.log('  ·', s)});
console.log('✓ INSTAGRAM REEL —', reelId);

// mediaId'yi geçmişin son kaydına işaretle — insights backfill (bir sonraki koşu) bulsun.
try {
  const histPath = brand.paths.history;
  const hist = JSON.parse(readFileSync(histPath));
  if (hist.length) {
    hist[hist.length - 1].mediaId = reelId;
    hist[hist.length - 1].postedAt = new Date().toISOString();
    writeFileSync(histPath, JSON.stringify(hist, null, 2));
    console.log('✓ mediaId geçmişe yazıldı');
  }
} catch (e) { console.error('⚠ history mediaId yazılamadı:', e.message); }

// 2) İlk yorum: etiketler açıklamaya taşındığı için burada TEKRAR edilmiyor (spam görünür).
//    Bunun yerine kaydetmeye/paylaşmaya çağıran kısa bir not — etkileşim sinyali için.
try {
  await postComment({mediaId: reelId, token: IG.token,
    message: `Kaydet, lazım olacak. ${spec.hashtags.slice(0, 3).join(' ')}`});
  console.log('✓ ilk yorum (CTA)');
} catch (e) { console.error('⚠ ilk yorum atlandı:', e.message); }

// 3) Story'e de at (24s erişim) — best-effort
try {
  const storyId = await publishStory({...IG, videoUrl, onStatus: s => console.log('  ·', s)});
  console.log('✓ INSTAGRAM STORY —', storyId);
} catch (e) { console.error('⚠ Story atlandı:', e.message); }

// 4) Facebook cross-post — best-effort
if (cred.fbPageId) {
  try {
    const fbId = await publishFacebookVideo({userToken: IG.token, pageId: cred.fbPageId, videoUrl, description: fullCaption});
    console.log('✓ FACEBOOK —', fbId);
  } catch (e) { console.error('⚠ Facebook atlandı:', e.message); }
}

// 5) Threads — token varsa (ayrı Threads API), best-effort
if (cred.threadsUserId && cred.threadsToken) {
  try {
    const thId = await publishThread({
      userId: cred.threadsUserId, token: cred.threadsToken,
      videoUrl, text: `${caption}\n\n${hashtags}`, onStatus: s => console.log('  ·', s),
    });
    console.log('✓ THREADS —', thId);
  } catch (e) { console.error('⚠ Threads atlandı:', e.message); }
} else {
  console.log('· Threads atlandı (THREADS_USER_ID/THREADS_TOKEN yok)');
}
