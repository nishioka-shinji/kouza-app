// LINE の ID トークン検証エンドポイントを fetch で直接叩く。@line/bot-sdk 本体は Node 依存のため使わない。

type VerifyResult = {
  sub: string
  aud?: string
  exp?: number
  iss?: string
}

// aud / exp の検証はエンドポイント側が行うため、ここでは sub を取り出すだけでよい。
// 呼び出し側は 401 を返すだけなので、失敗の種類は区別せずすべて null に潰す。
async function verifyIdToken(idToken: string, clientId: string): Promise<string | null> {
  try {
    const res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ id_token: idToken, client_id: clientId }),
    })

    if (!res.ok) {
      console.error(`verify id token failed: ${res.status}`)
      return null
    }

    const result = await res.json<VerifyResult>()

    return result.sub || null
  } catch (err) {
    console.error('verify id token error', err)
    return null
  }
}

export { verifyIdToken }
export type { VerifyResult }
