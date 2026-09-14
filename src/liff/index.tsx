import { Hono } from 'hono'
import { Layout } from './layout'
import { liffImages } from './images'

const liff = new Hono<{ Bindings: Env }>()

// JSON.stringify は </script> をエスケープしないため、< を潰して script 要素からの脱出を防ぐ。
const toScriptLiteral = (value: string) => JSON.stringify(value).replaceAll('<', '\\u003c')

// ID トークンはブラウザで liff.init() が終わるまで得られないため、殻の HTML を先に返し、
// 中身はトークン付きの fetch で取りに行く。この殻自体には検証を掛けない。
const bootstrapScript = (liffId: string, endpoint: string) => `
  const container = document.getElementById('content')
  const show = (html) => { container.innerHTML = html }
  const fail = (message) => { show('<p class="error">' + message + '</p>') }

  const request = async (url, options) => {
    const token = liff.getIDToken()
    if (!token) {
      fail('LINE アプリから開き直してください。')
      return null
    }
    const res = await fetch(url, {
      ...options,
      headers: { ...(options && options.headers), Authorization: 'Bearer ' + token },
    })
    if (res.status === 401) {
      fail('この画像を表示する権限がありません。')
      return null
    }
    return await res.text()
  }

  // 断片内の form は素のマークアップのまま、送信だけ fetch に載せ替える（トークンをヘッダで運ぶため）。
  const bindForms = () => {
    for (const form of container.querySelectorAll('form')) {
      form.addEventListener('submit', async (event) => {
        event.preventDefault()
        const html = await request(form.action, {
          method: 'POST',
          body: new URLSearchParams(new FormData(form)),
        })
        if (html !== null) {
          show(html)
          bindForms()
        }
      })
    }
  }

  liff
    .init({ liffId: ${toScriptLiteral(liffId)}, withLoginOnExternalBrowser: true })
    .then(async () => {
      // withLoginOnExternalBrowser がログインを済ませるため、ここで login() を呼ぶと
      // 戻った直後にまだ false と判定されてループする。トークンの有無で判断する。
      const html = await request(${toScriptLiteral(endpoint)} + location.search)
      if (html !== null) {
        show(html)
        bindForms()
      }
    })
    .catch((err) => { fail('読み込みに失敗しました: ' + err) })
`

const Shell = ({ title, liffId, endpoint }: { title: string; liffId: string; endpoint: string }) => (
  <Layout title={title}>
    <div id="content">読み込み中…</div>
    <script
      // JSX が中身をエスケープしないよう dangerouslySetInnerHTML を使う。埋める値は toScriptLiteral を通す。
      dangerouslySetInnerHTML={{ __html: bootstrapScript(liffId, endpoint) }}
    ></script>
  </Layout>
)

const MissingLiffId = ({ title }: { title: string }) => (
  <Layout title={title}>
    <p class="error">LIFF_ID が未設定です。wrangler.toml の vars に登録してください。</p>
  </Layout>
)

// liff.state があれば init() が本来のパスへ飛ばす。無ければ素の LIFF URL なので一覧へ送る。
const entryScript = (liffId: string) => `
  liff
    .init({ liffId: ${toScriptLiteral(liffId)}, withLoginOnExternalBrowser: true })
    .then(() => {
      if (!new URLSearchParams(location.search).has('liff.state')) {
        location.replace('/liff/images?memo=none')
      }
    })
    .catch((err) => {
      document.getElementById('content').innerHTML =
        '<p class="error">読み込みに失敗しました: ' + err + '</p>'
    })
`

const Entry = ({ title, liffId }: { title: string; liffId: string }) => (
  <Layout title={title}>
    <div id="content">読み込み中…</div>
    <script dangerouslySetInnerHTML={{ __html: entryScript(liffId) }}></script>
  </Layout>
)

// エンドポイント URL は LIFF の 1 次リダイレクト先。liff.state に畳まれたパスを
// liff.init() が展開するため、ここで 302 を返すと追加情報が失われる（公式が明示的に禁止）。
liff.get('/', (c) => {
  const liffId = c.env.LIFF_ID
  const title = '画像とメモ'

  if (!liffId) {
    return c.html(<MissingLiffId title={title} />)
  }

  return c.html(<Entry title={title} liffId={liffId} />)
})

liff.get('/images', (c) => {
  const liffId = c.env.LIFF_ID
  const title = '画像とメモ'

  if (!liffId) {
    return c.html(<MissingLiffId title={title} />)
  }

  return c.html(<Shell title={title} liffId={liffId} endpoint="/liff/api/images" />)
})

liff.get('/images/:id', (c) => {
  const liffId = c.env.LIFF_ID
  const title = 'メモの編集'

  if (!liffId) {
    return c.html(<MissingLiffId title={title} />)
  }

  return c.html(
    <Shell title={title} liffId={liffId} endpoint={`/liff/api/images/${c.req.param('id')}`} />
  )
})

liff.route('/api/images', liffImages)

export { liff }
