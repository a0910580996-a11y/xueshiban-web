import test from 'node:test'
import assert from 'node:assert/strict'
import { CATEGORIES, visibleItems, deadlineState, safeUrl, escapeHtml, validateContent } from '../domain.js'
import { createPublisher } from '../github.js'
import { convertExport } from '../scripts/import-cloud-export.js'

const homework = { id: 'hw', title: '数学分析练习', description: '第三章', subject: '数学分析III', deadline: '2999-01-01', targetClasses: ['class_1'], attachments: [], status: 'published' }
const data = { schemaVersion: 1, homeworks: [homework], notices: [], materials: [] }
test('班级用于筛选，隐藏草稿和撤回，完成与过期不计入待完成', () => {
  const content = structuredClone(data)
  content.homeworks.push({ ...homework, id: 'draft', status: 'draft' }, { ...homework, id: 'past', deadline: '2000-01-01' })
  assert.equal(visibleItems(content, 'homeworks', { classId: 'class_2' }).length, 0)
  assert.equal(visibleItems(content, 'homeworks', { classId: 'all' }).length, 2)
  assert.equal(visibleItems(content, 'homeworks', { filter: 'pending', done: ['hw'] }).length, 0)
  assert.equal(visibleItems(content, 'homeworks', { filter: 'done', done: ['hw'] }).length, 1)
  assert.equal(visibleItems(content, 'homeworks', { query: '第三章' }).length, 2)
})
test('截止日期按上海自然日计算，截止当天仍有效', () => {
  const now = new Date('2026-10-06T16:30:00Z')
  assert.deepEqual(deadlineState('2026-10-07', now), { days: 0, expired: false, label: '今天截止' })
  assert.equal(deadlineState('2026-10-06', now).expired, true)
  assert.equal(deadlineState('', now).days, null)
})
test('作业课程筛选可与截止日期正序、倒序及课程排序组合', () => {
  const content = { ...data, homeworks: [
    { ...homework, id: 'late', deadline: '2999-03-01' },
    { ...homework, id: 'early', deadline: '2999-01-01' },
    { ...homework, id: 'other', subject: '概率论', deadline: '2999-02-01' }
  ] }
  assert.deepEqual(visibleItems(content, 'homeworks').map(i => i.id), ['early', 'other', 'late'])
  assert.deepEqual(visibleItems(content, 'homeworks', { sort: 'deadline-desc' }).map(i => i.id), ['late', 'other', 'early'])
  assert.deepEqual(visibleItems(content, 'homeworks', { subject: '数学分析III', sort: 'deadline-desc' }).map(i => i.id), ['late', 'early'])
  assert.equal(visibleItems(content, 'homeworks', { sort: 'subject' })[0].subject, '概率论')
  assert.deepEqual(Object.keys(CATEGORIES.notices), ['course', 'exam'])
})
test('阻止脚本链接、目录穿越、HTML 注入', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,test', '//evil.test', 'files/../secret', 'files/a\\b', 'https://user:password@test.com']) assert.equal(safeUrl(url), '')
  assert.equal(safeUrl('files/a.pdf'), 'files/a.pdf')
  assert.equal(safeUrl('https://example.com/a.pdf'), 'https://example.com/a.pdf')
  assert.equal(escapeHtml('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;')
})
test('内容文件必须有合法班级、唯一标识和安全附件', () => {
  assert.equal(validateContent(data), data)
  assert.throws(() => validateContent({ ...data, homeworks: [homework, homework] }), /重复/)
  assert.throws(() => validateContent({ ...data, homeworks: [{ ...homework, targetClasses: ['invalid'] }] }), /班级/)
  assert.throws(() => validateContent({ ...data, homeworks: [{ ...homework, attachments: [{ name: 'a', url: 'javascript:x' }] }] }), /附件/)
})
test('旧云数据只迁移业务字段，未转换的云附件阻止发布', () => {
  const input = { homeworks: [{ ...homework, _id: 'old', createdBy: { password: 'test-private' }, token: 'test-private', attachments: [{ fileID: 'cloud://old/a', name: 'a.pdf' }] }], notices: [], materials: [] }
  assert.throws(() => convertExport(input), /尚未迁移/)
  const output = convertExport(input, { 'cloud://old/a': 'files/a.pdf' })
  assert.equal(output.homeworks[0].id, 'homeworks-old')
  assert.equal(output.homeworks[0].attachments[0].url, 'files/a.pdf')
  assert.equal(JSON.stringify(output).includes('test-private'), false)
})
test('发布正文和附件使用同一 commit 且不强制覆盖并发更新', async () => {
  const calls = []
  const publisher = createPublisher('test-only-token', async (url, options) => {
    const body = options.body ? JSON.parse(options.body) : null
    calls.push({ url, options, body })
    const result = url.endsWith('/git/blobs') ? { sha: 'blob' } : url.endsWith('/git/trees') ? { sha: 'tree' } : url.endsWith('/git/commits') ? { sha: 'commit' } : { object: { sha: 'commit' } }
    return { ok: true, json: async () => result }
  })
  await publisher.publish(data, { head: 'old', tree: 'old-tree' }, [{ path: 'files/a.pdf', base64: 'YQ==' }])
  assert.equal(calls[1].body.tree.length, 2)
  assert.equal(calls[1].body.base_tree, 'old-tree')
  assert.deepEqual(calls[2].body.parents, ['old'])
  assert.equal(calls[3].body.force, false)
  const conflicting = createPublisher('test-only-token', async () => ({ ok: false, status: 422 }))
  await assert.rejects(() => conflicting.publish(data, { head: 'old', tree: 'old-tree' }), /其他管理员更新/)
})
