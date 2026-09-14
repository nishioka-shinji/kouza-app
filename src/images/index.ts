import { Hono } from 'hono'

type ImageRow = {
  r2_key: string
}

const images = new Hono<{ Bindings: Env }>()

// <img> の GET に ID トークンを載せられないため、都度認証せず UUID の推測困難性に頼る（設計書 F3）。
images.get('/:id', async (c) => {
  const id = c.req.param('id')

  const image = await c.env.DB.prepare('SELECT r2_key FROM images WHERE id = ?')
    .bind(id)
    .first<ImageRow>()

  if (!image) {
    return c.notFound()
  }

  const object = await c.env.BUCKET.get(image.r2_key)

  if (!object) {
    return c.notFound()
  }

  const headers = new Headers()
  // Content-Type は D1 に持たず put() 時の httpMetadata から書き戻す。
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)
  // 本人だけが見る画像のため共有キャッシュには載せない。
  headers.set('cache-control', 'private, max-age=3600')

  // body（ReadableStream）をそのまま渡し、画像全体をメモリに載せない。
  return new Response(object.body, { headers })
})

export { images }
