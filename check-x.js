const { chromium } = require('playwright');

const GAS_WEB_APP_URL = process.env.GAS_WEB_APP_URL;

const TARGET_ACCOUNTS = [
  {
    account: 'CANDY_TUNE_',
    url: 'https://x.com/CANDY_TUNE_',
  },
];

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
  'FC',
  '年額会員',
];

async function main() {
  if (!GAS_WEB_APP_URL) {
    throw new Error('GAS_WEB_APP_URL is not set');
  }

  const browser = await chromium.launch({
    headless: true,
  });

  const page = await browser.newPage({
    viewport: {
      width: 1280,
      height: 1000,
    },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  });

  for (const target of TARGET_ACCOUNTS) {
    console.log('==============================');
    console.log(`Account: ${target.account}`);
    console.log(`URL: ${target.url}`);

    await page.goto(target.url, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    await page.waitForTimeout(8000);

    const title = await page.title();
    console.log(`Page title: ${title}`);

    const articles = await page.locator('article').all();
    console.log(`article count: ${articles.length}`);

    for (let i = 0; i < Math.min(articles.length, 10); i++) {
      const article = articles[i];

      const text = await article.innerText().catch(() => '');
      if (!text) continue;

      const matchedKeywords = KEYWORDS.filter(keyword => text.includes(keyword));

      if (matchedKeywords.length === 0) {
        continue;
      }

      const postUrl = await extractPostUrl(article);

      const payload = {
        source: 'x-playwright',
        account: target.account,
        title: makeTitle(text),
        link: postUrl || target.url,
        pubDate: new Date().toISOString(),
        description: text,
        matchedKeywords,
      };

      console.log('--- matched post ---');
      console.log(`keywords: ${matchedKeywords.join(', ')}`);
      console.log(`link: ${payload.link}`);
      console.log(`title: ${payload.title}`);
      console.log(text.slice(0, 1000));

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

  await browser.close();
}

async function extractPostUrl(article) {
  const links = await article.locator('a').evaluateAll(anchors =>
    anchors.map(a => a.href).filter(Boolean)
  ).catch(() => []);

  const statusUrl = links.find(href => href.includes('/status/'));

  if (!statusUrl) return '';

  return statusUrl.replace('https://x.com', 'https://x.com');
}

function makeTitle(text) {
  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  const usefulLine = lines.find(line =>
    !line.includes('@') &&
    !line.match(/^(Pinned|Posts|Replies|Media|Show more)$/)
  );

  if (!usefulLine) return 'X申込関連投稿';

  return usefulLine.slice(0, 80);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});