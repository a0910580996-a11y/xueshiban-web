import { courseRank, normalizeCourse } from './courses.js?v=20261007-9'
export const CLASSES = [['all', '全体'], ['class_1', '1班'], ['class_2', '2班'], ['class_3', '3班'], ['class_4', '4班']]
export const SUBMISSION_PLATFORMS = {
  none: { label: '无需在线跳转', url: '' },
  notebook: { label: '作业本（线下提交）', url: '' },
  chaoxing: { label: '学习通', url: 'https://i.chaoxing.com/' },
  ketangpai: { label: '课堂派', url: 'https://www.ketangpai.com/' }
}
export const CATEGORIES = {
  notices: { course: '课程通知', exam: '考试通知' },
  materials: { textbook: '课程资料', review: '复习资料', paper: '练习试卷', homeworkSolution: '作业解析', other: '其他' }
}
export function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}
export function safeUrl(value) {
  if (typeof value !== 'string' || !value || /[\x00-\x20\\]/.test(value)) return ''
  if (/^files\/[a-zA-Z0-9._/-]+$/.test(value) && !value.split('/').includes('..')) return value
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''
  } catch { return '' }
}
export function deadlineState(deadline, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline || '')) return { days: null, expired: false, label: '未设截止日期' }
  const today = new Date(now.toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' }) + 'T00:00:00+08:00')
  const days = Math.round((new Date(deadline + 'T00:00:00+08:00') - today) / 86400000)
  return { days, expired: days < 0, label: days < 0 ? '已截止' : days === 0 ? '今天截止' : days === 1 ? '明天截止' : `还剩 ${days} 天` }
}
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
export function shanghaiDate(now = new Date()) { return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' }) }
export function formatDate(value, { weekday = false, now = new Date() } = {}) {
  let ymd = ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(value || '')) ymd = value
  else if (typeof value === 'string' && value && !Number.isNaN(Date.parse(value))) ymd = shanghaiDate(new Date(value))
  if (!ymd) return ''
  const [y, m, d] = ymd.split('-').map(Number)
  const year = y === Number(shanghaiDate(now).slice(0, 4)) ? '' : `${y}年`
  return `${year}${m}月${d}日${weekday ? ` 周${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}` : ''}`
}
export function fileExtension(name = '') { const match = /\.([a-z0-9]{1,6})$/i.exec(name); return match ? match[1].toLowerCase() : '' }

export const DUE_GROUPS = { today: '今天截止', tomorrow: '明天截止', week: '7 天内截止', later: '7 天后截止', expired: '已截止', done: '已完成' }
export function dueGroup(item, done = [], now = new Date()) {
  if (done.includes(item.id)) return 'done'
  const { days } = deadlineState(item.deadline, now)
  if (days === null || days > 7) return 'later'
  return days < 0 ? 'expired' : days === 0 ? 'today' : days === 1 ? 'tomorrow' : 'week'
}
export function groupBy(items, keyOf, labelOf = key => key) {
  const groups = new Map()
  for (const item of items) {
    const key = keyOf(item)
    if (!groups.has(key)) groups.set(key, { key, label: labelOf(key), items: [] })
    groups.get(key).items.push(item)
  }
  return [...groups.values()]
}
export function groupHomeworks(items, { done = [], sort = 'deadline-asc', now = new Date() } = {}) {
  if (sort === 'subject') return groupBy(items, item => normalizeCourse(item.subject))
  const active = ['today', 'tomorrow', 'week', 'later']
  const order = [...(sort === 'deadline-desc' ? active.reverse() : active), 'expired', 'done']
  const groups = groupBy(items, item => dueGroup(item, done, now), key => DUE_GROUPS[key])
  return order.map(key => groups.find(group => group.key === key)).filter(Boolean)
}

export function visibleItems(data, kind, { classId = 'all', query = '', filter = 'all', done = [], subject = 'all', sort = 'deadline-asc', format = 'all' } = {}) {
  return data[kind].filter(item => {
    if (item.status !== 'published') return false
    if (classId !== 'all' && !item.targetClasses.includes('all') && !item.targetClasses.includes(classId)) return false
    if (query && !`${item.title} ${item.description || item.content || ''} ${normalizeCourse(item.subject)} ${item.attachments.map(a => a.name).join(' ')}`.toLowerCase().includes(normalizeCourse(query.trim()).toLowerCase())) return false
    if (subject !== 'all' && normalizeCourse(item.subject) !== normalizeCourse(subject)) return false
    if (format !== 'all' && !item.attachments.some(a => a.name.toLowerCase().endsWith('.' + format))) return false
    if (kind === 'homeworks') {
      if (filter === 'pending') return !done.includes(item.id) && !deadlineState(item.deadline).expired
      if (filter === 'done') return done.includes(item.id)
      if (filter === 'expired') return deadlineState(item.deadline).expired
    } else if (filter !== 'all' && item.category !== filter) return false
    return true
  }).sort((a, b) => {
    if (kind !== 'homeworks') {
      if (kind === 'materials' && sort !== 'title') {
        const courseOrder = courseRank(a.subject) - courseRank(b.subject) || normalizeCourse(a.subject).localeCompare(normalizeCourse(b.subject), 'zh-CN')
        if (courseOrder) return courseOrder
      }
      return sort === 'title' ? a.title.localeCompare(b.title, 'zh-CN') : (b.updatedAt || '').localeCompare(a.updatedAt || '') || a.title.localeCompare(b.title, 'zh-CN')
    }
    if (sort === 'subject') return a.subject.localeCompare(b.subject, 'zh-CN') || (a.deadline || '9999').localeCompare(b.deadline || '9999')
    const order = (a.deadline || '9999').localeCompare(b.deadline || '9999')
    return sort === 'deadline-desc' ? -order : order
  })
}
export function validateContent(data) {
  if (!data || data.schemaVersion !== 1) throw new Error('内容文件版本不受支持。')
  const seen = new Set()
  for (const kind of ['homeworks', 'notices', 'materials']) {
    if (!Array.isArray(data[kind])) throw new Error('内容文件不完整。')
    for (const item of data[kind]) {
      if (!item || typeof item.id !== 'string' || !item.id || seen.has(item.id)) throw new Error('内容标识缺失或重复。')
      seen.add(item.id)
      if (item.subject !== undefined && (typeof item.subject !== 'string' || item.subject.length > 100)) throw new Error('课程名称无效。')
      if (typeof item.title !== 'string' || !item.title.trim() || item.title.length > 120) throw new Error('标题必须在 1–120 字之间。')
      if (!['published', 'draft', 'withdrawn'].includes(item.status)) throw new Error('内容状态无效。')
      if (!Array.isArray(item.targetClasses) || !item.targetClasses.length || item.targetClasses.some(c => !CLASSES.some(([id]) => id === c))) throw new Error('请选择有效班级。')
      if (kind === 'homeworks' && (!item.subject || !/^\d{4}-\d{2}-\d{2}$/.test(item.deadline || '') || Number.isNaN(Date.parse(item.deadline)))) throw new Error('作业需要课程和有效截止日期。')
      if (kind === 'homeworks' && item.submissionPlatform !== undefined && (typeof item.submissionPlatform !== 'string' || !Object.hasOwn(SUBMISSION_PLATFORMS, item.submissionPlatform))) throw new Error('提交平台无效。')
      if (kind !== 'homeworks' && !CATEGORIES[kind][item.category]) throw new Error('分类无效。')
      if (!Array.isArray(item.attachments) || item.attachments.length > 3 || item.attachments.some(a => !safeUrl(a.url) || !a.name || (a.size !== undefined && (!Number.isFinite(a.size) || a.size < 0)))) throw new Error('附件必须使用有效的 HTTPS 链接或站内文件，最多三个，大小必须有效。')
    }
  }
  return data
}
