const { chromium } = require('playwright');

const TARGET_ACCOUNTS = [
  {
    account: 'CANDY_TUNE_',
    url: 'https://x.com/CANDY_TUNE_',
  },
];

async function main() {
  const browser = await chromium.launch({
    headless: true,
  });

  const page = await browser.newPage({
    viewport: {
      width: 1280,
      height: 900,
    },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  });

  for (const target of TARGET_ACCOUNTS) {
    console.log('==============================');
    console.log(`Account: ${target.account}`);
    console.log(`URL: ${target.url}`);

    try {
      await page.goto(target.url, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });

      await page.waitForTimeout(8000);

      const title = await page.title();
      console.log(`Page title: ${title}`);

      const bodyText = await page.locator('body').innerText({
        timeout: 10000,
      });

      console.log('----- body head -----');
      console.log(bodyText.slice(0, 3000));
      console.log('----- body end -----');

      const articles = await page.locator('article').all();

      console.log(`article count: ${articles.length}`);

      for (let i = 0; i < Math.min(articles.length, 5); i++) {
        const text = await articles[i].innerText().catch(() => '');
        console.log(`----- article ${i + 1} -----`);
        console.log(text.slice(0, 1500));
      }
    } catch (e) {
      console.log(`ERROR: ${e.message}`);
    }
  }

  await browser.close();
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});