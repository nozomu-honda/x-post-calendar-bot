# x-post-calendar-bot

X/Twitter の特定アカウント投稿を GitHub Actions + Playwright で監視し、申込・受付・チケット販売・サイン会・チェキ会・特典会などの告知を検知して、OpenAI API で日付や受付期間を判定し、Google Apps Script Web App 経由で Google カレンダーへ登録する Bot です。

CANDY TUNE / KAWAII LAB. 関連の申込期限・受付期間・特典会情報の見落とし防止を目的にしています。

## 現在の構成

```text
GitHub Actions
  ↓ 30分ごとに起動
Playwright
  ↓
Xの対象アカウントページを開く
  ↓
プロフィールをスクロールして投稿を取得
  ↓
Pinned投稿をスキップ
  ↓
キーワード一致した投稿だけ個別投稿URLを開いて全文取得
  ↓
OpenAI APIで申込期限・受付期間・要確認種別をJSON判定
  ↓
Google Apps Script Web AppへPOST
  ↓
Googleカレンダーへ終日予定/期間予定として登録
```

## 主なファイル

| ファイル | 役割 |
|---|---|
| `check-x.js` | X投稿取得、キーワード判定、個別投稿全文取得、AI判定、GASへのPOST |
| `.github/workflows/check-x.yml` | GitHub Actions の定期実行設定 |
| `package.json` | Node.js実行設定とPlaywright依存関係 |

## GitHub Secrets

このリポジトリでは以下の Repository Secrets が必要です。

| Secret名 | 内容 |
|---|---|
| `GAS_WEB_APP_URL` | Google Apps Script Web App のPOST先URL。token付きURLを設定する。 |
| `OPENAI_API_KEY` | OpenAI APIキー。コードやREADMEには絶対に直書きしない。 |

例：

```text
Settings
→ Secrets and variables
→ Actions
→ New repository secret
```

## Google Apps Script側

GAS側はWebアプリとしてデプロイし、GitHub ActionsからPOSTされたJSONを受け取ってGoogleカレンダーに予定を作成します。

GAS側の主な責務：

- `token` による簡易認証
- 投稿URLによる重複登録防止
- AI判定結果に基づくカレンダー登録
- `period_start` / `period_end` がある場合は複数日の終日予定として登録
- `processed:{投稿URL}` を `ScriptProperties` に保存

注意：WebアプリURLやtokenは公開リポジトリに書かず、GitHub Secrets の `GAS_WEB_APP_URL` に設定します。

## OpenAI API判定

AIには、投稿本文から以下を判定させます。

| 項目 | 意味 |
|---|---|
| `should_create` | カレンダー登録すべきか |
| `category` | チケット申込、チケット販売、サイン会、チェキ会、特典会などの分類 |
| `calendar_title` | カレンダー表示用タイトル |
| `calendar_date` | 代表日。受付期間がある場合は終了日 |
| `period_start` | 受付期間・申込期間・販売期間の開始日 |
| `period_end` | 受付期間・申込期間・販売期間の終了日 |
| `date_type` | `deadline`, `application_start`, `event_date`, `manual_check`, `none` |
| `needs_manual_check` | 手動確認が必要か |
| `summary` | 投稿要約 |
| `reason` | 日付判定理由 |
| `confidence` | 信頼度 |

受付期間が `6/6 18:00〜6/15 23:59` のように書かれている場合は、`period_start=2026-06-06`、`period_end=2026-06-15`、`calendar_date=2026-06-15`、`date_type=deadline` として扱います。

## 検知対象キーワード

現在は以下のようなキーワードに一致した投稿だけAI判定します。

```text
申込, 申し込み, 受付, 応募, 抽選, 先行, 締切, 期限,
チケット, 販売, リセール, 特典会, 整理券, FC, 年額会員,
サイン会, サイン, チェキ, 撮影会, お渡し会, リリイベ,
リリースイベント, 特典券, 参加券
```

AI APIの無駄打ちを抑えるため、全投稿をAIに投げず、キーワード一致した投稿のみAI判定します。

## GitHub Actionsの実行間隔

現在の推奨設定は、混雑しやすい00分・30分を避けた30分間隔です。

```yaml
on:
  schedule:
    - cron: '7,37 * * * *'
  workflow_dispatch:
```

GitHub Actions の cron は UTC 基準です。`7,37 * * * *` は毎時07分・37分に動きます。

## 手動実行

GitHub上で以下から手動実行できます。

```text
Actions
→ Check X with Playwright
→ Run workflow
```

ログで以下を確認します。

```text
article count after scroll: ...
skip pinned post
--- keyword matched post ---
--- full post text used for AI ---
--- AI result ---
POST to GAS: 200
```

## 期待されるGASレスポンス例

受付期間がある投稿の場合：

```json
{
  "ok": true,
  "created": true,
  "title": "【申込期限】CANDY_TUNE_ CANDY TUNE Fall Tour 2026 受付期限",
  "date": "2026-06-15",
  "period_start": "2026-06-06",
  "period_end": "2026-06-15",
  "date_type": "deadline",
  "needs_manual_check": false,
  "link": "https://x.com/.../status/..."
}
```

処理済み投稿の場合：

```json
{
  "ok": true,
  "skipped": true,
  "reason": "already processed"
}
```

## トラブルシューティング

### 同じ投稿ばかり検知される

XプロフィールではPinned投稿が常に上位に出ます。現在はPinned投稿をスキップし、プロフィールをスクロールして最大30件程度確認します。

### `already processed` になる

GAS側の `ScriptProperties` に投稿URLが処理済みとして保存されています。テスト時だけ、GAS側のテスト関数で該当URLの処理済みフラグを消します。

### OpenAI API error: 429

OpenAI Platform側のBilling/クレジット/予算上限を確認してください。ChatGPT PlusとOpenAI APIの課金は別です。

### Xの本文が途中で切れる

一覧ページ上の本文は `Show more` で省略されるため、キーワード一致後に個別投稿URLを開いて全文取得します。

### GitHub Actionsのschedule間隔が不安定

GitHub Actionsのscheduleは厳密な定時実行保証がありません。00分・30分は混みやすいため、`7,37 * * * *` のようにずらす運用を推奨します。

## Codex向け概要

このリポジトリは、X投稿監視からGoogleカレンダー登録までを自動化する小規模Botです。今後はCodexで以下を改善していく想定です。

- README/TODOの整備
- 監視対象アカウントの設定ファイル化
- キーワードの設定ファイル化
- AI呼び出し前の重複チェック
- エラーログ改善
- GAS連携仕様の明文化
- テスト追加
