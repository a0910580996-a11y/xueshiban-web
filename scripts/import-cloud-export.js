import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { validateContent, safeUrl } from '../domain.js'

export function convertExport(source, fileUrls = {}) {
  function date(value) {
    const raw = value && typeof value === 'object' ? value.$date : value
    return raw && !Number.isNaN(Date.parse(raw)) ? new Date(raw).toISOString() : null
  }
  function attachment(a) {
    const raw = typeof a === 'string' ? a : a.url || a.fileID || a.fileId
    const url = safeUrl(fileUrls[raw] || raw)
    if (!url) throw new Error('存在尚未迁移的云附件，请先下载文件并提供 fileUrls 映射。')
    return { name: typeof a === 'string' ? '图片' : a.name || a.fileName || '附件', url, ...(a.size ? { size: a.size } : {}) }
  }
  const output = { schemaVersion: 1, updatedAt: new Date().toISOString(), homeworks: [], notices: [], materials: [] }
  for (const kind of ['homeworks', 'notices', 'materials']) {
    if (!Array.isArray(source[kind])) throw new Error(`缺少 ${kind} 导出数组。`)
    output[kind] = source[kind].filter(i => !i.deletedAt && !i.isDeleted).map(item => {
      const attachments = [...(item.attachments || []), ...(item.images || [])].map(attachment)
      if (attachments.length > 3) throw new Error('旧内容的附件超过三个，需要人工整理后迁移。')
      const record = {
        id: `${kind}-${item._id || item.id}`,
        title: item.title,
        description: item.description || item.content || '',
        targetClasses: item.targetClasses || ['all'],
        attachments,
        status: kind === 'materials' ? (item.status === 'published' && item.securityStatus === 'passed' ? 'published' : item.status === 'withdrawn' ? 'withdrawn' : 'draft') : 'published',
        updatedAt: date(item.updatedAt || item.createdAt)
      }
      if (!item._id && !item.id) throw new Error('旧内容缺少记录标识，无法可靠迁移。')
      if (kind === 'homeworks') { record.subject = item.subject; record.deadline = typeof item.deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.deadline) ? item.deadline : date(item.deadline)?.slice(0, 10) }
      else record.category = item.category
      return record
    })
  }
  return validateContent(output)
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [input, mapping, output = '.work/migrated-content.json'] = process.argv.slice(2)
    if (!input) throw new Error('用法：node scripts/import-cloud-export.js 导出汇总.json 附件映射.json [输出路径]')
    const source = JSON.parse(await readFile(input, 'utf8'))
    const fileUrls = mapping ? JSON.parse(await readFile(mapping, 'utf8')) : {}
    const content = convertExport(source, fileUrls)
    await mkdir(dirname(resolve(output)), { recursive: true })
    await writeFile(output, JSON.stringify(content, null, 2) + '\n', { flag: 'wx' })
    console.log(`已生成待审查内容：作业 ${content.homeworks.length}，通知 ${content.notices.length}，资料 ${content.materials.length}。未更新线上网站。`)
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
