# CLAUDE.md

講座運営アプリ（個人開発）。Hono / Cloudflare Workers スタックの習得が主目的。

## 位置づけ

実クライアントはいない。要件は自分で決めてよく、迷ったら習得目的に沿うほうを選ぶ。判断基準の優先順位は次のとおり。

1. Hono / Cloudflare の主要機能に触れられるか
2. 作り切れるか（機能を増やして未完で終わらせない）
3. 題材としての自然さ

## 設計方針

- React を導入しない。管理画面も LIFF 画面も Hono の JSX でサーバーサイド HTML を返す
- ライブラリを増やさない。Hono に同梱の機能で足りるものは同梱のものを使う
- LINE の API は fetch で直接叩く。`@line/bot-sdk` は `import type` で型だけ借りる（本体は Node 依存のため Workers で動かない）
- 公開範囲は狭いほうに倒す。受講生は自分の画像のみ、運営者は全件

## 実装上の制約

守らないと動かない、あるいは後から直しにくい点。

- **応答メッセージは署名検証の直後、200 を返す前に送る**。応答トークンは 1 回限りで、時間制限に依存した実装をしてはならない（公式の明示的な指示）。画像の取得を挟んでから応答してはいけない。この順のため応答時点で画像レコードはまだ無く、リンクには画像 ID を載せられない。LIFF の未メモ一覧（`memo_body IS NULL`）へのリンクにする
- **画像の取得と R2 保存は `c.executionCtx.waitUntil()` に逃がす**。LINE はコンテンツの保存期間を保証していないので後回しにはできないが、200 の応答を待たせてもいけない。200 を返した後に継続させる
- **Webhook は冪等にする**。200 を返す前に落ちると LINE が再送する。`images.line_message_id` に UNIQUE を張り、`r2_key` は `{student_id}/{line_message_id}` で決定的に導出する（受信日時を混ぜない。再送が月をまたぐとキーが変わる）
- **署名検証は Web Crypto で書く**。`crypto.createHmac` は Workers で使えない。`crypto.subtle` の `importKey` / `sign` で HMAC-SHA256 を計算し、比較は `hono/utils/buffer` の `timingSafeEqual` を使う
- **LIFF のユーザー ID は ID トークンを検証して得る**。`liff.getProfile()` の値は信用しない（クライアント側の値なので他人の ID を名乗れる）。`liff.getIDToken()` を送らせ、Workers から `POST https://api.line.me/oauth2/v2.1/verify` に投げ、応答の `sub` だけを使う。失敗は 401。Hono のミドルウェアにして F2 と F3 の両方へ適用し、検証済み ID は `c.set()` で渡す
- **画像 ID は所有者を検証する**。ID は URL 経由で渡るため書き換えられる。メモの保存・一覧の表示の前に、対象の `student_id` が上記で検証した LINE ユーザー ID と一致するか確認する
- **`images.id` は UUID にする**。この値が画像配信 URL（`/images/{uuid}`）に入る。連番にすると他人の画像を総当たりで引ける。画像バイナリの配信自体は UUID の推測困難性に頼り、リクエストごとの認証は行わない（`<img>` の GET に ID トークンを載せられないため）
- **R2 は非公開のまま Workers 経由で配信する**。`bucket.get(key)` の `body`（ReadableStream）をそのまま `Response` に渡し、全体をメモリに載せない。Content-Type は D1 に持たず、`put()` 時に `httpMetadata.contentType` へ載せ、配信時は `writeHttpMetadata()` でヘッダへ書き戻す
- **未登録の受講生を落とさない**。`images.student_id` は `students` の行を前提にする。follow イベントで `/v2/bot/profile/{userId}` を引いて UPSERT し、message 側でも未登録なら同じ UPSERT を通す。デプロイ前から友だちだったユーザーには follow が飛ばない
- **D1 にはインデックスを張る**。行読み取りは返した行数ではなくスキャンした行数で課金される。`students.line_user_id`（UNIQUE）、`images.line_message_id`（UNIQUE）、`images.student_id`、`images.lesson_id`、`attendances(lesson_id, student_id)`（UNIQUE）
- **メモは `images.memo_body` に持つ**。テーブルを分けない。1 画像 1 メモ・履歴なし。未記入は NULL

## 検証コマンド

このリポジトリにおける検証手段の唯一の情報源。実装の正否はここに定義されたコマンドの出力で判断する。

**コマンドを追加・変更したらこの節を更新する。**

| 目的 | コマンド | 状態 |
| --- | --- | --- |
| 型チェック | `npm run typecheck` | 有効 |
| ローカル起動 | `npm run dev` | 有効 |
| バインディング型の生成 | `npm run cf-typegen` | 有効 |
| デプロイ | `npm run deploy` | 有効（未実行） |
| D1 マイグレーション（ローカル） | `npx wrangler d1 migrations apply <DB名> --local` | スキーマ作成後に有効 |
| D1 マイグレーション（本番） | `npx wrangler d1 migrations apply <DB名> --remote` | スキーマ作成後に有効 |

Node は mise で固定している（`mise.toml`）。`npm` が見つからない場合は `mise install` を先に実行する。

`wrangler.toml` を変更したら `npm run cf-typegen` を実行して `worker-configuration.d.ts` を再生成する。この生成物はコミットしない。

テストフレームワークは未導入。導入する場合は Workers 環境で動く `vitest` + `@cloudflare/vitest-pool-workers` を第一候補とし、導入時にこの表へ追記する。

## 検証の扱い

- 成功を主張せず、実行したコマンドとその出力を証拠として示す
- 検証手段がない場合は「完了」と言わず、何を確認できていないかを明示する
- LINE Webhook と LIFF は実機確認が必要な領域。自動検証で代替せず、実際に LINE から送って確認する

## 秘匿情報

`.dev.vars` と `wrangler.toml` の secret はコミットしない。チャネルシークレット、チャネルアクセストークンは `wrangler secret put` で登録する。

## ドキュメント

- `docs/design.md` — 設計書。機能要件、データモデル、実装方針、コスト試算、フレームワーク選定の根拠
- `docs/daily-reports/<YYYYMM>/<YYYYMMDD>.md` — 日報

要件・設計に関わる判断を変えたときは `docs/design.md` を更新する。会話の中だけで決めて放置しない。

## 作業開始前に読むもの

作業に入る前に、`docs/daily-reports/` から次の 2 つを読む。

- 今日の日付のファイル（無ければ読まなくてよい）
- その 1 つ前に存在するファイル。昨日とは限らないので、日付を決め打ちせずファイル名の降順で今日より前の最初の 1 件を採る

例: `ls docs/daily-reports/*/*.md | sort -r` の先頭から、今日以前のものを順に見る。
