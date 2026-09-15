import { Hono } from 'hono'
import { Layout } from './layout'
import { formatJst } from '../format'
import { broadcastMessage, getMessageQuotaConsumption } from '../line/api'

type Notice = {
  id: number
  body: string
  sent_at: string
}

// memo_body と揃える（段階 7 の流儀）。D1 の行サイズ上限対策とフォームの防波堤を兼ねる。
const NOTICE_BODY_MAX_LENGTH = 2000

const notices = new Hono<{ Bindings: Env }>()

// クォータ取得はネットワーク例外や JSON パース失敗で reject しうるため、呼び出し側で吸収する。
// 失敗してもお知らせ画面自体は表示したい。
const fetchTotalUsage = async (channelAccessToken: string): Promise<number | null> => {
  try {
    const quota = await getMessageQuotaConsumption(channelAccessToken)
    return quota?.totalUsage ?? null
  } catch (err) {
    console.error('quota consumption fetch error', err)
    return null
  }
}

const fetchNoticeList = async (db: D1Database): Promise<Notice[]> => {
  const { results } = await db
    .prepare('SELECT id, body, sent_at FROM notices ORDER BY sent_at DESC, id DESC')
    .all<Notice>()

  return results
}

const QuotaNotice = ({ totalUsage }: { totalUsage: number | null }) => (
  <p>
    {totalUsage === null
      ? '今月の送信済み通数を取得できませんでした。'
      : `今月の送信済み: ${totalUsage} 通 / 無料枠 200 通`}
  </p>
)

const NoticesPage = ({
  noticeList,
  totalUsage,
  error,
  body,
}: {
  noticeList: Notice[]
  totalUsage: number | null
  error?: string
  body?: string
}) => (
  <Layout title="お知らせ配信">
    <QuotaNotice totalUsage={totalUsage} />
    {error && <p class="error">{error}</p>}

    <h2>新規配信</h2>
    <form method="post" action="/admin/notices/confirm">
      <label>
        本文
        <textarea name="body" maxlength={NOTICE_BODY_MAX_LENGTH} rows={6}>
          {body ?? ''}
        </textarea>
      </label>
      <button type="submit">確認画面へ</button>
    </form>

    <h2>配信済み</h2>
    <table>
      <thead>
        <tr>
          <th>配信日時</th>
          <th>本文</th>
        </tr>
      </thead>
      <tbody>
        {noticeList.map((notice) => (
          <tr>
            <td>{formatJst(notice.sent_at)}</td>
            <td>{notice.body}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </Layout>
)

const ConfirmPage = ({ body, totalUsage }: { body: string; totalUsage: number | null }) => (
  <Layout title="お知らせ配信の確認">
    <p>次の内容を全友だちに配信します。取り消しはできません。</p>
    <p>配信は「友だち数 × 1」で課金されます。1 回の配信で友だちの人数ぶんのメッセージを消費します。</p>
    <QuotaNotice totalUsage={totalUsage} />

    <h2>送信する本文</h2>
    <pre>{body}</pre>

    <form method="post" action="/admin/notices">
      <input type="hidden" name="body" value={body} />
      <button type="submit">この内容で配信する</button>
    </form>
    <p>
      <a href="/admin/notices">戻る</a>
    </p>
  </Layout>
)

const validateBody = (body: string): string | null => {
  if (body === '') {
    return '本文を入力してください'
  }

  if (body.length > NOTICE_BODY_MAX_LENGTH) {
    return `本文は ${NOTICE_BODY_MAX_LENGTH} 文字以内で入力してください（${body.length} 文字入力されています）`
  }

  return null
}

notices.get('/', async (c) => {
  const [noticeList, totalUsage] = await Promise.all([
    fetchNoticeList(c.env.DB),
    fetchTotalUsage(c.env.LINE_CHANNEL_ACCESS_TOKEN),
  ])

  return c.html(<NoticesPage noticeList={noticeList} totalUsage={totalUsage} />)
})

notices.post('/confirm', async (c) => {
  const formBody = await c.req.parseBody()
  const body = String(formBody.body ?? '').trim()

  const error = validateBody(body)

  if (error) {
    const [noticeList, totalUsage] = await Promise.all([
      fetchNoticeList(c.env.DB),
      fetchTotalUsage(c.env.LINE_CHANNEL_ACCESS_TOKEN),
    ])

    return c.html(<NoticesPage noticeList={noticeList} totalUsage={totalUsage} error={error} body={body} />, 400)
  }

  const totalUsage = await fetchTotalUsage(c.env.LINE_CHANNEL_ACCESS_TOKEN)

  return c.html(<ConfirmPage body={body} totalUsage={totalUsage} />)
})

notices.post('/', async (c) => {
  const formBody = await c.req.parseBody()
  const body = String(formBody.body ?? '').trim()

  const error = validateBody(body)

  if (error) {
    const [noticeList, totalUsage] = await Promise.all([
      fetchNoticeList(c.env.DB),
      fetchTotalUsage(c.env.LINE_CHANNEL_ACCESS_TOKEN),
    ])

    return c.html(<NoticesPage noticeList={noticeList} totalUsage={totalUsage} error={error} body={body} />, 400)
  }

  const result = await broadcastMessage(c.env.LINE_CHANNEL_ACCESS_TOKEN, [{ type: 'text', text: body }])

  // 失敗時は記録しない。先に INSERT すると「送っていないお知らせ」が履歴に残る。
  if (!result.ok) {
    const [noticeList, totalUsage] = await Promise.all([
      fetchNoticeList(c.env.DB),
      fetchTotalUsage(c.env.LINE_CHANNEL_ACCESS_TOKEN),
    ])

    return c.html(
      <NoticesPage
        noticeList={noticeList}
        totalUsage={totalUsage}
        error={`配信に失敗しました: ${result.reason}`}
        body={body}
      />,
      502
    )
  }

  await c.env.DB.prepare('INSERT INTO notices (body) VALUES (?)').bind(body).run()

  return c.redirect('/admin/notices')
})

export { notices }
