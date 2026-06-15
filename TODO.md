# TODO

このTODOは、Codexへ移行して今後安全に改善していくための作業リストです。

## P0: すぐやる / 安定運用に必要

### 1. AI呼び出し前の重複チェック

現状は以下の順序になっています。

```text
X投稿取得
→ キーワード一致
→ 個別投稿全文取得
→ OpenAI API判定
→ GASへPOST
→ GAS側でalready processed判定
```

このため、処理済み投稿でもOpenAI APIを呼んでしまう可能性があります。

改善案：

- GASに `mode=checkProcessed` のような軽量エンドポイントを追加
- GitHub Actions側でAI判定前に投稿URLを問い合わせる
- 既処理ならAI判定せずスキップ

期待効果：

- APIコスト削減
- 実行時間短縮
- ログの見通し改善

---

### 2. 設定ファイル化

現在、監視対象アカウントとキーワードは `check-x.js` に直書きされている。

改善案：

```text
config/accounts.json
config/keywords.json
```

例：

```json
[
  {
    "account": "CANDY_TUNE_",
    "url": "https://x.com/CANDY_TUNE_",
    "enabled": true
  }
]
```

期待効果：

- 監視対象を増やしやすい
- コード変更なしで設定変更できる
- Codexに安全に設定追加を頼みやすい

---

### 3. ログ改善

現在のログは動作確認には十分だが、運用時に状況を追いにくい。

追加したいログ：

- 監視対象アカウント数
- 取得article数
- Pinnedスキップ数
- キーワード一致数
- AI判定実行数
- GAS登録成功数
- GASスキップ数
- エラー数

最終行にサマリーを出す。

例：

```text
Summary: accounts=1, articles=28, pinnedSkipped=1, keywordMatched=3, aiCalled=2, created=1, skipped=1, errors=0
```

---

## P1: 精度改善

### 4. 分類ルール強化

現在の分類：

- ticket_application
- ticket_sale
- sign_event
- cheki_event
- benefit_event
- release_event
- live_event
- goods_sale
- media
- other

追加検討：

- upgrade_application
- fanclub_application
- lottery_result
- payment_deadline
- ticket_issue
- resale
- numbered_ticket

特にCANDY TUNE/カワラボ運用では以下が重要：

- アップグレード申込
- 当落発表
- 入金期限
- 発券開始
- 整理番号/座席発表
- リセール受付
- 特典券販売

---

### 5. 日付抽出の補正ルール追加

現状は `受付期間 A〜B` をコード側でも補正している。

追加したい補正：

- `〜23:59まで`
- `本日23:59まで`
- `明日23:59まで`
- `正午まで`
- `12:00まで`
- `入金期限`
- `発券開始`
- `当落発表`

AIに任せつつ、よくある形式はコード側でも保険をかける。

---

### 6. 投稿全文取得の安定化

現在は個別投稿ページの `article[0]` の本文を使用している。

懸念：

- 引用投稿
- リプライ表示
- メディア投稿
- 長文投稿のUI変更

改善案：

- 投稿URLのstatus IDを使って、該当statusを含むarticleを優先
- 取得本文に対象アカウント名が含まれるか確認
- 取得本文が短すぎる場合はリトライ

---

## P2: 運用改善

### 7. READMEにGASコードを分離保存

現在、GASコードはGoogle Apps Script側に存在し、リポジトリ管理されていない。

改善案：

```text
gas/Code.js
```

としてリポジトリにも保存する。

注意：

- Web App URLやtokenはハードコードしない
- `SECRET_TOKEN` はScriptPropertiesから読む形に変更する

---

### 8. GASの秘密情報をScriptProperties化

現在のGAS側では `SECRET_TOKEN` をコード内定数として持つ構成。

改善案：

```javascript
PropertiesService.getScriptProperties().getProperty('SECRET_TOKEN')
```

を使う。

期待効果：

- GASコードをGitHubに置きやすくなる
- token漏洩リスクを下げる

---

### 9. カレンダーID指定

現在はデフォルトカレンダーに登録する運用。

改善案：

- 専用カレンダーIDをScriptPropertiesに保存
- `CALENDAR_ID` をプロパティから読む
- READMEにカレンダーID確認方法を書く

---

### 10. 通知・アラート

GitHub Actions失敗時やGAS登録失敗時に気づきやすくする。

候補：

- GitHub Actionsの失敗通知
- Gmail通知
- Google Chat Webhook
- カレンダーに「Botエラー」予定を登録

---

## P3: 拡張

### 11. 監視対象アカウント追加

候補：

- CANDY TUNE公式
- KAWAII LAB.公式
- ASOBISYSTEM公式
- 各メンバー個人アカウント
- チケット販売サイト公式
- イベント公式アカウント

ただし監視対象が増えると、Xアクセス数・AI判定数・実行時間が増えるため、段階的に追加する。

---

### 12. スプレッドシート連携

将来的に、カレンダー登録だけでなくスプレッドシートにも履歴を保存したい。

保存候補：

- 検知日時
- アカウント
- 投稿URL
- タイトル
- カテゴリ
- 期間開始
- 期間終了
- date_type
- needs_manual_check
- カレンダー登録結果
- 処理ステータス

CANDY TUNE申込管理表と連携できると、申込済み/当落待ち/当選/落選/入金済み/発券済み管理につなげやすい。

---

### 13. Issue自動作成

要確認投稿やAI信頼度が低い投稿は、GoogleカレンダーだけでなくGitHub Issueにする案。

例：

```text
[X要確認] CANDY_TUNE_ FC先行受付開始
```

メリット：

- 調査メモを残しやすい
- CodexにそのIssueを処理させやすい

---

## Codexへの最初の依頼例

```text
このリポジトリを読んで、README.md と TODO.md の内容に沿って現状を把握してください。
まずはコード変更せず、現在の構成・問題点・次に直すべき箇所を整理してください。
その後、P0-1「AI呼び出し前の重複チェック」を実装するための設計案を出してください。
```

## 完了済み

- [x] GitHub Actions + PlaywrightでX投稿を取得
- [x] Nitter/RSSルートがGAS/GitHub Actionsから不安定であることを確認
- [x] Playwrightでプロフィール投稿本文を取得
- [x] Pinned投稿スキップ
- [x] プロフィールスクロールによる追加article取得
- [x] 個別投稿URLを開いて全文取得
- [x] OpenAI APIでStructured JSON判定
- [x] 受付期間 `A〜B` の終了日を期限として判定
- [x] `period_start` / `period_end` によるGoogleカレンダー期間予定登録
- [x] GitHub Actionsの定期実行設定
