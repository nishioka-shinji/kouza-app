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
