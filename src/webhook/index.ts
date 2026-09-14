import { Hono, type Context } from 'hono'
import type { webhook } from '@line/bot-sdk'
import { verifySignature } from './signature'
import { replyMessage } from '../line/api'
import { saveImage } from './image'
import { handleFollow } from './follow'

const webhookApp = new Hono<{ Bindings: Env }>()

const IMAGE_REPLY = (liffId: string) =>
  `写真を受け取りました。\nメモを書く → https://liff.line.me/${liffId}/images?memo=none`

const NON_IMAGE_REPLY =
  'このアカウントでは講座の写真を受け取ります。カメラロールから画像を送ってください。'

const FOLLOW_REPLY =
  '友だち追加ありがとうございます。\n講座で撮った写真をこのトークに送ると保存され、あとから感想やメモを書けます。\nまずは 1 枚送ってみてください。'

// イベントごとに応答メッセージを送るだけの層。画像の取得・R2 保存・D1 INSERT はここでは行わない。
async function replyToEvent(env: Env, event: webhook.Event): Promise<void> {
  if (event.type === 'message' && event.replyToken) {
    const text =
      event.message.type === 'image' ? IMAGE_REPLY(env.LIFF_ID) : NON_IMAGE_REPLY
    await replyMessage(env.LINE_CHANNEL_ACCESS_TOKEN, event.replyToken, [
      { type: 'text', text },
    ])
    return
  }

  if (event.type === 'follow') {
    await replyMessage(env.LINE_CHANNEL_ACCESS_TOKEN, event.replyToken, [
      { type: 'text', text: FOLLOW_REPLY },
    ])
  }
}

// 200 を返した後に continue させる重い処理。応答は既に送信済み。
function scheduleFollowUp(c: Context<{ Bindings: Env }>, event: webhook.Event): void {
  if (event.source?.type !== 'user' || !event.source.userId) {
    // グループ・ルームは userId を持たず student を特定できないため無視する。
    return
  }
  const lineUserId = event.source.userId

  if (event.type === 'message' && event.message.type === 'image') {
    c.executionCtx.waitUntil(saveImage(c.env, lineUserId, event.message.id))
    return
  }

  if (event.type === 'follow') {
    c.executionCtx.waitUntil(handleFollow(c.env, lineUserId))
  }
}

webhookApp.post('/', async (c) => {
  const body = await c.req.text()
  const signature = c.req.header('x-line-signature')

  const isValid = await verifySignature(c.env.LINE_CHANNEL_SECRET, signature, body)
  if (!isValid) {
    return c.body(null, 401)
  }

  // LINE の「検証」ボタンでは events が空配列で飛んでくる。エラーにせず 200 を返す。
  const payload = JSON.parse(body) as webhook.CallbackRequest
  const events = payload.events ?? []

  for (const event of events) {
    // reply token は 1 回限り。イベント処理中の例外で後続イベントや 200 の返却を止めない。
    try {
      await replyToEvent(c.env, event)
      scheduleFollowUp(c, event)
    } catch (err) {
      console.error('webhook event handling failed', err)
    }
  }

  return c.body(null, 200)
})

export { webhookApp as webhook }
