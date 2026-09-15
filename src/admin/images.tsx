import { Hono } from 'hono'
import { Layout } from './layout'
import { serveImage } from '../images'
import { formatJst } from '../format'

type ImageRow = {
  id: string
  student_name: string
  lesson_id: number | null
  memo_body: string | null
  received_at: string
  lesson_title: string | null
  held_on: string | null
}

type Student = {
  id: number
  name: string
}

type Lesson = {
  id: number
  held_on: string
  title: string
}

const adminImages = new Hono<{ Bindings: Env }>()

const ID_PATTERN = /^[0-9]+$/

// クエリは文字列で届く。空文字（フォームの「すべて」）や 1e3 等の紛らわしい表記は
// Number() だけでは弾けないため、桁のみの形式を明示的に確認してから数値化する。
const parseId = (value: string | undefined): number | null => {
  if (value === undefined || !ID_PATTERN.test(value)) {
    return null
  }
  return Number(value)
}

const ImagesPage = ({
  imageList,
  studentList,
  lessonList,
  studentId,
  lessonId,
}: {
  imageList: ImageRow[]
  studentList: Student[]
  lessonList: Lesson[]
  studentId: number | null
  lessonId: number | null
}) => (
  <Layout title="画像一覧">
    <form method="get" action="/admin/images">
      <label>
        受講生
        <select name="student_id">
          <option value="" selected={studentId === null}>
            すべて
          </option>
          {studentList.map((student) => (
            <option value={String(student.id)} selected={student.id === studentId}>
              {student.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        講座回
        <select name="lesson_id">
          <option value="" selected={lessonId === null}>
            すべて
          </option>
          {lessonList.map((lesson) => (
            <option value={String(lesson.id)} selected={lesson.id === lessonId}>
              {lesson.held_on} {lesson.title}
            </option>
          ))}
        </select>
      </label>
      <button type="submit">絞り込み</button>
    </form>

    {imageList.length === 0 ? (
      <p>該当する画像がありません。</p>
    ) : (
      <ul class="image-grid">
        {imageList.map((image) => (
          <li>
            <img src={`/admin/images/${image.id}`} alt="受講生が送信した写真" loading="lazy" />
            <div class="image-meta">
              <div>{image.student_name}</div>
              <div>{image.lesson_title ? `${image.held_on} ${image.lesson_title}` : '講座回未選択'}</div>
              <div class="memo-body">{image.memo_body ?? 'メモ未記入'}</div>
              <div>{formatJst(image.received_at)}</div>
            </div>
          </li>
        ))}
      </ul>
    )}
  </Layout>
)

adminImages.get('/', async (c) => {
  const studentId = parseId(c.req.query('student_id'))
  const lessonId = parseId(c.req.query('lesson_id'))

  const conditions: string[] = []
  const params: number[] = []

  if (studentId !== null) {
    conditions.push('images.student_id = ?')
    params.push(studentId)
  }

  if (lessonId !== null) {
    conditions.push('images.lesson_id = ?')
    params.push(lessonId)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const sql = `SELECT images.id, students.name AS student_name, images.lesson_id,
                      images.memo_body, images.received_at,
                      lessons.title AS lesson_title, lessons.held_on
               FROM images
               JOIN students ON students.id = images.student_id
               LEFT JOIN lessons ON lessons.id = images.lesson_id
               ${where}
               ORDER BY images.received_at DESC, images.id DESC`

  const [{ results: imageList }, { results: studentList }, { results: lessonList }] =
    await Promise.all([
      c.env.DB.prepare(sql)
        .bind(...params)
        .all<ImageRow>(),
      c.env.DB.prepare('SELECT id, name FROM students ORDER BY name, id').all<Student>(),
      c.env.DB.prepare('SELECT id, held_on, title FROM lessons ORDER BY held_on, id').all<Lesson>(),
    ])

  return c.html(
    <ImagesPage
      imageList={imageList}
      studentList={studentList}
      lessonList={lessonList}
      studentId={studentId}
      lessonId={lessonId}
    />
  )
})

adminImages.get('/:id', (c) => serveImage(c))

export { adminImages }
