// Instagram yayını — Graph API (FB-login path).
// Reels + Stories publish + ilk yorum (hashtag). container → FINISHED bekle → publish.
const V = 'v21.0';
const G = `https://graph.facebook.com/${V}`;

// Meta'nın GEÇİCİ hata kodları (retry edilebilir): 1/2 = "unexpected error, retry later",
// 4/17/32/341/613 = rate/throttle. Bunlar transient → backoff ile yeniden dene. Kalıcı
// hatalar (190 token, izin, geçersiz param…) TRANSIENT'te DEĞİL → hemen fırlat.
export const TRANSIENT = new Set([1, 2, 4, 17, 32, 341, 368, 613]);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Tek Graph çağrısı; transient hata / ağ hatasında exponential backoff ile yeniden dener.
export async function graphCall(url, init, {retries = 3, baseMs = 2000, fetchFn = fetch} = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    let d;
    try {
      const r = await fetchFn(url, init);
      d = await r.json();
    } catch (e) {                                    // ağ/parse hatası → transient say
      lastErr = e;
      if (attempt === retries) throw e;
      await sleep(baseMs * 2 ** attempt);
      continue;
    }
    if (!d.error) return d;
    const code = d.error.code;
    lastErr = new Error(`${code}/${d.error.error_subcode ?? ''}: ${d.error.message}`);
    if (!TRANSIENT.has(code) || attempt === retries) throw lastErr;  // kalıcı → hemen fırlat
    await sleep(baseMs * 2 ** attempt);              // 2s, 4s, 8s
  }
  throw lastErr;
}

function fbPost(path, params, opts) {
  return graphCall(`${G}/${path}`, {method: 'POST', body: new URLSearchParams(params)}, opts);
}
function fbGet(path, params) {
  return graphCall(`${G}/${path}?${new URLSearchParams(params)}`, {});
}

async function waitContainer(creationId, token, {pollMs = 3000, maxPolls = 60, onStatus} = {}) {
  for (let i = 0; i < maxPolls; i++) {
    const s = await fbGet(`${creationId}`, {fields: 'status_code,status', access_token: token});
    if (s.status_code === 'FINISHED') { onStatus?.('container FINISHED'); return; }
    if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED')
      throw new Error(`container ${s.status_code}: ${s.status ?? ''}`);
    if (i === maxPolls - 1) throw new Error('container hazır olmadı (timeout)');
    await new Promise(r => setTimeout(r, pollMs));
  }
}

// Ortak video publish (REELS veya STORIES).
// thumbOffset (ms): reel kapak karesini bu ana ayarlar (ilk kare karanlık hook olmasın →
// tam-kurulmuş renkli diyagram anı). Verilmezse IG varsayılanı (frame 0) kalır.
async function publishVideo({igUserId, token, videoUrl, caption, mediaType, shareToFeed = true, thumbOffset, onStatus}) {
  if (!igUserId || !token) throw new Error('IG_USER_ID / IG_ACCESS_TOKEN missing');
  const params = {media_type: mediaType, video_url: videoUrl, access_token: token};
  if (caption != null) params.caption = caption;
  if (mediaType === 'REELS') params.share_to_feed = String(shareToFeed);
  if (mediaType === 'REELS' && thumbOffset != null) params.thumb_offset = String(thumbOffset);
  const c = await fbPost(`${igUserId}/media`, params);
  onStatus?.(`${mediaType} container ${c.id} işleniyor…`);
  await waitContainer(c.id, token, {onStatus});
  // media_publish NON-idempotent: postu herkese açık YAPAN çağrı. Container-create + poll'lar
  // güvenle retry edilir (bugünkü transient hata da orada yakalanır), ama media_publish'i
  // transient sonrası KÖR retry etmek çift-post riski taşır (Meta commit edip transient
  // dönebilir). retries:0 → tek deneme; hata olursa gün atlanır ama asla çift Reel olmaz.
  const p = await fbPost(`${igUserId}/media_publish`, {creation_id: c.id, access_token: token}, {retries: 0});
  onStatus?.(`${mediaType} yayınlandı: ${p.id}`);
  return p.id;
}

export function publishReel({igUserId, token, videoUrl, caption, thumbOffset, onStatus}) {
  return publishVideo({igUserId, token, videoUrl, caption, mediaType: 'REELS', thumbOffset, onStatus});
}

export function publishStory({igUserId, token, videoUrl, onStatus}) {
  return publishVideo({igUserId, token, videoUrl, mediaType: 'STORIES', onStatus});
}

// Yayınlanan medyaya yorum (hashtag'leri caption yerine ilk yoruma koymak için).
export async function postComment({mediaId, token, message}) {
  const d = await fbPost(`${mediaId}/comments`, {message, access_token: token});
  return d.id;
}
