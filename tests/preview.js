// Local-only QA server. Fixtures are explicitly labelled and never added to content.json.
// Homework deadlines are generated relative to today so every due-date group is exercised.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../', import.meta.url))
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.pdf': 'application/pdf' }
const day = offset => new Date(Date.now() + offset * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' })
const stamp = offset => new Date(Date.now() + offset * 86400000).toISOString()
const base = { targetClasses: ['all'], attachments: [], status: 'published' }
async function fixture() {
  const real = JSON.parse(await readFile(root + 'content.json', 'utf8'))
  return {
    schemaVersion: 1, updatedAt: null,
    homeworks: [
      { ...base, id: 'test-hw-today', title: '【测试】数学分析三 第十五章习题 1–12', subject: '数学分析III', submissionPlatform: 'chaoxing', deadline: day(0), description: '用于验证今天截止的分组与提醒，不是实际班级作业。\n\n要求：\n1. 写清推导过程；\n2. 拍照上传到学习通。', attachments: [{ name: '测试说明.md', url: 'files/test.md', size: 2048 }] },
      { ...base, id: 'test-hw-tomorrow', title: '【测试】概率论中段复习', subject: '概率论与数理统计', submissionPlatform: 'ketangpai', deadline: day(1), targetClasses: ['class_1'], description: '用于验证班级筛选和详情分享，不是实际班级作业。' },
      { ...base, id: 'test-hw-week', title: '【测试】大学英语三 Unit 3 写作练习', subject: '大学英语三', submissionPlatform: 'notebook', deadline: day(4), description: '用于验证线下提交提示，不是实际班级作业。' },
      { ...base, id: 'test-hw-later', title: '【测试】Python 实验二：列表与字典', subject: 'python', submissionPlatform: 'chaoxing', deadline: day(12), description: '用于验证较远截止日期的显示。' },
      { ...base, id: 'test-hw-expired', title: '【测试】心理学读书笔记', subject: '心理学', submissionPlatform: 'none', deadline: day(-2), description: '用于验证已截止状态。' }
    ],
    notices: [
      { ...base, id: 'test-notice-exam', title: '【测试】概率论与数理统计期中考试安排', category: 'exam', updatedAt: stamp(0), description: '仅用于已读状态测试。考试时间、地点以教务通知为准。' },
      { ...base, id: 'test-notice-course', title: '【测试】数学分析三本周调课', category: 'course', updatedAt: stamp(-1), description: '仅用于通知列表排版测试。' },
      { ...base, id: 'test-notice-old', title: '【测试】Python 实验课机房变更', category: 'course', updatedAt: stamp(-9), description: '较早的通知。' }
    ],
    materials: [...real.materials, { ...base, id: 'test-material', title: '【测试】概率论练习资料', subject: '概率论与数理统计', description: '验证资料链接展示。', category: 'paper', attachments: [{ name: '测试说明.md', url: 'files/test.md', size: 2048 }] }]
  }
}
createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
    if (pathname === '/content.json') { res.writeHead(200, { 'Content-Type': types['.json'], 'Cache-Control': 'no-store' }); res.end(JSON.stringify(await fixture())); return }
    if (pathname === '/files/test.md') { res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('学事板附件访问测试通过。'); return }
    const path = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname))
    if (!path.startsWith(root) || pathname.split('/').some(part => part.startsWith('.'))) { res.writeHead(403); res.end(); return }
    const body = await readFile(path)
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(body)
  } catch { res.writeHead(404); res.end() }
}).listen(Number(process.argv[2] || 4174), '127.0.0.1', () => console.log(`本地 QA：http://127.0.0.1:${process.argv[2] || 4174}`))
