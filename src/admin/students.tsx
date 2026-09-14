import { Hono } from 'hono'
import { Layout } from './layout'
import { STUDENT_STATUS_LABELS, formatStudentStatus, type StudentStatus } from './format'

type Student = {
  id: number
  line_user_id: string
  name: string
  status: string
  created_at: string
}

const students = new Hono<{ Bindings: Env }>()

const StudentsPage = ({
  studentList,
  error,
  lineUserId,
  name,
}: {
  studentList: Student[]
  error?: string
  lineUserId?: string
  name?: string
}) => (
  <Layout title="受講生一覧">
    {error && <p class="error">{error}</p>}
    <table>
      <thead>
        <tr>
          <th>名前</th>
          <th>LINEユーザーID</th>
          <th>状態</th>
          <th>登録日時</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {studentList.map((student) => (
          <tr>
            <td>{student.name}</td>
            <td>{student.line_user_id}</td>
            <td>{formatStudentStatus(student.status)}</td>
            <td>{student.created_at}</td>
            <td>
              <a href={`/admin/students/${student.id}/edit`}>編集</a>
            </td>
          </tr>
        ))}
      </tbody>
    </table>

    <h2>新規登録</h2>
    <form method="post" action="/admin/students">
      <label>
        LINEユーザーID
        <input type="text" name="line_user_id" value={lineUserId} required />
      </label>
      <label>
        名前
        <input type="text" name="name" value={name} required />
      </label>
      <button type="submit">登録</button>
    </form>
  </Layout>
)

const EditStudentPage = ({
  student,
  error,
  name,
  status,
}: {
  student: Student
  error?: string
  name?: string
  status?: string
}) => (
  <Layout title="受講生の編集">
    {error && <p class="error">{error}</p>}
    <form method="post" action={`/admin/students/${student.id}/edit`}>
      <label>
        名前
        <input type="text" name="name" value={name ?? student.name} required />
      </label>
      <label>
        状態
        <select name="status">
          {Object.entries(STUDENT_STATUS_LABELS).map(([value, label]) => (
            <option value={value} selected={value === (status ?? student.status)}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <button type="submit">更新</button>
    </form>
  </Layout>
)

students.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, line_user_id, name, status, created_at FROM students ORDER BY created_at DESC, id DESC'
  ).all<Student>()

  return c.html(<StudentsPage studentList={results} />)
})

students.post('/', async (c) => {
  const body = await c.req.parseBody()
  const lineUserId = String(body.line_user_id ?? '').trim()
  const name = String(body.name ?? '').trim()

  if (lineUserId === '' || name === '') {
    const { results } = await c.env.DB.prepare(
      'SELECT id, line_user_id, name, status, created_at FROM students ORDER BY created_at DESC, id DESC'
    ).all<Student>()

    return c.html(
      <StudentsPage
        studentList={results}
        error="LINEユーザーIDと名前を入力してください"
        lineUserId={lineUserId}
        name={name}
      />
    )
  }

  try {
    await c.env.DB.prepare(
      'INSERT INTO students (line_user_id, name, status) VALUES (?, ?, ?)'
    )
      .bind(lineUserId, name, 'enrolled' satisfies StudentStatus)
      .run()
  } catch (err) {
    // UNIQUE 違反だけ専用の文言にし、それ以外は原因不明として汎用文言にする
    const error =
      err instanceof Error && err.message.includes('UNIQUE')
        ? 'このLINEユーザーIDは既に登録されています'
        : '登録に失敗しました'

    const { results } = await c.env.DB.prepare(
      'SELECT id, line_user_id, name, status, created_at FROM students ORDER BY created_at DESC, id DESC'
    ).all<Student>()

    return c.html(
      <StudentsPage
        studentList={results}
        error={error}
        lineUserId={lineUserId}
        name={name}
      />
    )
  }

  return c.redirect('/admin/students')
})

students.get('/:id/edit', async (c) => {
  const id = c.req.param('id')
  const student = await c.env.DB.prepare(
    'SELECT id, line_user_id, name, status, created_at FROM students WHERE id = ?'
  )
    .bind(id)
    .first<Student>()

  if (!student) {
    return c.notFound()
  }

  return c.html(<EditStudentPage student={student} />)
})

students.post('/:id/edit', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.parseBody()
  const name = String(body.name ?? '').trim()
  const status = String(body.status ?? '')

  const isValidStatus = Object.hasOwn(STUDENT_STATUS_LABELS, status)

  if (name === '' || !isValidStatus) {
    const student = await c.env.DB.prepare(
      'SELECT id, line_user_id, name, status, created_at FROM students WHERE id = ?'
    )
      .bind(id)
      .first<Student>()

    if (!student) {
      return c.notFound()
    }

    return c.html(
      <EditStudentPage
        student={student}
        error="名前と状態を正しく入力してください"
        name={name}
        status={status}
      />
    )
  }

  await c.env.DB.prepare('UPDATE students SET name = ?, status = ? WHERE id = ?')
    .bind(name, status, id)
    .run()

  return c.redirect('/admin/students')
})

export { students }
