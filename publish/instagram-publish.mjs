// Instagram yayını — Graph API (FB-login path).
// Reels + Stories publish + ilk yorum (hashtag). container → FINISHED bekle → publish.
const V = 'v21.0';
const G = `https://graph.facebook.com/${V}`;

async function fbPost(path, params) {
  const r = await fetch(`${G}/${path}`, {method: 'POST', body: new URLSearchParams(params)});
  const d = await r.json();
  if (d.error) throw new Error(`${d.error.code}/${d.error.error_subcode ?? ''}: ${d.error.message}`);
  return d;
}
async function fbGet(path, params) {
  const r = await fetch(`${G}/${path}?${new URLSearchParams(params)}`);
  const d = await r.json();
  if (d.error) throw new Error(`${d.error.code}: ${d.error.message}`);
  return d;
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
async function publishVideo({igUserId, token, videoUrl, caption, mediaType, shareToFeed = true, onStatus}) {
  if (!igUserId || !token) throw new Error('IG_USER_ID / IG_ACCESS_TOKEN missing');
  const params = {media_type: mediaType, video_url: videoUrl, access_token: token};
  if (caption != null) params.caption = caption;
  if (mediaType === 'REELS') params.share_to_feed = String(shareToFeed);
  const c = await fbPost(`${igUserId}/media`, params);
  onStatus?.(`${mediaType} container ${c.id} işleniyor…`);
  await waitContainer(c.id, token, {onStatus});
  const p = await fbPost(`${igUserId}/media_publish`, {creation_id: c.id, access_token: token});
  onStatus?.(`${mediaType} yayınlandı: ${p.id}`);
  return p.id;
}

export function publishReel({igUserId, token, videoUrl, caption, onStatus}) {
  return publishVideo({igUserId, token, videoUrl, caption, mediaType: 'REELS', onStatus});
}

export function publishStory({igUserId, token, videoUrl, onStatus}) {
  return publishVideo({igUserId, token, videoUrl, mediaType: 'STORIES', onStatus});
}

// Yayınlanan medyaya yorum (hashtag'leri caption yerine ilk yoruma koymak için).
export async function postComment({mediaId, token, message}) {
  const d = await fbPost(`${mediaId}/comments`, {message, access_token: token});
  return d.id;
}
