import { CLASSES, CATEGORIES, escapeHtml as e, safeUrl, deadlineState, validateContent } from './domain.js?v=20261007-5'
import { createPublisher } from './github.js?v=20261007-4'
import { studentView, materialCard, submissionLink, submissionSelect } from './student-view.js?v=20261007-5'
import { courseOptions, normalizeCourse, formatSize } from './courses.js?v=20261007-4'
import { REPOSITORY } from './config.js'

const app = document.querySelector('#app')
const dialog = document.querySelector('#detail')
const kinds = { homeworks: '作业', notices: '通知', materials: '资料' }
const storage = {
  read(key, fallback) { try { return JSON.parse(localStorage.getItem('xueshiban:' + key)) ?? fallback } catch { return fallback } },
  write(key, value) { try { localStorage.setItem('xueshiban:' + key, JSON.stringify(value)); return true } catch { toast('浏览器未允许保存，本次操作在关闭页面后可能丢失。'); return false } }
}
const state = { data: null, classId: storage.read('class', 'all'), done: storage.read('done', []), read: storage.read('read', []), filter: 'all', subject: 'all', sort: 'deadline-asc', format: 'all', limit: 24, coursesOpen: false, query: '', error: '', publisher: null, snapshot: null, busy: false }
if (!CLASSES.some(([id]) => id === state.classId)) state.classId = 'all'
if (!Array.isArray(state.done)) state.done = []
if (!Array.isArray(state.read)) state.read = []
let toastTimer
function toast(message) {
  const el = document.querySelector('#toast')
  el.textContent = message; el.hidden = false
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true }, 6000)
}
function route() { return location.hash.slice(1).split('/')[0] || 'homeworks' }
function classPicker() { return `<select class="class-select" id="class-picker" aria-label="筛选班级">${CLASSES.map(([id, label]) => `<option value="${id}" ${state.classId === id ? 'selected' : ''}>${label === '全体' ? '全部班级' : label}</option>`).join('')}</select>` }
function render() {
  const kind = route()
  document.body.dataset.section = kinds[kind] ? kind : 'homeworks'
  document.body.dataset.searching = Boolean(state.query)
  document.querySelectorAll('nav a').forEach(a => { const active = a.hash === '#' + kind; a.classList.toggle('active', active); if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current') })
  app.setAttribute('aria-busy', 'false')
  if (kind === 'admin') return renderAdmin()
  if (!kinds[kind]) { location.hash = '#homeworks'; return }
  if (state.error) { app.innerHTML = `<div class="empty"><strong>暂时没能打开内容</strong><p>${e(state.error)}</p><button class="primary" id="retry">重新加载</button></div>`; document.querySelector('#retry').onclick = load; return }
  if (!state.data) return
  app.innerHTML = studentView(state.data, state, kind, card, classPicker)
  document.querySelector('#class-picker').onchange = event => { state.classId = event.target.value; state.limit = 24; storage.write('class', state.classId); render() }
  const change = (selector, field) => { const element = document.querySelector(selector); if (element) element.onchange = event => { state[field] = event.target.value; state.limit = 24; render() } }
  change('#subject-filter', 'subject'); change('#sort-order', 'sort'); change('#format-filter', 'format')
  const reset = () => { state.subject = 'all'; state.filter = 'all'; state.query = ''; state.format = 'all'; state.limit = 24; state.classId = 'all'; storage.write('class', 'all'); render() }
  document.querySelector('#reset-filters').onclick = reset
  const emptyReset = document.querySelector('#empty-reset'); if (emptyReset) emptyReset.onclick = reset
  const more = document.querySelector('#load-more'); if (more) more.onclick = () => { state.limit += 24; render() }
  const browse = document.querySelector('#toggle-courses'); if (browse) browse.onclick = () => { state.coursesOpen = !state.coursesOpen; render() }
  document.querySelectorAll('[data-course]').forEach(b => { b.onclick = () => { state.subject = b.dataset.course; state.filter = 'all'; state.query = ''; state.format = 'all'; state.limit = 24; render(); document.querySelector('.control-panel').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }) } })
  document.querySelectorAll('[data-filter]').forEach(b => { b.onclick = () => { state.filter = b.dataset.filter; state.limit = 24; render() } })
  document.querySelector('#search').oninput = event => {
    const pos = event.target.selectionStart; state.query = event.target.value; state.limit = 24; render()
    const input = document.querySelector('#search'); input.focus(); if (input.type !== 'search') input.setSelectionRange(pos, pos)
  }
  document.querySelectorAll('[data-open]').forEach(b => { b.onclick = () => openDetail(b.dataset.open, kind) })
  document.querySelectorAll('[data-done]').forEach(b => { b.onclick = () => toggleDone(b.dataset.done) })
  const detailId = location.hash.slice(1).split('/')[1]
  if (detailId && !dialog.open) openDetail(decodeURIComponent(detailId), kind, false)
}
function card(item, kind) {
  if (kind === 'materials') return materialCard(item)
  const deadline = deadlineState(item.deadline)
  const completed = state.done.includes(item.id)
  const meta = kind === 'homeworks' ? normalizeCourse(item.subject) : CATEGORIES[kind][item.category]
  return `<article class="entry ${kind === 'homeworks' && completed ? 'done' : ''}"><button class="entry-body" data-open="${e(item.id)}"><div class="entry-meta"><span class="category">${e(meta)}</span><span>${e(kind === 'homeworks' ? item.deadline : (item.updatedAt || '').slice(0, 10))}</span></div><h2>${e(item.title)}</h2><p>${e(item.description || item.content || '打开查看详细内容')}</p></button><div class="entry-foot"><span class="${kind === 'homeworks' && deadline.days !== null && deadline.days >= 0 && deadline.days <= 1 ? 'urgent' : ''}">${kind === 'homeworks' ? e(deadline.label) : kind === 'notices' ? (state.read.includes(item.id) ? '已读' : '未读') : `附件 ${item.attachments.length} 个`}</span>${kind === 'homeworks' ? `<div class="entry-actions">${submissionLink(item.submissionPlatform)}<button data-done="${e(item.id)}" aria-pressed="${completed}">${completed ? '✓ 已完成' : '标记完成'}</button></div>` : `<button data-open="${e(item.id)}">查看${kinds[kind]} →</button>`}</div></article>`
}
function toggleDone(id) {
  state.done = state.done.includes(id) ? state.done.filter(v => v !== id) : [...state.done, id]
  storage.write('done', state.done); render()
}
function openDetail(id, kind, updateHash = true) {
  const item = state.data[kind]?.find(i => i.id === id && i.status === 'published')
  if (!item) { toast('该内容不存在或已撤回。'); return }
  if (kind === 'notices' && !state.read.includes(id)) { state.read.push(id); storage.write('read', state.read) }
  const files = item.attachments.map(a => { const url = safeUrl(a.url); if (!url) return ''; return `<div class="attachment"><a class="file" href="${e(url)}" target="_blank" rel="noopener noreferrer">${e(a.name)} ↗<small>${e(formatSize(a.size))} · ${/\.pdf$/i.test(a.name) ? '浏览器查看' : '打开或下载'}</small></a>${url.startsWith('files/') ? `<a class="download-link" href="${e(url)}" download="${e(a.name)}">下载文件 ↓</a>` : ''}</div>${/\.(png|jpe?g|webp)$/i.test(a.name) ? `<img class="detail-image" src="${e(url)}" alt="${e(a.name)}" loading="lazy">` : ''}` }).join('')
  document.querySelector('#detail-content').innerHTML = `<p class="inline-meta">${e(kind === 'homeworks' ? `${item.subject} · ${item.deadline} 截止` : CATEGORIES[kind][item.category])} · ${e(item.targetClasses.map(c => CLASSES.find(([id]) => id === c)?.[1]).join('、'))}</p><h2>${e(item.title)}</h2><div class="content">${e(item.description || item.content || '')}</div><div class="files">${files}</div><div class="form-actions">${kind === 'homeworks' ? `${submissionLink(item.submissionPlatform, true)}<button class="secondary" id="detail-done">${state.done.includes(id) ? '取消完成标记' : '标记完成'}</button>` : ''}<button class="secondary" id="share">复制分享链接</button></div>`
  document.querySelector('#share').onclick = async () => { try { await navigator.clipboard.writeText(new URL(`#${kind}/${encodeURIComponent(id)}`, location.href).href); toast('分享链接已复制。') } catch { toast('请从浏览器地址栏复制当前链接。') } }
  const done = document.querySelector('#detail-done'); if (done) done.onclick = () => { toggleDone(id); done.textContent = state.done.includes(id) ? '取消完成标记' : '标记完成' }
  if (updateHash) history.replaceState(null, '', '#' + kind + '/' + encodeURIComponent(id))
  if (!dialog.open) dialog.showModal()
}
document.querySelector('.dialog-close').onclick = () => dialog.close()
dialog.addEventListener('close', () => { history.replaceState(null, '', '#' + route()); render() })
dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close() } })

function renderAdmin() {
  if (!state.publisher) {
    app.innerHTML = `<section class="hero"><div><h1>管理员后台</h1><p>发布作业、通知和学习资料。</p></div></section><form id="login" class="form-panel"><p class="notice-info">使用拥有此仓库写入权限的 GitHub 账号授权。授权仅在本次页面会话中使用，刷新或退出后清除。</p><p class="hint">仓库：${e(REPOSITORY.owner + '/' + REPOSITORY.name)}。在 GitHub 创建仅限此仓库、Contents 读写权限的 Fine-grained token，然后粘贴到下方。请勿使用账号密码。</p><a class="file" href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer">前往 GitHub 创建仓库授权 ↗</a><label for="token">仓库授权</label><input id="token" name="token" type="password" autocomplete="off" required><div class="form-actions"><button class="primary" ${state.busy ? 'disabled' : ''}>${state.busy ? '正在连接…' : '连接发布后台'}</button></div><p class="hint">同学无需登录。仓库中的内容和附件公开可读，请勿上传学生个人信息或私密材料。</p></form>`
    document.querySelector('#login').onsubmit = async event => {
      event.preventDefault(); if (state.busy) return
      const token = new FormData(event.target).get('token').trim()
      document.querySelector('#token').value = ''; state.busy = true
      const publisher = createPublisher(token); renderAdmin()
      try { const snapshot = await publisher.load(); state.publisher = publisher; state.snapshot = snapshot; state.data = snapshot.data; state.busy = false; renderAdmin() } catch (error) { state.busy = false; toast(error.message); renderAdmin() }
    }
    return
  }
  app.innerHTML = `<section class="hero"><div><h1>内容管理</h1><p>保存草稿、发布内容，或撤回已发布内容。</p></div><button class="secondary" id="logout">退出授权</button></section><div class="admin-toolbar">${Object.entries(kinds).map(([kind, label]) => `<button class="secondary" data-create="${kind}">＋ 发布${label}</button>`).join('')}<button class="secondary" id="refresh-admin">刷新内容</button><button class="secondary" id="export">备份内容</button></div><p class="notice-info">提交后需等待网站部署。草稿和附件也存储在公开仓库，请勿保存私密内容。撤回只隐藏网站列表，历史版本和旧附件链接仍保留。</p><div id="editor"></div><section class="form-panel">${Object.entries(kinds).map(([kind, label]) => `<h2>${label}</h2>${state.data[kind].map(item => `<div class="manage-row"><span>${e(item.title)}<br><small class="inline-meta">${item.status === 'published' ? '已发布' : item.status === 'draft' ? '草稿' : '已撤回'}</small></span><button data-edit="${e(item.id)}" data-kind="${kind}">编辑</button>${item.status === 'published' ? `<button data-withdraw="${e(item.id)}" data-kind="${kind}">撤回</button>` : ''}</div>`).join('') || '<p class="hint">暂无内容</p>'}`).join('')}</section>`
  document.querySelector('#logout').onclick = () => { state.publisher = null; state.snapshot = null; renderAdmin(); load() }
  document.querySelector('#refresh-admin').onclick = async () => { try { const snapshot = await state.publisher.load(); state.snapshot = snapshot; state.data = snapshot.data; renderAdmin(); toast('已加载最新仓库内容。') } catch (error) { toast(error.message) } }
  document.querySelector('#export').onclick = () => { const url = URL.createObjectURL(new Blob([JSON.stringify(state.data, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = '学事板内容备份.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000) }
  document.querySelectorAll('[data-create]').forEach(b => { b.onclick = () => editor(b.dataset.create) })
  document.querySelectorAll('[data-edit]').forEach(b => { b.onclick = () => editor(b.dataset.kind, state.data[b.dataset.kind].find(i => i.id === b.dataset.edit)) })
  document.querySelectorAll('[data-withdraw]').forEach(b => { b.onclick = async () => { if (!confirm('确认撤回这条内容？同学将无法在网站中查看，历史版本仍保留。')) return; const data = structuredClone(state.data); data[b.dataset.kind].find(i => i.id === b.dataset.withdraw).status = 'withdrawn'; await commit(data, [], b) } })
}
function editor(kind, item = {}) {
  const section = document.querySelector('#editor')
  section.innerHTML = `<form class="form-panel" id="publish-form"><h2>${item.id ? '编辑' : '发布'}${kinds[kind]}</h2><label for="title">标题 *</label><input id="title" name="title" required maxlength="120" value="${e(item.title || '')}">${kind === 'homeworks' ? `<label for="subject">课程 *</label><input id="subject" name="subject" required maxlength="100" value="${e(item.subject || '')}"><label for="deadline">截止日期 *</label><input id="deadline" type="date" name="deadline" required value="${e(item.deadline || '')}">` : `<label for="category">分类 *</label><select id="category" name="category">${Object.entries(CATEGORIES[kind]).map(([id, label]) => `<option value="${id}" ${item.category === id ? 'selected' : ''}>${label}</option>`).join('')}</select>`}<label>班级范围 *</label><div class="class-checks">${CLASSES.map(([id, label]) => `<label><input type="checkbox" name="classes" value="${id}" ${(item.targetClasses || ['all']).includes(id) ? 'checked' : ''}>${label}</label>`).join('')}</div><label for="description">${kind === 'notices' ? '通知正文' : '说明'}</label><textarea id="description" name="description" maxlength="20000">${e(item.description || item.content || '')}</textarea><label for="attachments">附件（最多 3 个，每个不超过 20 MB）</label><input id="attachments" type="file" multiple accept=".pdf,.doc,.docx,.ppt,.pptx,.md,.png,.jpg,.jpeg,.webp"><p class="hint">已有附件：${e((item.attachments || []).map(a => a.name).join('、') || '无')}。选择新附件会替换本条内容的附件。</p><p class="hint">附件会公开，请确认有权分享。PDF 可由浏览器打开，Word / PPT 可下载到对应应用查看。</p><label><input type="checkbox" id="reviewed" ${item.status === 'published' ? 'checked' : ''}> 我已检查正文及附件，确认可以公开分享</label><div class="form-actions"><button class="secondary" type="submit" name="action" value="draft">保存草稿</button><button class="primary" type="submit" name="action" value="published">提交发布</button><button class="secondary" type="button" id="cancel-edit">取消</button></div></form>`
  if (kind === 'materials') {
    document.querySelector('label[for="category"]').insertAdjacentHTML('beforebegin', `<label for="subject">所属课程</label><select id="subject" name="subject"><option value="">未分类课程</option>${courseOptions([item]).map(subject => `<option value="${e(subject)}" ${normalizeCourse(item.subject) === subject ? 'selected' : ''}>${e(subject)}</option>`).join('')}</select>`)
  } else if (kind === 'homeworks') {
    document.querySelector('#deadline').insertAdjacentHTML('afterend', submissionSelect(item.submissionPlatform))
    document.querySelector('#subject').setAttribute('list', 'course-options')
    document.querySelector('#subject').insertAdjacentHTML('afterend', `<datalist id="course-options">${courseOptions([item]).map(subject => `<option value="${e(subject)}"></option>`).join('')}</datalist>`)
  }
  section.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
  document.querySelector('#cancel-edit').onclick = () => { section.innerHTML = '' }
  document.querySelector('#publish-form').onsubmit = async event => {
    event.preventDefault(); if (state.busy) return
    const form = event.target, values = new FormData(form), status = event.submitter?.value || 'draft'
    if (status === 'published' && !document.querySelector('#reviewed').checked) { toast('请先检查内容并确认可以公开分享。'); return }
    const selected = values.getAll('classes'); if (!selected.length) { toast('请至少选择一个班级。'); return }
    const attachments = Array.from(document.querySelector('#attachments').files)
    if (attachments.length > 3 || attachments.some(f => f.size > 20 * 1024 * 1024 || !/\.(pdf|docx?|pptx?|md|png|jpe?g|webp)$/i.test(f.name))) { toast('附件格式或大小不符合要求。'); return }
    const record = { ...item, id: item.id || crypto.randomUUID(), title: values.get('title').trim(), description: values.get('description').trim(), targetClasses: selected.includes('all') ? ['all'] : selected, status, updatedAt: new Date().toISOString(), attachments: item.attachments || [] }
    if (kind === 'homeworks') { record.subject = normalizeCourse(values.get('subject')); record.deadline = values.get('deadline'); record.submissionPlatform = values.get('submissionPlatform') } else { record.category = values.get('category'); if (kind === 'materials') record.subject = values.get('subject') }
    try {
      // Read each upload only into memory; never persist credentials or private drafts in storage.
      const uploads = []
      if (attachments.length) {
        record.attachments = []
        for (const file of attachments) {
          const path = `files/${crypto.randomUUID()}.${file.name.split('.').pop().toLowerCase()}`
          const base64 = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = () => reject(new Error('附件读取失败，请重新选择。')); reader.readAsDataURL(file) })
          uploads.push({ path, base64 }); record.attachments.push({ name: file.name, url: path, size: file.size })
        }
      }
      const data = structuredClone(state.data), idx = data[kind].findIndex(i => i.id === record.id)
      if (idx >= 0) data[kind][idx] = record; else data[kind].push(record)
      await commit(data, uploads, event.submitter)
    } catch (error) { toast(error.message) }
  }
}
async function commit(data, files, button) {
  if (state.busy) return
  state.busy = true; if (button) button.disabled = true
  try {
    data.updatedAt = new Date().toISOString()
    const snapshot = await state.publisher.publish(data, state.snapshot, files)
    state.snapshot = snapshot; state.data = data; renderAdmin(); toast('已提交到 GitHub。网站部署完成后，同学刷新即可看到更新。')
  } catch (error) { toast(error.message) } finally { state.busy = false; if (button) button.disabled = false }
}
async function load() {
  try {
    const response = await fetch('./content.json', { cache: 'no-store' })
    if (!response.ok) throw new Error('内容暂时无法加载，请稍后重试。')
    state.data = validateContent(await response.json()); state.error = ''
  } catch (error) { state.error = error.message }
  render()
}
addEventListener('keydown', event => {
  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k' || event.altKey || event.isComposing || dialog.open || route() === 'admin') return
  event.preventDefault()
  document.querySelector('#search')?.focus()
})
addEventListener('hashchange', () => { if (dialog.open) dialog.close(); state.filter = 'all'; state.subject = 'all'; state.query = ''; state.format = 'all'; state.limit = 24; render() })
load()
