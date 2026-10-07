import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { validateContent } from '../domain.js'
test('真实资料每个附件存在、大小一致，公开清单不携带私有盘点字段',async()=>{
  const text=await readFile(new URL('../content.json',import.meta.url),'utf8')
  const data=validateContent(JSON.parse(text))
  assert.equal(/localPath|sourcePaths|Python作业|\.work|ADMIN_BOOTSTRAP_SECRET/.test(text),false)
  const displayNames=data.materials.flatMap(i=>[i.title,i.subject,...i.attachments.map(a=>a.name)]).join(' ')
  assert.equal(/(?<!\d)\d{9}(?!\d)/.test(displayNames),false)
  const urls=new Set()
  for(const item of data.materials) for(const file of item.attachments){
    const path=new URL('../'+file.url,import.meta.url)
    assert.equal((await stat(path)).size,file.size)
    assert.equal(urls.has(file.url),false)
    urls.add(file.url)
    const binary=await readFile(path)
    assert.ok(file.name.endsWith('.pdf') ? binary.subarray(0,5).toString()==='%PDF-' : binary.subarray(0,2).toString()==='PK')
  }
})
