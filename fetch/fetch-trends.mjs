import Parser from 'rss-parser';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

export const FEEDS = [
  {url: 'https://hnrss.org/frontpage', source: 'hackernews'},
  {url: 'http://export.arxiv.org/rss/cs.AI', source: 'arxiv-ai'},
  {url: 'http://export.arxiv.org/rss/cs.LG', source: 'arxiv-ml'},
  {url: 'https://www.redhat.com/en/rss/blog', source: 'redhat'},
  {url: 'https://medium.com/feed/tag/software-engineering', source: 'medium-se'},
];

export async function fetchTrends({limit = 20, parser = new Parser()} = {}) {
  const results = [];
  for (const feed of FEEDS) {
    try {
      const parsed = await parser.parseURL(feed.url);
      for (const item of (parsed.items ?? []).slice(0, 8)) {
        if (!item.title) continue;
        results.push({
          title: item.title.trim(),
          summary: (item.contentSnippet ?? item.content ?? '').slice(0, 400),
          link: item.link ?? '',
          source: feed.source,
        });
      }
    } catch (e) {
      console.error(`[fetch] ${feed.source} failed: ${e.message}`);
    }
  }
  return results.slice(0, limit);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = await fetchTrends();
  writeFileSync(new URL('../candidates.json', import.meta.url), JSON.stringify(out, null, 2));
  console.log(`✓ ${out.length} candidates → candidates.json`);
}
