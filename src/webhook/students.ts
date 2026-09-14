// students.name は NOT NULL。表示名が取れない場合でも空文字は入れない。
const FALLBACK_NAME = '(名前未取得)'

// follow / message の両方から呼ぶ受講生の UPSERT。未登録の投稿者を落とさないための保険。
// 既存行があっても実名が取れたときは上書きする。取れなかった名前で確定させない。
async function upsertStudent(db: D1Database, lineUserId: string, name: string): Promise<number> {
  await db
    .prepare(
      `INSERT INTO students (line_user_id, name, status)
       VALUES (?, ?, 'enrolled')
       ON CONFLICT (line_user_id) DO UPDATE SET name = excluded.name WHERE excluded.name <> ?`
    )
    .bind(lineUserId, name, FALLBACK_NAME)
    .run()

  const student = await db
    .prepare('SELECT id FROM students WHERE line_user_id = ?')
    .bind(lineUserId)
    .first<{ id: number }>()

  if (!student) {
    throw new Error('failed to upsert student')
  }

  return student.id
}

export { upsertStudent, FALLBACK_NAME }
