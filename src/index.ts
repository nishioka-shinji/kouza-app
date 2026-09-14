import { Hono } from 'hono'
import { admin } from './admin'
import { liff } from './liff'
import { webhook } from './webhook'

const app = new Hono<{ Bindings: Env }>()

app.get('/', (c) => c.text('Hello Hono!'))

app.route('/admin', admin)

// 受講生が LINE 内から開く。Cloudflare Access の保護対象に含めてはいけない。
app.route('/liff', liff)

// LINE プラットフォームからの POST。Cloudflare Access の保護対象に含めてはいけない。
app.route('/webhook', webhook)

export default app
