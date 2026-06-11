const RSS_URLS = [
  'https://nitter.net/CANDY_TUNE_/rss',
  'https://nitter.poast.org/CANDY_TUNE_/rss',
  'https://nitter.privacydev.net/CANDY_TUNE_/rss',
  'https://nitter.tiekoetter.com/CANDY_TUNE_/rss',
  'https://rsshub.app/twitter/user/CANDY_TUNE_',
  'https://openrss.org/twitter.com/CANDY_TUNE_',
  'https://openrss.org/x.com/CANDY_TUNE_',
];

async function main() {
  for (const url of RSS_URLS) {
    console.log('==============================');
    console.log(`URL: ${url}`);

    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/rss+xml, application/xml, text/xml, text/html, */*',
        },
      });

      const text = await res.text();

      console.log(`status=${res.status}`);
      console.log(`length=${text.length}`);
      console.log(`head=${text.slice(0, 500)}`);

      if (res.ok && text.includes('<rss') && text.includes('<item>')) {
        console.log('✅ 使えそう');
      } else {
        console.log('❌ 厳しそう');
      }
    } catch (e) {
      console.log(`ERROR: ${e.message}`);
    }
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});