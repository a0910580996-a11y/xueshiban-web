// Local-only QA server. Fixtures are explicitly labelled and never added to content.json.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../', import.meta.url))
const content = {
  schemaVersion: 1, updatedAt: null,
  homeworks: [
    { id: 'test-hw-1', title: '【测试】第三章课后习题', subject: '数学分析III', description: '用于验证网页排版和完成标记，不是实际班级作业。', deadline: '2999-10-10', targetClasses: ['class_1'], attachments: [], status: 'published' },
    { id: 'test-hw-2', title: '【测试】概率论中段复习', subject: '概率论与数理统计', description: '用于验证班级筛选和详情分享，不是实际班级作业。', deadline: '2999-10-12', targetClasses: ['all'], attachments: [], status: 'published' }
  ],
  notices: [{ id: 'test-notice', title: '【测试】课程安排通知', description: '仅用于已读状态测试。', category: 'course', targetClasses: ['all'], attachments: [], status: 'published' }],
  materials: [{ id: 'test-material', title: '【测试】概率论练习资料', description: '验证资料链接展示。', category: 'paper', targetClasses: ['all'], attachments: [{ name: '测试说明.md', url: 'files/test.md' }], status: 'published' }]
}
createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname
  if (path === '/content.json') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(content)); return }
  if (path === '/files/test.md') { res.setHeader('Content-Type', 'text/plain; charset=utf-8'); res.end('学事板附件访问测试通过。'); return }
  if (['/assets/study-landscape.jpg', '/assets/notices-background.jpg', '/assets/materials-background.jpg'].includes(path)) { res.setHeader('Content-Type', 'image/jpeg'); res.end(await readFile(root + path.slice(1))); return }
  if (!['/', '/index.html', '/styles.css', '/app.js', '/domain.js', '/github.js', '/config.js'].includes(path)) { res.writeHead(404); res.end(); return }
  try { const name = path === '/' ? 'index.html' : path.slice(1); res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html'); res.end(await readFile(root + name)) } catch { res.writeHead(404); res.end() }
}).listen(Number(process.argv[2] || 4174), '127.0.0.1', () => console.log(`本地 QA：http://127.0.0.1:${process.argv[2] || 4174}`))
