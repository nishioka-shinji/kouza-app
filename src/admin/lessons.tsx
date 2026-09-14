import { Hono } from 'hono'
import { Layout } from './layout'

type Lesson = {
  id: number
  held_on: string
  title: string
}

const lessons = new Hono<{ Bindings: Env }>()

const HELD_ON_PATTERN = /^\d{4}-\d{2}-\d{2}$/

// 桁形式だけでは 2026-02-30 のような実在しない日付を通すため、UTC 正規化後の文字列と比較して弾く
const isValidHeldOn = (heldOn: string): boolean => {
  if (!HELD_ON_PATTERN.test(heldOn)) {
    return false
  }
  const date = new Date(`${heldOn}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === heldOn
}

const LessonsPage = ({
  lessonList,
  error,
  heldOn,
  title,
}: {
  lessonList: Lesson[]
  error?: string
  heldOn?: string
  title?: string
}) => (
  <Layout title="講座回一覧">
    {error && <p class="error">{error}</p>}
    <table>
      <thead>
        <tr>
          <th>開催日</th>
          <th>タイトル</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {lessonList.map((lesson) => (
          <tr>
            <td>{lesson.held_on}</td>
            <td>{lesson.title}</td>
            <td>
              <a href={`/admin/images?lesson_id=${lesson.id}`}>画像</a>
            </td>
          </tr>
        ))}
      </tbody>
    </table>

    <h2>新規登録</h2>
    <form method="post" action="/admin/lessons">
      <label>
        開催日
        <input type="date" name="held_on" value={heldOn} required />
      </label>
      <label>
        タイトル
        <input type="text" name="title" value={title} required />
      </label>
      <button type="submit">登録</button>
    </form>
  </Layout>
)

lessons.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, held_on, title FROM lessons ORDER BY held_on, id'
  ).all<Lesson>()

  return c.html(<LessonsPage lessonList={results} />)
})

lessons.post('/', async (c) => {
  const body = await c.req.parseBody()
  const heldOn = String(body.held_on ?? '').trim()
  const title = String(body.title ?? '').trim()

  if (!isValidHeldOn(heldOn) || title === '') {
    const { results } = await c.env.DB.prepare(
      'SELECT id, held_on, title FROM lessons ORDER BY held_on, id'
    ).all<Lesson>()

    return c.html(
      <LessonsPage
        lessonList={results}
        error="開催日（YYYY-MM-DD、実在する日付）とタイトルを入力してください"
        heldOn={heldOn}
        title={title}
      />
    )
  }

  await c.env.DB.prepare('INSERT INTO lessons (held_on, title) VALUES (?, ?)')
    .bind(heldOn, title)
    .run()

  return c.redirect('/admin/lessons')
})

export { lessons }
