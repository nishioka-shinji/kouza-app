import { Hono } from 'hono'
import { Layout } from './layout'

const liff = new Hono<{ Bindings: Env }>()

// 段階 4 の疎通確認用。LIFF ブラウザで開けているか、init が通るかだけを見る。
// メモ入力と画像一覧は段階 6 でこの配下に足す。
liff.get('/', (c) => {
  const liffId = c.env.LIFF_ID

  return c.html(
    <Layout title="LIFF 疎通確認">
      {liffId ? (
        <dl>
          <dt>LIFF ID</dt>
          <dd>{liffId}</dd>
          <dt>初期化</dt>
          <dd id="init">実行中…</dd>
          <dt>LIFF ブラウザ内か</dt>
          <dd id="in-client">-</dd>
          <dt>ログイン済みか</dt>
          <dd id="logged-in">-</dd>
          <dt>ID トークン</dt>
          <dd id="id-token">-</dd>
        </dl>
      ) : (
        <p class="error">
          LIFF_ID が未設定です。wrangler.toml の vars に登録してください。
        </p>
      )}
      {liffId && (
        <script
          // JSX が中身をエスケープしないよう dangerouslySetInnerHTML を使う。
          // liffId は LINE が発行する英数字とハイフンのみなので JSON.stringify で足りる。
          dangerouslySetInnerHTML={{
            __html: `
              const show = (id, value) => {
                document.getElementById(id).textContent = value
              }
              liff
                .init({ liffId: ${JSON.stringify(liffId)} })
                .then(() => {
                  show('init', '成功')
                  show('in-client', liff.isInClient() ? 'はい' : 'いいえ（外部ブラウザ）')
                  show('logged-in', liff.isLoggedIn() ? 'はい' : 'いいえ')
                  // openid スコープが未選択・未同意なら null が返る。
                  const token = liff.isLoggedIn() ? liff.getIDToken() : null
                  show('id-token', token ? '取得できた（' + token.length + ' 文字）' : '取得できない')
                })
                .catch((err) => {
                  show('init', '失敗: ' + err)
                  document.getElementById('init').className = 'error'
                })
            `,
          }}
        ></script>
      )}
    </Layout>
  )
})

export { liff }
