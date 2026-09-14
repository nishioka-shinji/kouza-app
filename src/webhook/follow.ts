import { getProfile } from '../line/api'
import { FALLBACK_NAME, upsertStudent } from './students'

// waitUntil() 内で実行する。reply は既に送信済みのため、ここでの失敗はログに残すのみでよい。
async function handleFollow(env: Env, lineUserId: string): Promise<void> {
  const profile = await getProfile(env.LINE_CHANNEL_ACCESS_TOKEN, lineUserId)
  await upsertStudent(env.DB, lineUserId, profile?.displayName ?? FALLBACK_NAME)
}

export { handleFollow }
