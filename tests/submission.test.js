import test from 'node:test'
import assert from 'node:assert/strict'
import * as domain from '../domain.js'
import * as view from '../student-view.js'

const homework = { id: 'submit-test', title: '测试作业', subject: '数学分析三', deadline: '2999-01-01', targetClasses: ['all'], attachments: [], status: 'published' }
const content = item => ({ schemaVersion: 1, homeworks: [item], notices: [], materials: [] })

test('旧作业及无需在线提交作业兼容，只接受固定平台标识', () => {
  assert.equal(domain.validateContent(content(homework)).homeworks.length, 1)
  for (const submissionPlatform of ['none', 'chaoxing', 'ketangpai', 'notebook']) assert.doesNotThrow(() => domain.validateContent(content({ ...homework, submissionPlatform })))
  for (const submissionPlatform of ['javascript:alert(1)', 'https://example.com', 'constructor', {}, null]) assert.throws(() => domain.validateContent(content({ ...homework, submissionPlatform })), /提交平台/)
})
test('提交按钮指向固定 HTTPS 网站，旧作业不生成错误跳转', () => {
  assert.equal(typeof view.submissionLink, 'function')
  assert.equal(view.submissionLink(), '')
  assert.equal(view.submissionLink('none'), '')
  assert.equal(view.submissionLink('constructor'), '')
  assert.match(view.submissionLink('chaoxing'), /href="https:\/\/i\.chaoxing\.com\/"/)
  assert.match(view.submissionLink('ketangpai'), /href="https:\/\/www\.ketangpai\.com\/"/)
  assert.match(view.submissionLink('chaoxing'), /前往提交/)
  assert.match(view.submissionLink('chaoxing'), /noopener noreferrer/)
})
test('发布和编辑只选择平台，已有选择回显，无逐条链接输入', () => {
  assert.equal(typeof view.submissionSelect, 'function')
  assert.match(view.submissionSelect('ketangpai'), /value="ketangpai" selected/)
  assert.match(view.submissionSelect(), /value="none" selected/)
  assert.match(view.submissionSelect(), /学习通/)
  assert.match(view.submissionSelect(), /课堂派/)
  assert.match(view.submissionSelect(), /作业本（线下提交）/)
  assert.doesNotMatch(view.submissionSelect(), /type="url"/)
})
test('作业本明确提示线下提交，不生成跳转或自动完成', () => {
  assert.match(view.submissionLink('notebook'), /作业本.*线下提交/)
  assert.doesNotMatch(view.submissionLink('notebook'), /href=|<button|data-done/)
})
