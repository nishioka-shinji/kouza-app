import type { Child, FC } from 'hono/jsx'

type LayoutProps = {
  title: string
  children: Child
}

// 管理画面の共通の外枠。CSS フレームワークは入れず素の style で足りる分だけ整える。
export const Layout: FC<LayoutProps> = ({ title, children }) => (
  <html lang="ja">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{title} - 講座運営アプリ</title>
      <style>{`
        body { font-family: sans-serif; margin: 0; color: #222; }
        nav { background: #333; padding: 0.75rem 1rem; }
        nav a { color: #fff; margin-right: 1rem; text-decoration: none; }
        nav a:hover { text-decoration: underline; }
        main { padding: 1.5rem; max-width: 800px; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 1.5rem; }
        th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
        th { background: #f5f5f5; }
        form { margin-bottom: 1.5rem; }
        label { display: block; margin-bottom: 0.5rem; }
        input, select { padding: 0.3rem; }
        .error { color: #c00; }
      `}</style>
    </head>
    <body>
      <nav>
        <a href="/admin/students">受講生一覧</a>
        <a href="/admin/lessons">講座回一覧</a>
      </nav>
      <main>
        <h1>{title}</h1>
        {children}
      </main>
    </body>
  </html>
)
