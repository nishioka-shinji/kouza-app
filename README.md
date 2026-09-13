# 講座運営アプリ

講座の運営を題材にした個人開発アプリ。Hono / Cloudflare スタックの習得を主目的とする。実クライアントはいない。

受講生が LINE のトークに画像を送ると Webhook で受け取り、R2 に保存する。受講生は LIFF でメモを書き、自分の画像を時系列で振り返る。運営者は PC の管理画面から全体を通覧する。

## 技術構成

| 要素 | 用途 |
| --- | --- |
| Hono | ルーティング、ミドルウェア、JSX によるサーバーサイド HTML |
| Cloudflare Workers | 実行環境 |
| D1 | 受講生・画像・メモ・出欠のデータ |
| R2 | 投稿画像の保存 |
| LINE Messaging API | Webhook で投稿画像とメッセージを受信 |
| LIFF | LINE 内で開く画面（メモ入力・画像一覧） |

言語は TypeScript。React は使わない。管理画面も LIFF 画面もサーバーサイド HTML で組み、依存を薄く保つことを設計方針とする。

## ドキュメント

- [設計書](docs/design.md) — 機能要件、データモデル、実装方針、コスト試算、フレームワーク選定の根拠

## 前提

着手前に以下を済ませておく。

- LINE 公式アカウントの取得
- LINE Developers の登録（Messaging API チャネルと LIFF アプリの作成）
- Cloudflare アカウントの作成

## セットアップ

Node は mise で固定している（`mise.toml`）。

```sh
mise install          # Node 24.21.0 を入れる
npm install           # 依存をインストール
npm run cf-typegen    # wrangler.toml からバインディングの型を生成
npm run dev           # http://localhost:8787 で起動
```

`worker-configuration.d.ts` は `wrangler types` の生成物のためコミットしない。`wrangler.toml` を変更したら `npm run cf-typegen` で再生成する。

チャネルシークレットとチャネルアクセストークンは `wrangler secret put` で登録する。ローカルでは `.dev.vars` に置く（いずれもコミットしない）。

## デプロイ

手元から `wrangler deploy` で行う。GitHub 連携の Workers Builds は使わない。LINE の実機確認を挟む段階では、push とビルドを待たずに反映できるほうがループが速いため。

```sh
npx wrangler login    # 初回のみ
npm run deploy
npx wrangler tail     # Webhook が届いているかを見る
```

公開 URL は `https://kouza-app.muso-lab.dev`。`wrangler.toml` の `routes` で独自ドメインを当てているため、`workers.dev` のルートは無効になっている。

## コスト

Cloudflare・LINE とも無料枠に収まることを確認済み。内訳は[設計書の 6 章](docs/design.md#6-非機能要件)を参照。

D1 は 2026 年 9 月 1 日から無料枠超過時にエラーで停止する仕様になったため、インデックスのないテーブルスキャンだけは避ける。

## 進め方

機能を積む順に 8 段階に分け、各段階で動く状態にしてから次へ進む。段階 1 はアカウント準備、段階 4 は LIFF の調査と設定で、いずれもコードを書く前に済ませる。段階 5（LINE Webhook から R2 保存）と段階 6（LIFF）が習得の本体。詳細は[設計書の 7 章](docs/design.md#7-進め方)。
