import { readFile, writeFile, stat } from 'node:fs/promises'
import { resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeCourse } from '../courses.js'
import { validateContent } from '../domain.js'

export function buildCatalog(rows) {
  const groups = new Map()
  for (const row of rows.filter(r => r.decision === 'approved')) {
    const subject = normalizeCourse(row.path.split('/')[1])
    const title = basename(row.path, row.extension).replace(/^(?:\d+[_.]\s*)+/, '').replace(/[（(]\d+[)）]/g, '').replace(/docx-?$/i,'').replace(/-(?:高等代数|教育学原理|毛概|数学建模|习概).+$/,'').trim()
    const key = subject + '\0' + title
    if (!groups.has(key)) groups.set(key, {subject,title,rows:[]})
    groups.get(key).rows.push(row)
  }
  const materials = []
  for (const {subject,title,rows:group} of groups.values()) {
    for (let start=0;start<group.length;start+=3) {
      const files = group.slice(start,start+3)
      const category = /复习|背诵|必背|大题|问答|简答|辨析|提纲|主观题/.test(title) ? 'review' : /试卷|期末|期中|考试|练习|习题|试题|题库|测试|选择题/.test(title) ? 'paper' : 'textbook'
      const year = title.match(/20\d{2}/)?.[0]
      materials.push({id:'material-'+files[0].sha256.slice(0,16),title:title+(group.length>3?` · 文件组 ${Math.floor(start/3)+1}`:''),subject,category,description:files.length>1?'同名资料的不同版本或格式，均保留供选择。':'历史学习资料，仅供参考，不代表本学期考试范围。',...(year?{year}:{}),targetClasses:['all'],status:'published',attachments:files.map(row=>({name:basename(row.path),url:`files/${row.sha256}${row.extension}`,size:row.bytes}))})
    }
  }
  return materials.sort((a,b)=>a.subject.localeCompare(b.subject,'zh-CN')||a.title.localeCompare(b.title,'zh-CN'))
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [auditPath, stagePath, output] = process.argv.slice(2)
  const rows=JSON.parse((await readFile(auditPath,'utf8')).replace(/^\uFEFF/,''))
  const materials=buildCatalog(rows)
  for (const item of materials) for (const file of item.attachments) file.size=(await stat(resolve(stagePath,file.url))).size
  const content=validateContent({schemaVersion:1,updatedAt:new Date().toISOString(),homeworks:[],notices:[],materials})
  await writeFile(output,JSON.stringify(content,null,2),{flag:'wx'})
  console.log(JSON.stringify({records:materials.length,files:materials.reduce((sum,m)=>sum+m.attachments.length,0),bytes:materials.reduce((sum,m)=>sum+m.attachments.reduce((n,a)=>n+a.size,0),0),courses:[...new Set(materials.map(m=>m.subject))]},null,2))
}
