const { chromium } = require('playwright');

const GAS_WEB_APP_URL = process.env.GAS_WEB_APP_URL;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

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
  'サイン会',
  'サイン',
  'チェキ',
  '撮影会',
  'お渡し会',
  'リリイベ',
  'リリースイベント',
  '特典券',
  '参加券',
];

async function main() {
  if (!GAS_WEB_APP_URL) {
    throw new Error('GAS_WEB_APP_URL is not set');
  }

  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set');
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
      if (matchedKeywords.length === 0) continue;

      const postUrl = await extractPostUrl(article);

      console.log('--- keyword matched post ---');
      console.log(`keywords: ${matchedKeywords.join(', ')}`);
      console.log(`link: ${postUrl || target.url}`);
      console.log(text.slice(0, 1200));

      const ai = await analyzePostWithAI({
        account: target.account,
        postUrl: postUrl || target.url,
        text,
        matchedKeywords,
      });

      console.log('--- AI result ---');
      console.log(JSON.stringify(ai, null, 2));

      if (!ai.should_create) {
        console.log('AI judged: skip');
        continue;
      }

      const payload = {
        source: 'x-playwright-ai',
        account: target.account,
        title: ai.calendar_title || makeTitle(text),
        link: postUrl || target.url,
        pubDate: new Date().toISOString(),
        description: text,
        matchedKeywords,
        ai,
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

  await browser.close();
}

async function analyzePostWithAI({ account, postUrl, text, matchedKeywords }) {
  const todayJst = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      input: [
        {
          role: 'system',
          content:
            'あなたは日本のアイドル/イベント告知投稿を解析するアシスタントです。投稿本文から、申込・受付・抽選・チケット販売・サイン会・チェキ会・特典会など、ユーザーがカレンダーで確認すべき内容かを判定します。開催日と申込期限/受付開始日を混同しないでください。',
        },
        {
          role: 'user',
          content: [
            `今日の日付: ${todayJst}（Asia/Tokyo）`,
            `対象アカウント: ${account}`,
            `投稿URL: ${postUrl}`,
            `一次検知キーワード: ${matchedKeywords.join(', ')}`,
            '',
            '以下のX投稿を解析してください。',
            '',
            text,
            '',
            '判断ルール:',
            '- 申込期限、受付期限、応募締切、販売終了、抽選締切が明確なら date_type は deadline。',
            '- 受付開始、先行開始、販売開始、スタートが明確なら date_type は application_start。',
            '- サイン会、チェキ会、撮影会、お渡し会、特典会などの開催日時しか分からない場合は date_type は event_date ではなく manual_check を優先してよい。',
            '- 公演日やツアー初日だけを、申込期限として扱ってはいけません。',
            '- 締切日が本文に見えないが申込/受付開始だけ分かる場合は、calendar_date は開始日、needs_manual_check は true。',
            '- 日付が本文から判断できない場合は、calendar_date は今日の日付、date_type は manual_check、needs_manual_check は true。',
            '- PinnedやShow moreなどのUI文字は無視してください。',
          ].join('\n'),
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'x_post_calendar_judgement',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              should_create: {
                type: 'boolean',
                description: 'カレンダーに登録すべき投稿ならtrue。',
              },
              category: {
                type: 'string',
                enum: [
                  'ticket_application',
                  'ticket_sale',
                  'sign_event',
                  'cheki_event',
                  'benefit_event',
                  'release_event',
                  'live_event',
                  'goods_sale',
                  'media',
                  'other',
                ],
              },
              calendar_title: {
                type: 'string',
                description: 'カレンダーに入れる短いタイトル。80文字以内。',
              },
              calendar_date: {
                type: 'string',
                description: 'YYYY-MM-DD形式。判断不能なら今日の日付。',
              },
              date_type: {
                type: 'string',
                enum: [
                  'deadline',
                  'application_start',
                  'event_date',
                  'manual_check',
                  'none',
                ],
              },
              needs_manual_check: {
                type: 'boolean',
                description: '締切が不明、Show moreの先にありそう、開催日と申込日が紛らわしい場合true。',
              },
              summary: {
                type: 'string',
                description: '投稿内容の要約。120文字以内。',
              },
              reason: {
                type: 'string',
                description: '日付判定の理由。80文字以内。',
              },
              confidence: {
                type: 'number',
                minimum: 0,
                maximum: 1,
              },
            },
            required: [
              'should_create',
              'category',
              'calendar_title',
              'calendar_date',
              'date_type',
              'needs_manual_check',
              'summary',
              'reason',
              'confidence',
            ],
          },
        },
      },
    }),
  });

  const json = await response.json();

  if (!response.ok) {
    console.error(JSON.stringify(json, null, 2));
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const outputText = json.output
    .flatMap(item => item.content || [])
    .filter(content => content.type === 'output_text')
    .map(content => content.text)
    .join('');

  if (!outputText) {
    console.error(JSON.stringify(json, null, 2));
    throw new Error('OpenAI response output_text is empty');
  }

  return JSON.parse(outputText);
}

async function extractPostUrl(article) {
  const links = await article
    .locator('a')
    .evaluateAll(anchors => anchors.map(a => a.href).filter(Boolean))
    .catch(() => []);

  const statusUrl = links.find(href => href.includes('/status/'));
  return statusUrl || '';
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