export const CLASSES = [['all', '全体'], ['class_1', '1班'], ['class_2', '2班'], ['class_3', '3班'], ['class_4', '4班']]
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
export function visibleItems(data, kind, { classId = 'all', query = '', filter = 'all', done = [], subject = 'all', sort = 'deadline-asc' } = {}) {
  return data[kind].filter(item => {
    if (item.status !== 'published') return false
    if (classId !== 'all' && !item.targetClasses.includes('all') && !item.targetClasses.includes(classId)) return false
    if (query && !`${item.title} ${item.description || item.content || ''} ${item.subject || ''}`.toLowerCase().includes(query.toLowerCase())) return false
    if (kind === 'homeworks') {
      if (subject !== 'all' && item.subject !== subject) return false
      if (filter === 'pending') return !done.includes(item.id) && !deadlineState(item.deadline).expired
      if (filter === 'done') return done.includes(item.id)
      if (filter === 'expired') return deadlineState(item.deadline).expired
    } else if (filter !== 'all' && item.category !== filter) return false
    return true
  }).sort((a, b) => {
    if (kind !== 'homeworks') return (b.updatedAt || '').localeCompare(a.updatedAt || '')
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
      if (typeof item.title !== 'string' || !item.title.trim() || item.title.length > 120) throw new Error('标题必须在 1–120 字之间。')
      if (!['published', 'draft', 'withdrawn'].includes(item.status)) throw new Error('内容状态无效。')
      if (!Array.isArray(item.targetClasses) || !item.targetClasses.length || item.targetClasses.some(c => !CLASSES.some(([id]) => id === c))) throw new Error('请选择有效班级。')
      if (kind === 'homeworks' && (!item.subject || !/^\d{4}-\d{2}-\d{2}$/.test(item.deadline || '') || Number.isNaN(Date.parse(item.deadline)))) throw new Error('作业需要课程和有效截止日期。')
      if (kind !== 'homeworks' && !CATEGORIES[kind][item.category]) throw new Error('分类无效。')
      if (!Array.isArray(item.attachments) || item.attachments.length > 3 || item.attachments.some(a => !safeUrl(a.url) || !a.name)) throw new Error('附件必须使用有效的 HTTPS 链接或站内文件，最多三个。')
    }
  }
  return data
}
