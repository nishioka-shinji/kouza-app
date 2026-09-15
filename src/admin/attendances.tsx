import { Hono } from 'hono'
import { Layout } from './layout'
import { formatAttendanceStatus } from '../attendance'

type Lesson = {
  id: number
  held_on: string
  title: string
}

type AttendanceRow = {
  student_id: number
  student_name: string
  status: string | null
  note: string | null
}

const attendances = new Hono<{ Bindings: Env }>()

const ID_PATTERN = /^[0-9]+$/

// クエリは文字列で届く。空文字（<select> の未選択）を Number() に通すと 0 になり、
// id 0 での絞り込みに化けるため、桁のみの形式を確認してから数値化する。
const parseId = (value: string | undefined): number | null => {
  if (value === undefined || !ID_PATTERN.test(value)) {
    return null
  }
  return Number(value)
}

const AttendancesPage = ({
  lessonList,
  lessonId,
  lessonNotFound,
  attendanceList,
}: {
  lessonList: Lesson[]
  lessonId: number | null
  lessonNotFound: boolean
  attendanceList: AttendanceRow[] | null
}) => (
  <Layout title="出欠一覧">
    <form method="get" action="/admin/attendances">
      <label>
        講座回
        <select name="lesson_id">
          <option value="" selected={lessonId === null}>
            選択してください
          </option>
          {lessonList.map((lesson) => (
            <option value={String(lesson.id)} selected={lesson.id === lessonId}>
              {lesson.held_on} {lesson.title}
            </option>
          ))}
        </select>
      </label>
      <button type="submit">表示</button>
    </form>

    {lessonId === null ? (
      <p>講座回を選択してください。</p>
    ) : lessonNotFound ? (
      <p>該当する講座回がありません。</p>
    ) : (
      <table>
        <thead>
          <tr>
            <th>受講生</th>
            <th>状態</th>
            <th>連絡内容</th>
          </tr>
        </thead>
        <tbody>
          {attendanceList?.map((attendance) => (
            <tr>
              <td>{attendance.student_name}</td>
              <td>{attendance.status === null ? '未連絡' : formatAttendanceStatus(attendance.status)}</td>
              <td>{attendance.note ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </Layout>
)

attendances.get('/', async (c) => {
  const lessonId = parseId(c.req.query('lesson_id'))

  const { results: lessonList } = await c.env.DB.prepare(
    'SELECT id, held_on, title FROM lessons ORDER BY held_on, id'
  ).all<Lesson>()

  if (lessonId === null) {
    return c.html(
      <AttendancesPage
        lessonList={lessonList}
        lessonId={null}
        lessonNotFound={false}
        attendanceList={null}
      />
    )
  }

  const lesson = lessonList.find((row) => row.id === lessonId)

  if (!lesson) {
    return c.html(
      <AttendancesPage
        lessonList={lessonList}
        lessonId={lessonId}
        lessonNotFound={true}
        attendanceList={null}
      />
    )
  }

  // students を基準に LEFT JOIN し、出欠行が無い受講生も「未連絡」として出す。
  // 出欠を出した人だけを表示すると誰が未連絡かが分からず運営上使えない。
  // status での絞り込みはしない。修了した受講生の過去回の出席記録も見えなくなるため。
  const { results: attendanceList } = await c.env.DB.prepare(
    `SELECT students.id AS student_id, students.name AS student_name,
            attendances.status, attendances.note
     FROM students
     LEFT JOIN attendances ON attendances.student_id = students.id AND attendances.lesson_id = ?
     ORDER BY students.id`
  )
    .bind(lessonId)
    .all<AttendanceRow>()

  return c.html(
    <AttendancesPage
      lessonList={lessonList}
      lessonId={lessonId}
      lessonNotFound={false}
      attendanceList={attendanceList}
    />
  )
})

export { attendances }
