import { Hono } from 'hono'
import { requireLineUser, type LiffEnv } from './auth'

type ImageRow = {
  id: string
  lesson_id: number | null
  memo_body: string | null
  received_at: string
  lesson_title: string | null
  held_on: string | null
}

type LessonRow = {
  id: number
  held_on: string
  title: string
}

const liffImages = new Hono<LiffEnv>()

// 検証済みの LINE ユーザー ID から受講生を引く。未登録なら null を返し、呼び出し側で空一覧にする。
const findStudentId = async (db: D1Database, lineUserId: string): Promise<number | null> => {
  const student = await db
    .prepare('SELECT id FROM students WHERE line_user_id = ?')
    .bind(lineUserId)
    .first<{ id: number }>()

  return student?.id ?? null
}

// 画像 ID は URL 経由で書き換えられるため、所有者が一致する行だけを返す。
// 不一致・不存在をまとめて null にし、存在の有無を漏らさない。
const findOwnedImage = async (
  db: D1Database,
  imageId: string,
  lineUserId: string
): Promise<ImageRow | null> => {
  const studentId = await findStudentId(db, lineUserId)

  if (studentId === null) {
    return null
  }

  return await db
    .prepare(
      `SELECT images.id, images.lesson_id, images.memo_body, images.received_at,
              lessons.title AS lesson_title, lessons.held_on
       FROM images
       LEFT JOIN lessons ON lessons.id = images.lesson_id
       WHERE images.id = ? AND images.student_id = ?`
    )
    .bind(imageId, studentId)
    .first<ImageRow>()
}

const ImageList = ({ imageList, memoNone }: { imageList: ImageRow[]; memoNone: boolean }) => {
  if (imageList.length === 0) {
    return (
      <p>
        {memoNone ? (
          <>
            メモ未記入の画像はありません。 <a href="/liff/images">すべての画像を見る</a>
          </>
        ) : (
          'まだ画像がありません。'
        )}
      </p>
    )
  }

  return (
    <>
      {/* 逆向きの導線がないと絞り込みを解いた後に戻れない。 */}
      <p class="notice">
        {memoNone ? (
          <>
            メモ未記入のみ表示中。<a href="/liff/images">すべて表示</a>
          </>
        ) : (
          <>
            すべて表示中。<a href="/liff/images?memo=none">メモ未記入のみ</a>
          </>
        )}
      </p>
      <ul class="image-grid">
        {imageList.map((image) => (
          <li>
            <a href={`/liff/images/${image.id}`}>
              <img src={`/images/${image.id}`} alt="送信した写真" loading="lazy" />
              <div class="image-meta">
                <div>{image.lesson_title ? `${image.held_on} ${image.lesson_title}` : '講座回未選択'}</div>
                <div class={image.memo_body ? undefined : 'memo-none'}>
                  {image.memo_body ? 'メモあり' : 'メモ未記入'}
                </div>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </>
  )
}

const MemoForm = ({
  image,
  lessonList,
  error,
  saved,
}: {
  image: ImageRow
  lessonList: LessonRow[]
  error?: string
  saved?: boolean
}) => (
  <>
    {error && <p class="error">{error}</p>}
    {saved && <p class="notice">保存しました。</p>}
    <img class="edit-image" src={`/images/${image.id}`} alt="送信した写真" />
    <form method="post" action={`/liff/api/images/${image.id}`}>
      <label>
        講座回
        <select name="lesson_id">
          <option value="" selected={image.lesson_id === null}>
            未選択
          </option>
          {lessonList.map((lesson) => (
            <option value={String(lesson.id)} selected={lesson.id === image.lesson_id}>
              {lesson.held_on} {lesson.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        メモ
        <textarea name="memo_body">{image.memo_body ?? ''}</textarea>
      </label>
      <button type="submit">保存</button>
    </form>
    <p>
      <a href="/liff/images">一覧に戻る</a>
    </p>
  </>
)

const fetchLessons = async (db: D1Database): Promise<LessonRow[]> => {
  const { results } = await db
    .prepare('SELECT id, held_on, title FROM lessons ORDER BY held_on, id')
    .all<LessonRow>()

  return results
}

liffImages.use('*', requireLineUser)

liffImages.get('/', async (c) => {
  const memoNone = c.req.query('memo') === 'none'
  const studentId = await findStudentId(c.env.DB, c.get('lineUserId'))

  if (studentId === null) {
    return c.html(<ImageList imageList={[]} memoNone={memoNone} />)
  }

  const sql = `SELECT images.id, images.lesson_id, images.memo_body, images.received_at,
                      lessons.title AS lesson_title, lessons.held_on
               FROM images
               LEFT JOIN lessons ON lessons.id = images.lesson_id
               WHERE images.student_id = ?${memoNone ? ' AND images.memo_body IS NULL' : ''}
               ORDER BY images.received_at DESC, images.id DESC`

  const { results } = await c.env.DB.prepare(sql).bind(studentId).all<ImageRow>()

  return c.html(<ImageList imageList={results} memoNone={memoNone} />)
})

liffImages.get('/:id', async (c) => {
  const image = await findOwnedImage(c.env.DB, c.req.param('id'), c.get('lineUserId'))

  if (!image) {
    return c.text('Unauthorized', 401)
  }

  return c.html(<MemoForm image={image} lessonList={await fetchLessons(c.env.DB)} />)
})

liffImages.post('/:id', async (c) => {
  const image = await findOwnedImage(c.env.DB, c.req.param('id'), c.get('lineUserId'))

  if (!image) {
    return c.text('Unauthorized', 401)
  }

  const body = await c.req.parseBody()
  const memoBody = String(body.memo_body ?? '').trim()
  const lessonIdInput = String(body.lesson_id ?? '').trim()

  let lessonId: number | null = null

  if (lessonIdInput !== '') {
    const parsed = Number(lessonIdInput)
    const lesson = Number.isInteger(parsed)
      ? await c.env.DB.prepare('SELECT id FROM lessons WHERE id = ?')
          .bind(parsed)
          .first<{ id: number }>()
      : null

    // フォームを介さない POST では HTML 側の検証が素通りするため、実在確認はサーバーで行う。
    if (!lesson) {
      return c.html(
        <MemoForm
          image={image}
          lessonList={await fetchLessons(c.env.DB)}
          error="選択された講座回が存在しません"
        />,
        400
      )
    }

    lessonId = lesson.id
  }

  // 空文字は NULL にし、未記入へ戻せるようにする（memo=none の一覧にも再び載る）。
  const memo = memoBody === '' ? null : memoBody

  await c.env.DB.prepare(
    'UPDATE images SET memo_body = ?, lesson_id = ?, memo_updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  )
    .bind(memo, lessonId, image.id)
    .run()

  return c.html(
    <MemoForm
      image={{ ...image, memo_body: memo, lesson_id: lessonId }}
      lessonList={await fetchLessons(c.env.DB)}
      saved
    />
  )
})

export { liffImages }
