import { Hono } from 'hono'
import { Layout } from './layout'
import { students } from './students'
import { lessons } from './lessons'
import { adminImages } from './images'
import { attendances } from './attendances'
import { notices } from './notices'

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
admin.route('/attendances', attendances)
admin.route('/notices', notices)

export { admin }
