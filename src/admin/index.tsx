import { Hono } from 'hono'
import { Layout } from './layout'
import { students } from './students'
import { lessons } from './lessons'
import { adminImages } from './images'

const admin = new Hono<{ Bindings: Env }>()

admin.get('/', (c) =>
  c.html(
    <Layout title="管理画面">
      <p>受講生一覧・講座回一覧はナビゲーションから選択してください。</p>
    </Layout>
  )
)

admin.route('/students', students)
admin.route('/lessons', lessons)
admin.route('/images', adminImages)

export { admin }
