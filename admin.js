import { CLASSES, CATEGORIES, escapeHtml as e, formatDate, shanghaiDate } from './domain.js?v=20261007-9'
import { vaultInfo, saveVault, unlockWithPassword, unlockRemembered, setRemember, forgetDevice, daysLeft, TOKEN_DAYS } from './vault.js?v=20261007-9'
import { createPublisher } from './github.js?v=20261007-9'
import { submissionSelect } from './student-view.js?v=20261007-9'
import { courseOptions, normalizeCourse } from './courses.js?v=20261007-9'
import { REPOSITORY } from './config.js?v=20261007-9'
import { icon } from './icons.js?v=20261007-9'

const KINDS = { homeworks: '作业', notices: '通知', materials: '资料' }
const STATUS = { published: '已发布', draft: '草稿', withdrawn: '已撤回' }
const session = { publisher: null, snapshot: null, token: '', busy: false, mode: '', autoTried: false, signedOut: false, notice: '' }
const motion = () => matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
const repo = `${REPOSITORY.owner}/${REPOSITORY.name}`
const onAdmin = () => location.hash.slice(1).split('/')[0] === 'admin'
const rerender = ctx => { if (onAdmin()) renderAdmin(ctx) }

const head = (kicker, title, summary) => `<section class="page-head page-head--plain"><div class="container page-head-inner"><p class="page-kicker">${icon('lock')}<span>${kicker}</span></p><h1 class="page-title">${title}</h1><p class="page-summary">${summary}</p></div></section>`
const formError = message => `<p class="form-error" role="alert"${message ? '' : ' hidden'}>${icon('alert')}<span>${e(message)}</span></p>`
const rememberBox = (checked = false) => `<label class="confirm"><input type="checkbox" name="remember"${checked ? ' checked' : ''}><span>在这台设备上保持登录<small>到期前进入后台不再需要密码。公共电脑或他人的手机请不要勾选。</small></span></label>`

export function tokenUrl(now = new Date()) {
  const params = { name: `学事板发布 ${shanghaiDate(now)}`, description: '学事板网站管理后台发布内容使用', target_name: REPOSITORY.owner, expires_in: String(TOKEN_DAYS), contents: 'write' }
  return `https://github.com/settings/personal-access-tokens/new?${Object.entries(params).map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&')}`
}

async function connect(ctx, token) {
  const publisher = createPublisher(token)
  const snapshot = await publisher.load()
  Object.assign(session, { publisher, snapshot, token, signedOut: false, notice: '' })
  ctx.state.data = snapshot.data
}

function busy(form, label) {
  const button = form.querySelector('[type="submit"]')
  button.dataset.label ??= button.textContent
  button.disabled = Boolean(label)
  button.textContent = label || button.dataset.label
  form.querySelectorAll('input').forEach(input => { input.readOnly = Boolean(label) })
}

function showError(form, message) {
  const box = form.querySelector('.form-error')
  box.querySelector('span').textContent = message
  box.hidden = !message
}

export function renderAdmin(ctx) {
  if (session.publisher) { dashboard(ctx); return }
  const info = vaultInfo()
  if (!info || session.mode === 'setup') { setupView(ctx, info); return }
  if (info.remembered && !session.autoTried && !session.signedOut) {
    session.autoTried = true
    ctx.root.innerHTML = `${head('管理入口', '发布后台', '正在进入后台…')}<div class="container admin"><div class="panel admin-loading">${icon('refresh')}<span>正在用这台设备保存的授权登录</span></div></div>`
    unlockRemembered().then(async token => { if (token) await connect(ctx, token) }).catch(error => { session.notice = error.message }).finally(() => rerender(ctx))
    return
  }
  unlockView(ctx, info)
}

function setupView(ctx, info) {
  const { root, toast } = ctx
  root.innerHTML = `${head('管理入口', info ? '更换授权' : '首次设置', '在这台设备上设置一次，以后输入管理密码即可进入后台。')}
<div class="container admin admin--narrow">
<form id="setup" class="panel" novalidate>
  <ol class="setup-steps">
    <li><h2>在 GitHub 生成授权</h2>
      <p>打开下面的链接，名称、一年有效期和“内容读写”权限已经填好。你只需要在 <b>Repository access</b> 中选择 <b>Only select repositories</b> → <code>${e(REPOSITORY.name)}</code>，再点页面底部的 <b>Generate token</b>，复制生成的授权。</p>
      <a class="button button--secondary" href="${e(tokenUrl())}" target="_blank" rel="noopener noreferrer">打开 GitHub 生成页面${icon('external')}</a>
    </li>
    <li><h2>粘贴授权</h2>
      <div class="field"><label for="token">GitHub 授权</label><input id="token" name="token" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_…" required></div>
    </li>
    <li><h2>设置管理密码</h2>
      <div class="field-row">
        <div class="field"><label for="password">管理密码</label><input id="password" name="password" type="password" autocomplete="new-password" minlength="8" required></div>
        <div class="field"><label for="confirm">再输入一次</label><input id="confirm" name="confirm" type="password" autocomplete="new-password" minlength="8" required></div>
      </div>
      <p class="field-hint">至少 8 位。密码只用来在这台设备上解锁授权，不会上传到任何地方；忘记密码时需要重新生成授权。</p>
      ${rememberBox()}
    </li>
  </ol>
  ${formError(session.notice)}
  <div class="form-actions"><button class="button button--primary" type="submit">验证并保存</button>${info ? '<button class="button button--ghost" type="button" id="cancel-setup">返回</button>' : ''}</div>
</form>
</div>`
  session.notice = ''
  const form = root.querySelector('#setup')
  root.querySelector('#cancel-setup')?.addEventListener('click', () => { session.mode = ''; rerender(ctx) })
  form.onsubmit = async event => {
    event.preventDefault()
    if (session.busy) return
    const values = new FormData(form)
    const token = String(values.get('token')).trim()
    const password = String(values.get('password'))
    if (!/^(github_pat_|ghp_)[A-Za-z0-9_]{20,}$/.test(token)) return showError(form, '这不像 GitHub 授权。请复制以 github_pat_ 开头的完整内容。')
    if (password.length < 8) return showError(form, '管理密码至少需要 8 位。')
    if (password !== values.get('confirm')) return showError(form, '两次输入的密码不一致。')
    showError(form, '')
    session.busy = true
    busy(form, '正在向 GitHub 验证…')
    try {
      await connect(ctx, token)
      busy(form, '正在加密保存…')
      const { remembered } = await saveVault(token, password, { remember: values.get('remember') === 'on' })
      session.mode = ''
      toast(values.get('remember') === 'on' && !remembered ? '授权已保存。此浏览器不支持保持登录，下次请输入密码。' : '授权已加密保存在这台设备上。')
      rerender(ctx)
    } catch (error) {
      Object.assign(session, { publisher: null, snapshot: null, token: '' })
      busy(form, '')
      showError(form, error.name === 'QuotaExceededError' || error.name === 'SecurityError' ? '浏览器不允许在本机保存数据，请关闭无痕模式后重试。' : error.message)
    } finally { session.busy = false }
  }
  form.querySelector('#token').focus({ preventScroll: true })
}

function unlockView(ctx, info) {
  const { root } = ctx
  const left = daysLeft(info)
  const expiry = left !== null && left <= 30 ? `<div class="callout callout--warn">${icon('clock')}<p>${left > 0 ? `授权约在 ${left} 天后到期。` : '授权可能已经到期。'}进入后台后可以在“本机授权”中更换。</p></div>` : ''
  root.innerHTML = `${head('管理入口', '发布后台', '输入管理密码进入后台。')}
<div class="container admin admin--narrow">
${expiry}
<form id="unlock" class="panel" novalidate>
  <div class="field"><label for="password">管理密码</label><input id="password" name="password" type="password" autocomplete="current-password" required></div>
  ${rememberBox(false)}
  ${formError(session.notice)}
  <div class="form-actions"><button class="button button--primary" type="submit">进入后台</button><button class="button button--ghost" type="button" id="reset-device">忘记密码或更换授权</button></div>
</form>
</div>`
  session.notice = ''
  const form = root.querySelector('#unlock')
  root.querySelector('#reset-device').onclick = () => { session.mode = 'setup'; rerender(ctx) }
  form.onsubmit = async event => {
    event.preventDefault()
    if (session.busy) return
    const values = new FormData(form)
    if (!values.get('password')) return showError(form, '请输入管理密码。')
    session.busy = true
    busy(form, '正在解锁…')
    try {
      const token = await unlockWithPassword(String(values.get('password')))
      busy(form, '正在连接 GitHub…')
      await connect(ctx, token)
      if (values.get('remember') === 'on') await setRemember(token, true, info.expiresAt)
      rerender(ctx)
    } catch (error) {
      busy(form, '')
      const expired = /授权无效/.test(error.message)
      showError(form, expired ? 'GitHub 授权已失效或被撤销。请点“忘记密码或更换授权”，重新生成一个授权。' : error.message)
      form.querySelector('#password').select()
    } finally { session.busy = false }
  }
  form.querySelector('#password').focus({ preventScroll: true })
}

function devicePanel(info) {
  const left = daysLeft(info)
  return `<section class="panel" id="device">
<h2 class="panel-title">本机授权</h2>
<p class="field-hint">授权已加密保存在这台设备上，设置于 ${e(formatDate(info?.createdAt))}，${left > 0 ? `约在 ${e(formatDate(info?.expiresAt))}（${left} 天后）到期` : '可能已经到期'}。GitHub 不允许网页读取准确的到期时间，这里按一年估算。</p>
<label class="confirm"><input type="checkbox" id="remember-toggle"${info?.remembered ? ' checked' : ''}><span>在这台设备上保持登录<small>开启后，到期前进入后台不再需要密码。</small></span></label>
<details class="disclosure"><summary>修改管理密码</summary>
<form id="change-password" novalidate>
<div class="field-row"><div class="field"><label for="new-password">新密码</label><input id="new-password" name="password" type="password" autocomplete="new-password" minlength="8"></div><div class="field"><label for="new-confirm">再输入一次</label><input id="new-confirm" name="confirm" type="password" autocomplete="new-password" minlength="8"></div></div>
${formError('')}
<div class="form-actions"><button class="button button--secondary button--small" type="submit">保存新密码</button></div>
</form></details>
<div class="form-actions"><button class="button button--secondary button--small" type="button" id="replace-token">更换授权</button><button class="button button--ghost button--small" type="button" id="forget-device">清除本机授权</button></div>
</section>`
}

function dashboard(ctx) {
  const { root, state, toast, reload } = ctx
  const info = vaultInfo()
  const left = daysLeft(info)
  root.innerHTML = `${head(`已连接 ${e(repo)}`, '内容管理', '保存草稿、发布内容，或撤回已发布内容。')}
<div class="container admin">
<div class="admin-toolbar">${Object.entries(KINDS).map(([kind, label]) => `<button class="button button--primary button--small" type="button" data-create="${kind}">${icon('plus')}发布${label}</button>`).join('')}<span class="spacer"></span><button class="button button--secondary button--small" type="button" id="refresh-admin">${icon('refresh')}刷新内容</button><button class="button button--secondary button--small" type="button" id="export">${icon('download')}备份内容</button><button class="button button--ghost button--small" type="button" id="logout">退出后台</button></div>
${left !== null && left <= 30 ? `<div class="callout callout--warn">${icon('clock')}<p>授权${left > 0 ? `约在 ${left} 天后到期` : '可能已经到期'}。请在下方“本机授权”中更换，以免影响发布。</p></div>` : ''}
<div class="callout">${icon('alert')}<p>提交后需等待网站部署。草稿和附件也存储在公开仓库，请勿保存私密内容。撤回只隐藏网站列表，历史版本和旧附件链接仍保留。</p></div>
<div id="editor"></div>
${Object.entries(KINDS).map(([kind, label]) => `<section class="panel"><h2 class="panel-title">${label}<span>${state.data[kind].length}</span></h2><div class="admin-list">${state.data[kind].map(item => `<div class="admin-row"><div class="admin-row-text"><span class="admin-row-title">${e(item.title)}</span><span class="status-pill" data-status="${e(item.status)}">${STATUS[item.status] || e(item.status)}</span></div><div class="admin-row-actions"><button class="button button--secondary button--small" type="button" data-edit="${e(item.id)}" data-kind="${kind}">编辑</button>${item.status === 'published' ? `<button class="button button--ghost button--small" type="button" data-withdraw="${e(item.id)}" data-kind="${kind}">撤回</button>` : ''}</div></div>`).join('') || '<p class="field-hint">暂无内容</p>'}</div></section>`).join('')}
${info ? devicePanel(info) : ''}
</div>`
  root.querySelector('#logout').onclick = () => {
    Object.assign(session, { publisher: null, snapshot: null, token: '', signedOut: true })
    rerender(ctx); reload()
    toast(vaultInfo()?.remembered ? '已退出。这台设备仍保持登录，下次进入后台会自动登录。' : '已退出后台。')
  }
  root.querySelector('#remember-toggle')?.addEventListener('change', async event => {
    const wanted = event.target.checked
    const remembered = await setRemember(session.token, wanted, info.expiresAt)
    event.target.checked = remembered
    toast(wanted ? (remembered ? '已开启保持登录。' : '此浏览器不支持保持登录。') : '已关闭保持登录，下次进入后台需要输入密码。')
  })
  root.querySelector('#change-password')?.addEventListener('submit', async event => {
    event.preventDefault()
    const form = event.target, values = new FormData(form), password = String(values.get('password'))
    if (password.length < 8) return showError(form, '管理密码至少需要 8 位。')
    if (password !== values.get('confirm')) return showError(form, '两次输入的密码不一致。')
    busy(form, '正在保存…')
    try { await saveVault(session.token, password, { remember: Boolean(vaultInfo()?.remembered), createdAt: info.createdAt, expiresAt: info.expiresAt }); form.reset(); showError(form, ''); toast('管理密码已更新。') } catch (error) { showError(form, error.message) } finally { busy(form, '') }
  })
  root.querySelector('#replace-token')?.addEventListener('click', () => { Object.assign(session, { publisher: null, snapshot: null, token: '', mode: 'setup' }); rerender(ctx) })
  root.querySelector('#forget-device')?.addEventListener('click', async () => {
    if (!confirm('清除后，这台设备需要重新生成 GitHub 授权并设置密码才能进入后台。继续？')) return
    await forgetDevice()
    Object.assign(session, { publisher: null, snapshot: null, token: '', mode: '' })
    rerender(ctx); reload()
    toast('已清除本机授权。')
  })
  root.querySelector('#refresh-admin').onclick = async () => { try { const snapshot = await session.publisher.load(); session.snapshot = snapshot; state.data = snapshot.data; renderAdmin(ctx); toast('已加载最新仓库内容。') } catch (error) { toast(error.message) } }
  root.querySelector('#export').onclick = () => { const url = URL.createObjectURL(new Blob([JSON.stringify(state.data, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = '学事板内容备份.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000) }
  root.querySelectorAll('[data-create]').forEach(b => { b.onclick = () => editor(ctx, b.dataset.create) })
  root.querySelectorAll('[data-edit]').forEach(b => { b.onclick = () => editor(ctx, b.dataset.kind, state.data[b.dataset.kind].find(i => i.id === b.dataset.edit)) })
  root.querySelectorAll('[data-withdraw]').forEach(b => { b.onclick = async () => { if (!confirm('确认撤回这条内容？同学将无法在网站中查看，历史版本仍保留。')) return; const data = structuredClone(state.data); data[b.dataset.kind].find(i => i.id === b.dataset.withdraw).status = 'withdrawn'; await commit(ctx, data, [], b) } })
}

function editorFields(kind, item) {
  const options = list => list.map(subject => `<option value="${e(subject)}"${normalizeCourse(item.subject) === subject ? ' selected' : ''}>${e(subject)}</option>`).join('')
  const category = `<div class="field"><label for="category">分类 *</label><select id="category" name="category">${Object.entries(CATEGORIES[kind] || {}).map(([id, label]) => `<option value="${id}" ${item.category === id ? 'selected' : ''}>${label}</option>`).join('')}</select></div>`
  if (kind === 'homeworks') return `<div class="field"><label for="subject">课程 *</label><input id="subject" name="subject" required maxlength="100" list="course-options" value="${e(item.subject || '')}"><datalist id="course-options">${courseOptions([item]).map(subject => `<option value="${e(subject)}"></option>`).join('')}</datalist></div>
<div class="field"><label for="deadline">截止日期 *</label><input id="deadline" type="date" name="deadline" required value="${e(item.deadline || '')}"></div>${submissionSelect(item.submissionPlatform)}`
  if (kind === 'materials') return `<div class="field"><label for="subject">所属课程</label><select id="subject" name="subject"><option value="">未分类课程</option>${options(courseOptions([item]))}</select></div>${category}`
  return category
}

function editor(ctx, kind, item = {}) {
  const { root, state, toast } = ctx
  const section = root.querySelector('#editor')
  section.innerHTML = `<form class="panel editor" id="publish-form">
<h2 class="panel-title">${item.id ? '编辑' : '发布'}${KINDS[kind]}</h2>
<div class="field"><label for="title">标题 *</label><input id="title" name="title" required maxlength="120" value="${e(item.title || '')}"></div>
${editorFields(kind, item)}
<fieldset class="field"><legend>班级范围 *</legend><div class="checks">${CLASSES.map(([id, label]) => `<label class="check-pill"><input type="checkbox" name="classes" value="${id}" ${(item.targetClasses || ['all']).includes(id) ? 'checked' : ''}>${label}</label>`).join('')}</div></fieldset>
<div class="field"><label for="description">${kind === 'notices' ? '通知正文' : '说明'}</label><textarea id="description" name="description" maxlength="20000">${e(item.description || item.content || '')}</textarea></div>
<div class="field"><label for="attachments">附件（最多 3 个，每个不超过 20 MB）</label><input id="attachments" type="file" multiple accept=".pdf,.doc,.docx,.ppt,.pptx,.md,.png,.jpg,.jpeg,.webp"><p class="field-hint">已有附件：${e((item.attachments || []).map(a => a.name).join('、') || '无')}。选择新附件会替换本条内容的附件。附件会公开，请确认有权分享。PDF 可由浏览器打开，Word / PPT 可下载到对应应用查看。</p></div>
<label class="confirm"><input type="checkbox" id="reviewed" ${item.status === 'published' ? 'checked' : ''}><span>我已检查正文及附件，确认可以公开分享</span></label>
<div class="form-actions"><button class="button button--secondary" type="submit" name="action" value="draft">保存草稿</button><button class="button button--primary" type="submit" name="action" value="published">提交发布</button><button class="button button--ghost" type="button" id="cancel-edit">取消</button></div>
</form>`
  section.scrollIntoView({ behavior: motion(), block: 'start' })
  section.querySelector('#title').focus({ preventScroll: true })
  section.querySelector('#cancel-edit').onclick = () => { section.innerHTML = '' }
  section.querySelector('#publish-form').onsubmit = async event => {
    event.preventDefault(); if (session.busy) return
    const form = event.target, values = new FormData(form), status = event.submitter?.value || 'draft'
    if (status === 'published' && !form.querySelector('#reviewed').checked) { toast('请先检查内容并确认可以公开分享。'); return }
    const selected = values.getAll('classes'); if (!selected.length) { toast('请至少选择一个班级。'); return }
    const attachments = Array.from(form.querySelector('#attachments').files)
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
      await commit(ctx, data, uploads, event.submitter)
    } catch (error) { toast(error.message) }
  }
}

async function commit(ctx, data, files, button) {
  const { state, toast } = ctx
  if (session.busy) return
  session.busy = true; if (button) button.disabled = true
  try {
    data.updatedAt = new Date().toISOString()
    const snapshot = await session.publisher.publish(data, session.snapshot, files)
    session.snapshot = snapshot; state.data = data; renderAdmin(ctx); toast('已提交到 GitHub。网站部署完成后，同学刷新即可看到更新。')
  } catch (error) { toast(error.message) } finally { session.busy = false; if (button) button.disabled = false }
}
