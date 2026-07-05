// Facebook Page'e video cross-post (feed video). System User token'dan page token türetir.
const G = 'https://graph.facebook.com/v21.0';

async function getPage(userToken, pageId) {
  const d = await (await fetch(`${G}/me/accounts?fields=id,access_token&access_token=${userToken}`)).json();
  if (d.error) throw new Error(d.error.message);
  const p = (d.data || []).find(x => x.id === pageId) || d.data?.[0];
  if (!p?.access_token) throw new Error('page access token bulunamadı');
  return p;
}

export async function publishFacebookVideo({userToken, pageId, videoUrl, description}) {
  const page = await getPage(userToken, pageId);
  const res = await fetch(`${G}/${page.id}/videos`, {
    method: 'POST',
    body: new URLSearchParams({file_url: videoUrl, description, access_token: page.access_token}),
  });
  const d = await res.json();
  if (d.error) throw new Error(`${d.error.code}: ${d.error.message}`);
  return d.id; // video id
}
