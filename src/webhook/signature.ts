import { timingSafeEqual } from 'hono/utils/buffer'

// crypto.createHmac は Workers で使えないため Web Crypto で HMAC-SHA256 を計算する。
async function computeSignature(channelSecret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(channelSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))

  return btoa(String.fromCharCode(...new Uint8Array(signature)))
}

// ヘッダ欠落・シークレット未設定は例外を投げず false を返す。
async function verifySignature(
  channelSecret: string | undefined,
  signatureHeader: string | undefined,
  body: string
): Promise<boolean> {
  if (!channelSecret || !signatureHeader) {
    return false
  }

  const expected = await computeSignature(channelSecret, body)

  // 比較は必ず Base64 文字列同士で行う（timingSafeEqual の非 string 引数は deprecated）。
  return timingSafeEqual(expected, signatureHeader)
}

export { verifySignature }
