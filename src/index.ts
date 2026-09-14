import { Hono } from 'hono'
import { admin } from './admin'
import { liff } from './liff'

const app = new Hono<{ Bindings: Env }>()

app.get('/', (c) => c.text('Hello Hono!'))

app.route('/admin', admin)

// 受講生が LINE 内から開く。Cloudflare Access の保護対象に含めてはいけない。
app.route('/liff', liff)

export default app
