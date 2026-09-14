// LINE Messaging API を fetch で直接叩くクライアント。@line/bot-sdk 本体は Node 依存のため使わない。

type ReplyMessage = {
  type: 'text'
  text: string
}

type Profile = {
  displayName: string
  userId: string
  language?: string
  pictureUrl?: string
  statusMessage?: string
}

// 応答トークンは 1 回限り。失敗しても例外を投げず、200 の返却を止めない。
async function replyMessage(
  channelAccessToken: string,
  replyToken: string,
  messages: ReplyMessage[]
): Promise<void> {
  try {
    const res = await fetch('https://api.line.me/v2/bot/message/reply', {
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

// ブロック中・未友だち・同意なしの場合は 404 が返り取得できない。
async function getProfile(
  channelAccessToken: string,
  userId: string
): Promise<Profile | null> {
  const res = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
    headers: { Authorization: `Bearer ${channelAccessToken}` },
  })

  if (!res.ok) {
    return null
  }

  return res.json<Profile>()
}

// コンテンツ取得は api-data.line.me（api.line.me ではない）。202/404/410 は呼び出し側でハンドリングする。
async function getMessageContent(
  channelAccessToken: string,
  messageId: string
): Promise<Response> {
  return fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
    headers: { Authorization: `Bearer ${channelAccessToken}` },
  })
}

export { replyMessage, getProfile, getMessageContent }
export type { ReplyMessage, Profile }
