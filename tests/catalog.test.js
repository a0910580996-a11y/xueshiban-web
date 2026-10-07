import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCatalog } from '../scripts/build-catalog.js'
test('只有复核通过文件入库，规范课程别名，保留不同格式与版本', () => {
  const rows = [
    { decision:'approved',path:'大二/数分3/复习(1).pdf',sha256:'a',extension:'.pdf',bytes:100 },
    { decision:'approved',path:'大二/数分3/复习.docx',sha256:'b',extension:'.docx',bytes:200 },
    { decision:'hold',path:'大二/python/个人作业.docx',sha256:'c',extension:'.docx',bytes:300 }
  ]
  const result = buildCatalog(rows)
  assert.equal(result.length,1)
  assert.equal(result[0].subject,'数学分析三')
  assert.equal(result[0].attachments.length,2)
  assert.equal(result[0].category,'review')
  assert.equal(JSON.stringify(result).includes('个人作业'),false)
})
test('超过三个同名版本拆分组，不丢弃附件、不误判为空内容相同', () => {
  const rows = Array.from({length:4},(_,i)=>({decision:'approved',path:`大二/心理学/习题(${i}).pdf`,sha256:`x${i}`,extension:'.pdf',bytes:100}))
  const result = buildCatalog(rows)
  assert.deepEqual(result.map(i=>i.attachments.length),[3,1])
})
