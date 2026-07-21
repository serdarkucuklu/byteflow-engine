import Parser from 'rss-parser';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

// Ürün/özellik duyurusu feed'leri ÖNCE: %75 güncel-içerik kuralının haber kaynağı bunlar
// (yeni model sürümleri, yeni çıkan asistan özellikleri). Round-robin karışımda öncelik alırlar.
export const FEEDS = [
  {url: 'https://techcrunch.com/category/artificial-intelligence/feed/', source: 'techcrunch-ai'},
  {url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', source: 'verge-ai'},
  {url: 'https://blog.google/technology/ai/rss/', source: 'google-ai'},
  {url: 'https://hnrss.org/frontpage', source: 'hackernews'},
  {url: 'http://export.arxiv.org/rss/cs.AI', source: 'arxiv-ai'},
  {url: 'http://export.arxiv.org/rss/cs.LG', source: 'arxiv-ml'},
  {url: 'https://www.redhat.com/en/rss/blog', source: 'redhat'},
  {url: 'https://medium.com/feed/tag/software-engineering', source: 'medium-se'},
];

// agent:false → keep-alive soketi kalmasın (yoksa event loop kapanmıyor, CI adımı asılı kalır).
export async function fetchTrends({limit = 20, parser = new Parser({timeout: 20000, requestOptions: {agent: false}})} = {}) {
  const perFeed = [];
  for (const feed of FEEDS) {
    try {
      const parsed = await parser.parseURL(feed.url);
      const items = [];
      for (const item of (parsed.items ?? []).slice(0, 8)) {
        if (!item.title) continue;
        items.push({
          title: item.title.trim(),
          summary: (item.contentSnippet ?? item.content ?? '').slice(0, 400),
          link: item.link ?? '',
          source: feed.source,
        });
      }
      perFeed.push(items);
    } catch (e) {
      console.error(`[fetch] ${feed.source} failed: ${e.message}`);
    }
  }
  // Round-robin karışım: limit dilimi tek feed'e boğulmasın — her feed'den sırayla 1'er item.
  const results = [];
  for (let i = 0; results.length < limit; i++) {
    let added = false;
    for (const items of perFeed) {
      if (i < items.length) {
        results.push(items[i]);
        added = true;
        if (results.length >= limit) break;
      }
    }
    if (!added) break;
  }
  return results;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = await fetchTrends();
  writeFileSync(new URL('../candidates.json', import.meta.url), JSON.stringify(out, null, 2));
  console.log(`✓ ${out.length} candidates → candidates.json`);
  process.exit(0); // açık kalan feed soketleri süreci asmasın
}
