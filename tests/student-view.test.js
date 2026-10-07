import test from 'node:test'
import assert from 'node:assert/strict'
import { studentView, materialCard } from '../student-view.js'
const record={id:'m',title:'<资料>',subject:'数学分析三',category:'review',status:'published',targetClasses:['all'],attachments:[{name:'test.pdf',url:'files/test.pdf',size:1048576}]}
const state={classId:'all',query:'',filter:'all',subject:'all',sort:'deadline-asc',format:'all',limit:24}
test('资料分批展示而不丢失总数，空课程保留清楚的空状态',()=>{
  const data={materials:Array.from({length:30},(_,i)=>({...record,id:'m'+i})),homeworks:[],notices:[]}
  const html=studentView(data,state,'materials')
  assert.equal((html.match(/class="row file-row"/g)||[]).length,24)
  assert.ok(html.includes('还有 6 条'))
  assert.ok(html.includes('大学语文'))
  const empty=studentView(data,{...state,subject:'大学语文'},'materials')
  assert.ok(empty.includes('大学语文还没有资料'))
  assert.match(empty,/data-action="subject" data-value="all"/)
  const noMatch=studentView(data,{...state,query:'不存在的关键词'},'materials')
  assert.ok(noMatch.includes('没有找到匹配的内容'))
  assert.match(noMatch,/data-action="reset"/)
})
test('资料标题转义，大小、所属课程与版本数量可见',()=>{
  const html=materialCard(record)
  assert.ok(html.includes('&lt;资料&gt;'))
  assert.ok(html.includes('1.0 MB'))
  assert.ok(html.includes('数学分析三'))
  assert.ok(materialCard({...record,attachments:[...record.attachments,{name:'test.docx',url:'files/test.docx',size:1}]}).includes('2 个版本'))
})
