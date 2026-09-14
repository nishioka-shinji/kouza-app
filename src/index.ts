import { Hono } from 'hono'
import { admin } from './admin'

const app = new Hono<{ Bindings: Env }>()

app.get('/', (c) => c.text('Hello Hono!'))

app.route('/admin', admin)

export default app
