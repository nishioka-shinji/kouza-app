// 段階 8 T6。使い捨てスクリプトのため tsconfig.json の include に含めず npm run typecheck の対象外。
// Node 24 の型ストリップでそのまま実行する（tsx 等は追加しない）。型注釈のみで enum 等は使わない。
//
// 実行前に LINE_CHANNEL_ACCESS_TOKEN を用意すること（.dev.vars から --env-file で読み込む）。
// 実行するとデフォルトのリッチメニューが本番の全友だちに即時反映される。取り消せないため必ず --yes を明示する。
//
//   npm run richmenu:create -- --yes

import { readFile } from 'node:fs/promises'

const API_HOST = 'https://api.line.me'
const API_DATA_HOST = 'https://api-data.line.me'

const IMAGE_PATH = new URL('../assets/richmenu.png', import.meta.url)
const IMAGE_WIDTH = 2500
const IMAGE_HEIGHT = 843

// 右半分は「写真を送る」。カメラアクションはクイックリプライ専用でリッチメニューには使えない
// （公式リファレンス: カメラアクション「クイックリプライボタンにのみ設定できるアクションです」）。
// uri アクションで LINE URL スキームの https://line.me/R/nv/camera/ を開く（非推奨の line:// は使わない）。
const CAMERA_URI = 'https://line.me/R/nv/camera/'

type RichMenuArea = {
  bounds: { x: number; y: number; width: number; height: number }
  action:
    | { type: 'postback'; label: string; data: string }
    | { type: 'uri'; label: string; uri: string }
}

type RichMenuRequest = {
  size: { width: number; height: number }
  selected: boolean
  name: string
  chatBarText: string
  areas: RichMenuArea[]
}

// トーク画面を開いた瞬間から出ていてほしい（隠れた状態から都度開く操作を挟みたくない）ため true にする。
const richMenu: RichMenuRequest = {
  size: { width: IMAGE_WIDTH, height: IMAGE_HEIGHT },
  selected: true,
  name: 'stage8-attendance-notices',
  chatBarText: 'メニューを開く',
  areas: [
    {
      bounds: { x: 0, y: 0, width: IMAGE_WIDTH / 2, height: IMAGE_HEIGHT },
      action: { type: 'postback', label: '出欠連絡', data: 'action=attendance' },
    },
    {
      bounds: { x: IMAGE_WIDTH / 2, y: 0, width: IMAGE_WIDTH / 2, height: IMAGE_HEIGHT },
      action: { type: 'uri', label: '写真を送る', uri: CAMERA_URI },
    },
  ],
}

function getAccessToken(): string {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) {
    throw new Error(
      'LINE_CHANNEL_ACCESS_TOKEN が未設定です。--env-file=.dev.vars を付けて実行してください。'
    )
  }
  return token
}

async function createRichMenu(token: string): Promise<string> {
  const res = await fetch(`${API_HOST}/v2/bot/richmenu`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(richMenu),
  })

  const body = await res.text()
  console.log(`[1/4] create richmenu: ${res.status}`)
  if (!res.ok) {
    throw new Error(`リッチメニューの作成に失敗しました: ${res.status} ${body}`)
  }

  const { richMenuId } = JSON.parse(body) as { richMenuId: string }
  console.log(`  richMenuId = ${richMenuId}`)
  return richMenuId
}

async function uploadImage(token: string, richMenuId: string): Promise<void> {
  const imageBuffer = await readFile(IMAGE_PATH)

  const res = await fetch(`${API_DATA_HOST}/v2/bot/richmenu/${richMenuId}/content`, {
    method: 'POST',
    headers: {
      'Content-Type': 'image/png',
      Authorization: `Bearer ${token}`,
    },
    body: imageBuffer,
  })

  console.log(`[2/4] upload image: ${res.status}`)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`画像のアップロードに失敗しました: ${res.status} ${body}`)
  }
}

async function setAsDefault(token: string, richMenuId: string): Promise<void> {
  const res = await fetch(`${API_HOST}/v2/bot/user/all/richmenu/${richMenuId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })

  console.log(`[3/4] set default: ${res.status}`)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`デフォルト設定に失敗しました: ${res.status} ${body}`)
  }
}

type RichMenuListItem = { richMenuId: string }

// 新メニューの設定が終わるまで旧メニューを残すため、削除は最後・新規 ID を除外して行う。
// 失敗しても新メニューは既にデフォルト設定済みなので、ここは致命的エラーにしない。
async function deleteOldRichMenus(token: string, newRichMenuId: string): Promise<boolean> {
  const res = await fetch(`${API_HOST}/v2/bot/richmenu/list`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    const body = await res.text()
    console.error(`[4/4] 旧リッチメニュー一覧の取得に失敗しました: ${res.status} ${body}`)
    return false
  }

  const { richmenus } = (await res.json()) as { richmenus: RichMenuListItem[] }
  const oldMenus = richmenus.filter(({ richMenuId }) => richMenuId !== newRichMenuId)
  console.log(`[4/4] old richmenus: ${oldMenus.length} 件`)

  let allDeleted = true

  for (const { richMenuId } of oldMenus) {
    const delRes = await fetch(`${API_HOST}/v2/bot/richmenu/${richMenuId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    console.log(`  delete ${richMenuId}: ${delRes.status}`)
    if (!delRes.ok) {
      const body = await delRes.text()
      console.error(`  旧リッチメニューの削除に失敗しました: ${delRes.status} ${body}`)
      allDeleted = false
    }
  }

  return allDeleted
}

const USAGE = `使い方: npm run richmenu:create -- --yes

このスクリプトは実行すると次を行います。
  1. 新しいリッチメニューを作成し、画像をアップロードする
  2. 本番の全友だちにデフォルトとして即時反映する（取り消せません）
  3. 反映後、新メニュー以外の既存リッチメニューを削除する

意図した実行であることを示すため、--yes を付けて実行してください。`

// npm run 経由でも別のフラグが無視されて実行されないよう、--yes 以外は全て拒否する。
function assertConfirmed(): void {
  const arg = process.argv[2]
  if (arg === '--yes') return

  console.error(USAGE)
  process.exit(1)
}

async function main(): Promise<void> {
  assertConfirmed()
  const token = getAccessToken()

  const richMenuId = await createRichMenu(token)
  await uploadImage(token, richMenuId)
  await setAsDefault(token, richMenuId)
  const allDeleted = await deleteOldRichMenus(token, richMenuId)

  // 新メニューの反映は済んでいるので終了コードは 0 のまま。最終行だけ出し分けて残留に気づけるようにする。
  console.log(
    allDeleted
      ? '完了しました。'
      : '完了しました。ただし旧リッチメニューの削除に失敗しています。手動で削除してください。'
  )
}

main().catch((err) => {
  console.error(String(err))
  process.exit(1)
})
