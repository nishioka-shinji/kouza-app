import { getMessageContent, getProfile } from '../line/api'
import { FALLBACK_NAME, upsertStudent } from './students'

// waitUntil() 内で実行する。応答メッセージは既に送信済みのため、ここでの失敗はログに残すのみでリトライしない。
async function saveImage(
  env: Env,
  lineUserId: string,
  messageId: string
): Promise<void> {
  const profile = await getProfile(env.LINE_CHANNEL_ACCESS_TOKEN, lineUserId)
  const studentId = await upsertStudent(env.DB, lineUserId, profile?.displayName ?? FALLBACK_NAME)

  const contentRes = await getMessageContent(env.LINE_CHANNEL_ACCESS_TOKEN, messageId)

  if (!contentRes.ok) {
    // 404: 存在しない、410: 送信取消、202: 大きいファイルで準備中。いずれもリトライせず終える。
    console.error(`get message content failed: ${contentRes.status}`)
    return
  }

  if (!contentRes.body) {
    console.error('get message content returned no body')
    return
  }

  // 受信日時・UUID・拡張子を混ぜない。再送時に同じキーへ上書きするための決定的な導出。
  const r2Key = `${studentId}/${messageId}`
  const contentType = contentRes.headers.get('content-type') ?? undefined

  await env.BUCKET.put(r2Key, contentRes.body, {
    httpMetadata: { contentType },
  })

  await env.DB.prepare(
    `INSERT INTO images (id, student_id, line_message_id, r2_key)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (line_message_id) DO NOTHING`
  )
    .bind(crypto.randomUUID(), studentId, messageId, r2Key)
    .run()
}

export { saveImage }
