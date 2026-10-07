import test from 'node:test'
import assert from 'node:assert/strict'
import * as courses from '../courses.js'
import { visibleItems, validateContent } from '../domain.js'
const material = { id: 'm', title: '期中复习', subject: '数学分析三', category: 'review', status: 'published', targetClasses: ['all'], attachments: [{ name: '第十五章.pdf', url: 'files/ch15.pdf', size: 1234 }] }
const data = { schemaVersion: 1, homeworks: [], notices: [], materials: [material, { ...material, id: 'p', subject: '概率论与数理统计' }] }
test('本学期固定十一门课程，无内容也保留入口；别名统一', () => {
  assert.equal(courses.CURRENT_COURSES.length, 11)
  assert.equal(courses.normalizeCourse('数学分析III'), '数学分析三')
  assert.equal(courses.normalizeCourse('习概'), '习近平新时代中国特色社会主义思想概论')
})
test('资料课程和用途组合筛选，附件名也能搜索', () => {
  assert.deepEqual(visibleItems(data, 'materials', { subject: '数学分析三', filter: 'review', query: '第十五章' }).map(i => i.id), ['m'])
  assert.equal(visibleItems(data, 'materials', { subject: '数学分析三', filter: 'paper' }).length, 0)
})
test('无课程的旧内容兼容，非法课程类型和附件大小拒绝', () => {
  assert.equal(validateContent(data), data)
  assert.throws(() => validateContent({ ...data, materials: [{ ...material, subject: {} }] }), /课程/)
  assert.throws(() => validateContent({ ...data, materials: [{ ...material, attachments: [{ name: 'bad', url: 'files/x.pdf', size: -1 }] }] }), /附件/)
})
test('资料默认优先显示本学期课程，课程别名能作为搜索词', () => {
  const content = { ...data, materials: [{ ...material, id:'old', subject:'常微分方程' }, { ...material, id:'now', subject:'数学分析三' }] }
  assert.equal(visibleItems(content,'materials')[0].id,'now')
  assert.deepEqual(visibleItems(content,'materials',{query:'数分3'}).map(i=>i.id),['now'])
})
