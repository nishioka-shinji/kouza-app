import { getProfile } from '../line/api'
import { FALLBACK_NAME, upsertStudent } from './students'
import type { AttendanceStatus } from '../attendance'

// waitUntil() 内で実行する。確定応答は既に送信済みのため、ここでの失敗はログに残すのみでリトライしない。
// lesson_id は data 由来で改竄されうるため、応答前の確認と別にここでも実在確認してから書き込む。
async function saveAttendance(
  env: Env,
  lineUserId: string,
  lessonId: number,
  status: AttendanceStatus
): Promise<void> {
  const lesson = await env.DB.prepare('SELECT id FROM lessons WHERE id = ?')
    .bind(lessonId)
    .first<{ id: number }>()

  if (!lesson) {
    return
  }

  const profile = await getProfile(env.LINE_CHANNEL_ACCESS_TOKEN, lineUserId)
  const studentId = await upsertStudent(env.DB, lineUserId, profile?.displayName ?? FALLBACK_NAME)

  await env.DB.prepare(
    `INSERT INTO attendances (lesson_id, student_id, status)
     VALUES (?, ?, ?)
     ON CONFLICT (lesson_id, student_id) DO UPDATE SET status = excluded.status`
  )
    .bind(lessonId, studentId, status)
    .run()
}

export { saveAttendance }
