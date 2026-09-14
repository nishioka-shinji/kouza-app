import { createMiddleware } from 'hono/factory'
import { verifyIdToken } from '../line/verify'

type LiffEnv = {
  Bindings: Env
  Variables: { lineUserId: string }
}

// liff.getProfile() の値は自称なので信用せず、ID トークンを検証して得た sub だけを使う。
// トークンは Authorization ヘッダのみから読む（body を読むとハンドラ側の parseBody と二重消費になる）。
// client_id は Messaging API ではなく LINE Login チャネルの ID。取り違えると検証が通らない。
const requireLineUser = createMiddleware<LiffEnv>(async (c, next) => {
  const authorization = c.req.header('Authorization')

  if (!authorization?.startsWith('Bearer ')) {
    return c.text('Unauthorized', 401)
  }

  const idToken = authorization.slice('Bearer '.length)
  const lineUserId = await verifyIdToken(idToken, c.env.LINE_LOGIN_CHANNEL_ID)

  if (!lineUserId) {
    return c.text('Unauthorized', 401)
  }

  c.set('lineUserId', lineUserId)

  await next()
})

export { requireLineUser }
export type { LiffEnv }
