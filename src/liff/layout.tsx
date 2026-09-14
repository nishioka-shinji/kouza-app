import type { Child, FC } from 'hono/jsx'

type LayoutProps = {
  title: string
  children: Child
}

// LIFF 画面の共通の外枠。SDK は CDN から読む（npm の @line/liff は入れない）。
// charset="utf-8" は SDK が UTF-8 で書かれているため公式が指定を求めている。
export const Layout: FC<LayoutProps> = ({ title, children }) => (
  <html lang="ja">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{title} - 講座運営アプリ</title>
      <script charset="utf-8" src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>
      <style>{`
        body { font-family: sans-serif; margin: 0; color: #222; }
        main { padding: 1.5rem; max-width: 600px; }
        dl { background: #f5f5f5; padding: 1rem; }
        dt { font-weight: bold; }
        dd { margin: 0 0 0.75rem; word-break: break-all; }
        .error { color: #c00; }
        .image-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 0.75rem; list-style: none; padding: 0; margin: 0; }
        .image-grid a { display: block; color: inherit; text-decoration: none; }
        .image-grid img { width: 100%; aspect-ratio: 1; object-fit: cover; background: #eee; border-radius: 4px; }
        .image-meta { font-size: 0.8rem; line-height: 1.5; margin-top: 0.25rem; }
        .image-meta .memo-none { color: #c60; }
        .edit-image { max-width: 100%; margin-bottom: 1rem; border-radius: 4px; }
        form label { display: block; margin-bottom: 1rem; font-weight: bold; }
        form select, form textarea { display: block; width: 100%; margin-top: 0.25rem; padding: 0.5rem; font-family: inherit; font-size: 1rem; box-sizing: border-box; }
        form textarea { min-height: 8rem; resize: vertical; }
        form button { padding: 0.6rem 1.5rem; font-size: 1rem; }
        .notice { color: #060; }
      `}</style>
    </head>
    <body>
      <main>
        <h1>{title}</h1>
        {children}
      </main>
    </body>
  </html>
)
