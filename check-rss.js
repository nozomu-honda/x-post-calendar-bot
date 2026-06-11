const RSS_URLS = [
  {
    account: 'CANDY_TUNE_',
    url: 'https://nitter.net/CANDY_TUNE_/rss',
  },
];

const GAS_WEB_APP_URL = process.env.GAS_WEB_APP_URL;

const KEYWORDS = [
  '申込',
  '申し込み',
  '受付',
  '応募',
  '抽選',
  '先行',
  '締切',
  '期限',
  'チケット',
  '販売',
  'リセール',
  '特典会',
  '整理券',
];

async function main() {
  if (!GAS_WEB_APP_URL) {
    throw new Error('GAS_WEB_APP_URL is not set');
  }

  for (const target of RSS_URLS) {
    console.log(`Checking: ${target.account} / ${target.url}`);

    const res = await fetch(target.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
    });

    const text = await res.text();

    console.log(`status=${res.status}, length=${text.length}`);

    if (!res.ok || !text.includes('<rss')) {
      console.log('RSS取得失敗 or RSSではありません');
      console.log(text.slice(0, 300));
      continue;
    }

    const items = parseItems(text);

    console.log(`items=${items.length}`);

    for (const item of items) {
      const combinedText = `${item.title}\n${item.description}`;

      const matched = KEYWORDS.some(keyword => combinedText.includes(keyword));
      if (!matched) continue;

      console.log(`Matched: ${item.title}`);

      const payload = {
        source: 'nitter-rss',
        account: target.account,
        title: item.title,
        link: item.link,
        pubDate: item.pubDate,
        description: item.description,
      };

      const postRes = await fetch(GAS_WEB_APP_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const postText = await postRes.text();

      console.log(`POST to GAS: ${postRes.status}`);
      console.log(postText);
    }
  }
}

function parseItems(xml) {
  const itemBlocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => m[1]);

  return itemBlocks.map(block => ({
    title: decodeXml(getTag(block, 'title')),
    link: decodeXml(getTag(block, 'link')),
    pubDate: decodeXml(getTag(block, 'pubDate')),
    description: decodeXml(getTag(block, 'description')),
  }));
}

function getTag(block, tagName) {
  const match = block.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`));
  if (!match) return '';
  return match[1].replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim();
}

function decodeXml(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});