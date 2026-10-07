import test from 'node:test'
import assert from 'node:assert/strict'
import { groupHomeworks, formatDate, dueGroup } from '../domain.js'
import { shortCourse, courseTone, courseRank, TONE_COUNT } from '../courses.js'
import { homeworkRow, noticeRow, detailView, navCounts, studentView, submissionLink } from '../student-view.js'
import { icon } from '../icons.js'

const now = new Date('2026-10-07T04:00:00Z')
const hw = (id, deadline, extra = {}) => ({ id, title: id, subject: '数学分析三', deadline, targetClasses: ['all'], attachments: [], status: 'published', ...extra })
const baseState = { classId: 'all', query: '', filter: 'all', subject: 'all', sort: 'deadline-asc', format: 'all', limit: 24, done: [], read: [] }

test('作业按截止时间分组：今天、明天、7 天内、更晚、已截止、已完成', () => {
  const items = [hw('later', '2026-10-20'), hw('today', '2026-10-07'), hw('week', '2026-10-12'), hw('tomorrow', '2026-10-08'), hw('expired', '2026-10-01'), hw('done', '2026-10-07')]
  const groups = groupHomeworks(items, { done: ['done'], now })
  assert.deepEqual(groups.map(g => g.key), ['today', 'tomorrow', 'week', 'later', 'expired', 'done'])
  assert.deepEqual(groups.map(g => g.items.map(i => i.id)), [['today'], ['tomorrow'], ['week'], ['later'], ['expired'], ['done']])
  assert.deepEqual(groupHomeworks(items, { done: ['done'], sort: 'deadline-desc', now }).map(g => g.key), ['later', 'week', 'tomorrow', 'today', 'expired', 'done'])
  assert.deepEqual(groupHomeworks([hw('a', '2026-10-09', { subject: '概率论' }), hw('b', '2026-10-09')], { sort: 'subject', now }).map(g => g.key), ['概率论与数理统计', '数学分析三'])
  assert.equal(dueGroup(hw('x', '2026-10-14'), [], now), 'week')
  assert.equal(dueGroup(hw('x', '2026-10-15'), [], now), 'later')
})

test('日期按上海时区显示，跨年才显示年份', () => {
  assert.equal(formatDate('2026-10-12', { weekday: true, now }), '10月12日 周一')
  assert.equal(formatDate('2027-01-03', { now }), '2027年1月3日')
  assert.equal(formatDate('2026-10-06T17:30:00Z', { now }), '10月7日')
  assert.equal(formatDate('not a date', { now }), '')
  assert.equal(formatDate(undefined, { now }), '')
})

test('课程简称与配色稳定，未知课程也有固定配色和排序位置', () => {
  assert.equal(shortCourse('习近平新时代中国特色社会主义思想概论'), '习概')
  assert.equal(shortCourse('毛概'), '毛概')
  assert.equal(shortCourse('python'), 'Python')
  assert.equal(courseTone('数学分析三'), courseTone('数学分析Ⅲ'))
  const tone = courseTone('某门新课')
  assert.ok(tone >= 0 && tone < TONE_COUNT)
  assert.equal(courseTone('某门新课'), tone)
  assert.ok(courseRank('常微分方程') < courseRank('某门新课'))
})

test('作业行显示截止提醒、提交平台与完成状态，内容全部转义', () => {
  const item = hw('<x>', '2026-10-07', { title: '<img src=x onerror=alert(1)>', submissionPlatform: 'chaoxing' })
  const html = homeworkRow(item, { done: [] }, now)
  assert.ok(!html.includes('<img'))
  assert.match(html, /data-due="today"/)
  assert.match(html, /class="due-badge">今天</)
  assert.match(html, /学习通提交/)
  assert.match(html, /aria-pressed="false"/)
  assert.match(homeworkRow(item, { done: ['<x>'] }, now), /is-done[\s\S]*aria-pressed="true"/)
})

test('通知未读标记与详情信息', () => {
  const notice = { id: 'n', title: '考试安排', category: 'exam', description: '第一行\n第二行', targetClasses: ['class_2'], attachments: [], status: 'published', updatedAt: '2026-10-06T02:00:00Z' }
  assert.match(noticeRow(notice, { read: [] }, now), /is-unread/)
  assert.doesNotMatch(noticeRow(notice, { read: ['n'] }, now), /is-unread/)
  const detail = detailView(notice, 'notices', {}, now)
  assert.match(detail, /考试通知/)
  assert.match(detail, /2班/)
  assert.match(detail, /10月6日/)
})

test('详情只为站内文件提供下载，危险链接不渲染', () => {
  const item = { id: 'm', title: '资料', subject: '数学分析三', category: 'review', targetClasses: ['all'], status: 'published', attachments: [{ name: 'a.pdf', url: 'files/a.pdf', size: 10 }, { name: 'b.docx', url: 'https://example.com/b.docx' }, { name: 'c.pdf', url: 'javascript:alert(1)' }] }
  const html = detailView(item, 'materials', {}, now)
  assert.equal((html.match(/download=/g) || []).length, 1)
  assert.ok(!html.includes('javascript:'))
  assert.match(html, /target="_blank" rel="noopener noreferrer"/)
})

test('作业详情包含平台提交入口与可切换的完成按钮', () => {
  const html = detailView(hw('h', '2026-10-08', { submissionPlatform: 'ketangpai' }), 'homeworks', { done: ['h'] }, now)
  assert.ok(html.includes(submissionLink('ketangpai', true)))
  assert.match(html, /data-action="toggle-done" data-id="h" aria-pressed="true"/)
  assert.match(html, /明天截止/)
})

test('导航徽标按班级统计待完成作业与未读通知', () => {
  const data = { homeworks: [hw('a', '2026-10-09'), hw('b', '2026-10-09', { targetClasses: ['class_2'] }), hw('c', '2026-10-01')], notices: [{ id: 'n', title: 'n', category: 'course', targetClasses: ['all'], attachments: [], status: 'published' }], materials: [] }
  assert.deepEqual(navCounts(data, { classId: 'class_1', done: [], read: [] }, now), { homeworks: 1, notices: 1 })
  assert.deepEqual(navCounts(data, { classId: 'all', done: ['a'], read: ['n'] }, now), { homeworks: 1, notices: 0 })
})

test('页面摘要说明最近的截止时间，模板不输出内联样式（CSP 会拦截）', () => {
  const data = { homeworks: [hw('a', '2026-10-08'), hw('b', '2026-10-20')], notices: [], materials: [] }
  assert.match(studentView(data, baseState, 'homeworks', now), /还有 <strong>2<\/strong> 项待完成，最近一项<em data-due="tomorrow">明天<\/em>截止/)
  assert.match(studentView(data, { ...baseState, done: ['a', 'b'] }, 'homeworks', now), /作业都已完成或截止/)
  for (const kind of ['homeworks', 'notices', 'materials']) assert.doesNotMatch(studentView(data, baseState, kind, now), /\sstyle=/)
  assert.doesNotMatch(icon('check'), /style=/)
  assert.equal(icon('not-an-icon'), '')
})
