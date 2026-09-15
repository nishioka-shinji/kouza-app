// LINE Messaging API を fetch で直接叩くクライアント。@line/bot-sdk 本体は Node 依存のため使わない。
import type { messagingApi } from '@line/bot-sdk'

// リッチメニューの画像アップロードも api-data 側（段階 8 T6）。api.line.me と取り違えると 404 になる。
const API_HOST = 'https://api.line.me'
const API_DATA_HOST = 'https://api-data.line.me'

// items は maxItems 13、postback の data は maxLength 300（公式 OpenAPI 定義）。検証は呼び出し側の責務。
type QuickReplyItem = {
  type: 'action'
  action: {
    type: 'postback'
    label: string
    data: string
    displayText?: string
  }
}

type ReplyMessage = {
  type: 'text'
  text: string
  quickReply?: { items: QuickReplyItem[] }
}

type Profile = {
  displayName: string
  userId: string
  language?: string
  pictureUrl?: string
  statusMessage?: string
}

// 送信の成功可否と、失敗時に画面へ出せる理由を呼び出し側へ返す。
type SendResult = { ok: true } | { ok: false; reason: string }

// 応答トークンは 1 回限り。失敗しても例外を投げず、200 の返却を止めない。
async function replyMessage(
  channelAccessToken: string,
  replyToken: string,
  messages: ReplyMessage[]
): Promise<void> {
  try {
    const res = await fetch(`${API_HOST}/v2/bot/message/reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({ replyToken, messages }),
    })

    if (!res.ok) {
      console.error(`reply message failed: ${res.status}`)
    }
  } catch (err) {
    console.error('reply message error', err)
  }
}

// 管理画面から呼ばれる。送信済みとして記録してよいかを運営者が判断できるよう、成否を戻り値で返す。
async function broadcastMessage(
  channelAccessToken: string,
  messages: ReplyMessage[]
): Promise<SendResult> {
  try {
    const res = await fetch(`${API_HOST}/v2/bot/message/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({ messages }),
    })

    if (!res.ok) {
      const body = await res.text()
      return { ok: false, reason: `broadcast failed: ${res.status} ${body}` }
    }

    return { ok: true }
  } catch (err) {
    return { ok: false, reason: `broadcast error: ${String(err)}` }
  }
}

// ブロック中・未友だち・同意なしの場合は 404 が返り取得できない。
async function getProfile(
  channelAccessToken: string,
  userId: string
): Promise<Profile | null> {
  const res = await fetch(`${API_HOST}/v2/bot/profile/${userId}`, {
    headers: { Authorization: `Bearer ${channelAccessToken}` },
  })

  if (!res.ok) {
    return null
  }

  return res.json<Profile>()
}

// 当月の送信済みメッセージ数。取得できなくても画面自体は表示したいため null を返す（getProfile と同じ流儀）。
async function getMessageQuotaConsumption(
  channelAccessToken: string
): Promise<messagingApi.QuotaConsumptionResponse | null> {
  const res = await fetch(`${API_HOST}/v2/bot/message/quota/consumption`, {
    headers: { Authorization: `Bearer ${channelAccessToken}` },
  })

  if (!res.ok) {
    return null
  }

  return res.json<messagingApi.QuotaConsumptionResponse>()
}

// コンテンツ取得は api-data.line.me（api.line.me ではない）。202/404/410 は呼び出し側でハンドリングする。
async function getMessageContent(
  channelAccessToken: string,
  messageId: string
): Promise<Response> {
  return fetch(`${API_DATA_HOST}/v2/bot/message/${messageId}/content`, {
    headers: { Authorization: `Bearer ${channelAccessToken}` },
  })
}

export {
  replyMessage,
  broadcastMessage,
  getProfile,
  getMessageQuotaConsumption,
  getMessageContent,
}
export type { ReplyMessage, QuickReplyItem, Profile, SendResult }
