import { Hono, type Context } from 'hono'
import type { webhook } from '@line/bot-sdk'
import { verifySignature } from './signature'
import { replyMessage, type QuickReplyItem } from '../line/api'
import { saveImage } from './image'
import { handleFollow } from './follow'
import { saveAttendance } from './attendance'
import { ATTENDANCE_STATUS_LABELS, formatAttendanceStatus, type AttendanceStatus } from '../attendance'

const webhookApp = new Hono<{ Bindings: Env }>()

const IMAGE_REPLY = (liffId: string) =>
  `写真を受け取りました。\nメモを書く → https://liff.line.me/${liffId}/images?memo=none`

const NON_IMAGE_REPLY =
  'このアカウントでは講座の写真を受け取ります。カメラロールから画像を送ってください。\n出欠の連絡はメニューの「出欠連絡」からお願いします。'

const FOLLOW_REPLY =
  '友だち追加ありがとうございます。\n講座で撮った写真をこのトークに送ると保存され、あとから感想やメモを書けます。\nまずは 1 枚送ってみてください。'

const ID_PATTERN = /^[0-9]+$/

// フォームと同じ「空文字・非数値を弾いてから数値化する」流儀（src/admin/images.tsx の parseId）。
const parseId = (value: string | null): number | null => {
  if (value === null || !ID_PATTERN.test(value)) {
    return null
  }
  return Number(value)
}

// クイックリプライの label は最大 20 文字。開催日 + タイトルが収まらない場合は切り詰める。
const LABEL_MAX_LENGTH = 20
const truncateLabel = (label: string): string =>
  label.length > LABEL_MAX_LENGTH ? `${label.slice(0, LABEL_MAX_LENGTH - 1)}…` : label

type Lesson = { id: number; held_on: string; title: string }

// items は maxItems 13。開催日が新しい順に 10 件へ絞り、直近の連絡で使う頻度が高い回を優先する。
async function fetchLessonsForQuickReply(db: D1Database): Promise<Lesson[]> {
  const { results } = await db
    .prepare('SELECT id, held_on, title FROM lessons ORDER BY held_on DESC LIMIT 10')
    .all<Lesson>()
  return results
}

// イベントごとに応答メッセージを送るだけの層。画像の取得・R2 保存・D1 への書き込みはここでは行わない。
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
    return
  }

  if (event.type === 'postback' && event.replyToken) {
    await replyToPostback(env, event.replyToken, event.postback.data)
  }
}

// data はクライアント由来で改竄されうる。lesson_id・status とも実在確認とホワイトリスト検証を必ず通す。
async function replyToPostback(env: Env, replyToken: string, data: string): Promise<void> {
  const params = new URLSearchParams(data)
  if (params.get('action') !== 'attendance') {
    return
  }

  const lessonId = parseId(params.get('lesson_id'))
  const statusParam = params.get('status')

  if (lessonId === null) {
    const lessons = await fetchLessonsForQuickReply(env.DB)
    if (lessons.length === 0) {
      await replyMessage(env.LINE_CHANNEL_ACCESS_TOKEN, replyToken, [
        { type: 'text', text: '講座回が登録されていません。' },
      ])
      return
    }

    const items: QuickReplyItem[] = lessons.map((lesson) => ({
      type: 'action',
      action: {
        type: 'postback',
        label: truncateLabel(`${lesson.held_on} ${lesson.title}`),
        data: `action=attendance&lesson_id=${lesson.id}`,
        displayText: `${lesson.held_on} ${lesson.title}`,
      },
    }))

    await replyMessage(env.LINE_CHANNEL_ACCESS_TOKEN, replyToken, [
      { type: 'text', text: 'どの回ですか？', quickReply: { items } },
    ])
    return
  }

  const lesson = await env.DB.prepare('SELECT id, held_on, title FROM lessons WHERE id = ?')
    .bind(lessonId)
    .first<Lesson>()

  if (!lesson) {
    // 実在しない lesson_id（改竄・削除済み）。DB を汚さず終える。
    return
  }

  if (statusParam === null || !Object.hasOwn(ATTENDANCE_STATUS_LABELS, statusParam)) {
    const items: QuickReplyItem[] = (
      Object.keys(ATTENDANCE_STATUS_LABELS) as AttendanceStatus[]
    ).map((status) => ({
      type: 'action',
      action: {
        type: 'postback',
        label: ATTENDANCE_STATUS_LABELS[status],
        data: `action=attendance&lesson_id=${lesson.id}&status=${status}`,
        displayText: ATTENDANCE_STATUS_LABELS[status],
      },
    }))

    await replyMessage(env.LINE_CHANNEL_ACCESS_TOKEN, replyToken, [
      {
        type: 'text',
        text: `${lesson.held_on} ${lesson.title}の出欠は？`,
        quickReply: { items },
      },
    ])
    return
  }

  const status = statusParam as AttendanceStatus
  await replyMessage(env.LINE_CHANNEL_ACCESS_TOKEN, replyToken, [
    {
      type: 'text',
      text: `${lesson.held_on} ${lesson.title}を「${formatAttendanceStatus(status)}」で承りました。`,
    },
  ])
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
    return
  }

  if (event.type === 'postback') {
    const params = new URLSearchParams(event.postback.data)
    const lessonId = parseId(params.get('lesson_id'))
    const status = params.get('status')

    if (
      params.get('action') === 'attendance' &&
      lessonId !== null &&
      status !== null &&
      Object.hasOwn(ATTENDANCE_STATUS_LABELS, status)
    ) {
      c.executionCtx.waitUntil(
        saveAttendance(c.env, lineUserId, lessonId, status as AttendanceStatus)
      )
    }
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
