import { CLASSES, escapeHtml as e, validateContent } from './domain.js?v=20261007-9'
import { SECTIONS, studentView, regions, detailView, navCounts, errorView } from './student-view.js?v=20261007-9'
import { icon } from './icons.js?v=20261007-9'
import { renderAdmin } from './admin.js?v=20261007-9'

const app = document.querySelector('#app')
const dialog = document.querySelector('#detail')
const sheet = document.querySelector('#detail-content')
const toastEl = document.querySelector('#toast')
const statusEl = document.querySelector('#results-status')
const classSelect = document.querySelector('#class-switch')
const themeButton = document.querySelector('#theme-toggle')
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
const coarsePointer = matchMedia('(pointer: coarse)')
const PAGE = 24
const FILTERS = { filter: 'all', subject: 'all', format: 'all', query: '', limit: PAGE }
const THEMES = { auto: ['跟随系统', 'auto'], light: ['浅色', 'sun'], dark: ['深色', 'moon'] }

const storage = {
  read(key, fallback) { try { return JSON.parse(localStorage.getItem('xueshiban:' + key)) ?? fallback } catch { return fallback } },
  write(key, value) { try { localStorage.setItem('xueshiban:' + key, JSON.stringify(value)); return true } catch { toast('浏览器未允许保存，本次操作在关闭页面后可能丢失。'); return false } }
}
const state = { data: null, error: '', classId: storage.read('class', 'all'), done: storage.read('done', []), read: storage.read('read', []), sort: 'deadline-asc', ...FILTERS }
if (!CLASSES.some(([id]) => id === state.classId)) state.classId = 'all'
if (!Array.isArray(state.done)) state.done = []
if (!Array.isArray(state.read)) state.read = []

let section = null
let openId = ''
let pushedDetail = false
let closingFromHistory = false
let returnFocusKey = null
let refreshTimer
let toastTimer

const keyOf = el => el?.dataset?.action ? `${el.dataset.action}|${el.dataset.value ?? ''}|${el.dataset.id ?? ''}` : null
const focusByKey = (root, key) => { if (key) [...root.querySelectorAll('[data-action]')].find(el => keyOf(el) === key)?.focus({ preventScroll: true }) }
const findItem = id => state.data?.[section]?.find(item => item.id === id && item.status === 'published')
const searchInput = () => app.querySelector('#search')

function parseHash() {
  const [name, raw] = location.hash.slice(1).split('/')
  let id = ''
  try { id = raw ? decodeURIComponent(raw) : '' } catch { id = '' }
  return { name: name || 'homeworks', id }
}

function route() {
  const { name, id } = parseHash()
  if (name === 'admin') {
    if (dialog.open) closeDetail(true)
    section = 'admin'; setChrome()
    renderAdmin({ root: app, state, toast, reload: load })
    return
  }
  if (!SECTIONS[name]) { history.replaceState(null, '', '#homeworks'); route(); return }
  if (name !== section) { Object.assign(state, FILTERS); section = name; renderPage(); window.scrollTo(0, 0) }
  if (id && state.data) { if (!dialog.open || openId !== id) openDetail(id, false) } else if (!id && dialog.open) closeDetail(true)
}

function setChrome() {
  document.body.dataset.section = section
  document.querySelectorAll('[data-nav]').forEach(link => {
    const active = link.dataset.nav === section
    link.classList.toggle('is-active', active)
    if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current')
  })
  document.title = section === 'admin' ? '管理 · 学事板' : `${SECTIONS[section].label} · 学事板`
  updateBadges()
}

function updateBadges() {
  const counts = state.data ? navCounts(state.data, state) : {}
  document.querySelectorAll('[data-badge]').forEach(el => {
    const count = counts[el.dataset.badge] || 0
    el.hidden = !count
    el.innerHTML = `<span class="visually-hidden">${e(el.dataset.badgeLabel || '')}</span>${count > 99 ? '99+' : count}`
  })
}

function renderPage() {
  setChrome()
  if (state.error) { app.innerHTML = errorView(state.error); app.setAttribute('aria-busy', 'false'); return }
  if (!state.data) return
  app.innerHTML = studentView(state.data, state, section)
  app.setAttribute('aria-busy', 'false')
  bindSearch()
}

function refresh() {
  clearTimeout(refreshTimer)
  if (!state.data || !SECTIONS[section]) return
  const focusKey = app.contains(document.activeElement) ? keyOf(document.activeElement) : null
  const scroll = new Map([...app.querySelectorAll('[data-keep-scroll]')].map(el => [el.dataset.keepScroll, el.scrollLeft]))
  const parts = regions(state.data, state, section)
  for (const [name, html] of Object.entries(parts)) { const el = app.querySelector(`[data-region="${name}"]`); if (el) el.innerHTML = html }
  app.querySelectorAll('[data-keep-scroll]').forEach(el => { if (scroll.has(el.dataset.keepScroll)) el.scrollLeft = scroll.get(el.dataset.keepScroll) })
  focusByKey(app, focusKey)
  updateBadges()
  const heading = app.querySelector('[data-count]')
  if (heading) statusEl.textContent = `${heading.dataset.count} ${heading.dataset.unit}结果`
}

function update(patch) { Object.assign(state, patch); refresh() }

function bindSearch() {
  const input = searchInput()
  if (!input) return
  const apply = () => { if (state.query !== input.value) update({ query: input.value, limit: PAGE }) }
  input.addEventListener('input', event => { if (!event.isComposing) apply() })
  input.addEventListener('compositionend', apply)
  input.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return
    if (input.value) { event.preventDefault(); input.value = ''; apply() } else input.blur()
  })
}

function resetFilters() {
  const input = searchInput()
  if (input) input.value = ''
  update({ ...FILTERS })
}

function revealSelectedFacet() {
  const chip = app.querySelector('.facet[aria-pressed="true"]')
  const rail = chip?.parentElement
  if (!rail || rail.scrollWidth <= rail.clientWidth) return
  rail.scrollTo({ left: chip.offsetLeft - (rail.clientWidth - chip.offsetWidth) / 2, behavior: reducedMotion.matches ? 'auto' : 'smooth' })
}

function showMore() {
  const before = app.querySelectorAll('.row').length
  update({ limit: state.limit + PAGE })
  app.querySelectorAll('.row')[before]?.querySelector('.row-main')?.focus({ preventScroll: true })
}

function setClass(id) {
  state.classId = id
  classSelect.value = id
  storage.write('class', id)
  if (SECTIONS[section]) update({ limit: PAGE }); else updateBadges()
}

function toggleDone(id, { undo = false } = {}) {
  const wasDone = state.done.includes(id)
  state.done = wasDone ? state.done.filter(value => value !== id) : [...state.done, id]
  storage.write('done', state.done)
  app.querySelectorAll('.hw-row').forEach(row => {
    if (row.dataset.id !== id) return
    row.classList.toggle('is-done', !wasDone)
    row.querySelector('.check')?.setAttribute('aria-pressed', String(!wasDone))
  })
  if (dialog.open && openId === id) renderDetail(true)
  updateBadges()
  clearTimeout(refreshTimer)
  refreshTimer = setTimeout(refresh, reducedMotion.matches ? 0 : 520)
  if (undo) return
  const title = findItem(id)?.title || ''
  toast(wasDone ? `已移回待完成：${title}` : `已完成：${title}`, { label: '撤销', run: () => toggleDone(id, { undo: true }) })
}

function markAllRead() {
  const previous = state.read
  const ids = (state.data.notices || []).filter(item => item.status === 'published').map(item => item.id)
  state.read = [...new Set([...previous, ...ids])]
  storage.write('read', state.read)
  refresh()
  toast('已全部标为已读', { label: '撤销', run: () => { state.read = previous; storage.write('read', previous); refresh() } })
}

function renderDetail(keepFocus = false) {
  const item = findItem(openId)
  if (!item) return
  const focusKey = keepFocus && sheet.contains(document.activeElement) ? keyOf(document.activeElement) : null
  sheet.innerHTML = detailView(item, section, state)
  focusByKey(sheet, focusKey)
}

function openDetail(id, push) {
  const item = findItem(id)
  if (!item) {
    toast('该内容不存在或已撤回。')
    if (!push) history.replaceState(null, '', '#' + section)
    return
  }
  openId = id
  if (section === 'notices' && !state.read.includes(id)) { state.read = [...state.read, id]; storage.write('read', state.read) }
  if (!dialog.open) returnFocusKey = keyOf(document.activeElement)
  renderDetail()
  if (push) { history.pushState(null, '', `#${section}/${encodeURIComponent(id)}`); pushedDetail = true }
  if (!dialog.open) { dialog.showModal(); document.documentElement.classList.add('is-locked') }
  sheet.querySelector('.sheet-body')?.scrollTo(0, 0)
  sheet.querySelector('[data-action="close"]')?.focus({ preventScroll: true })
  if (section === 'notices') refresh()
}

function closeDetail(fromHistory) { closingFromHistory = fromHistory; dialog.close() }

dialog.addEventListener('close', () => {
  document.documentElement.classList.remove('is-locked')
  document.body.append(toastEl)
  openId = ''
  if (closingFromHistory) closingFromHistory = false
  else if (pushedDetail) history.back()
  else history.replaceState(null, '', '#' + section)
  pushedDetail = false
  focusByKey(app, returnFocusKey)
})
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return
  const rect = dialog.getBoundingClientRect()
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close()
})
sheet.addEventListener('click', event => {
  const target = event.target.closest('[data-action]')
  if (!target) return
  if (target.dataset.action === 'close') dialog.close()
  else if (target.dataset.action === 'toggle-done') toggleDone(target.dataset.id)
  else if (target.dataset.action === 'share') share(target.dataset.id)
})

async function share(id) {
  const item = findItem(id)
  const url = new URL(`#${section}/${encodeURIComponent(id)}`, location.href).href
  if (navigator.share && coarsePointer.matches) {
    try { await navigator.share({ title: item?.title, text: `${item?.title || ''} · 学事板`, url }); return } catch (error) { if (error?.name === 'AbortError') return }
  }
  try { await navigator.clipboard.writeText(url); toast('链接已复制，可以发给同学了。') } catch { toast('请从浏览器地址栏复制当前链接。') }
}

function toast(message, action) {
  clearTimeout(toastTimer)
  ;(dialog.open ? dialog : document.body).append(toastEl)
  toastEl.innerHTML = `<span class="toast-text">${e(message)}</span>${action ? `<button class="toast-action" type="button">${e(action.label)}</button>` : ''}`
  if (action) toastEl.querySelector('.toast-action').onclick = () => { toastEl.hidden = true; action.run() }
  toastEl.hidden = true
  void toastEl.offsetWidth
  toastEl.hidden = false
  toastTimer = setTimeout(() => { toastEl.hidden = true }, action ? 5200 : 3200)
}

function applyTheme(mode) {
  const theme = Object.hasOwn(THEMES, mode) ? mode : 'auto'
  if (theme === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = theme
  const [label, symbol] = THEMES[theme]
  themeButton.dataset.mode = theme
  themeButton.innerHTML = icon(symbol)
  themeButton.setAttribute('aria-label', `外观：${label}（点击切换）`)
  themeButton.title = `外观：${label}`
  document.querySelectorAll('meta[name="theme-color"]').forEach(meta => {
    meta.dataset.base ??= meta.content
    meta.content = theme === 'auto' ? meta.dataset.base : getComputedStyle(document.documentElement).getPropertyValue('--paper').trim() || meta.dataset.base
  })
}

app.addEventListener('click', event => {
  const target = event.target.closest('[data-action]')
  if (!target || !app.contains(target)) return
  const { action, value = '', id = '' } = target.dataset
  if (action === 'filter') update({ filter: value, limit: PAGE })
  else if (action === 'subject') { update({ subject: value, limit: PAGE }); revealSelectedFacet() }
  else if (action === 'reset') resetFilters()
  else if (action === 'more') showMore()
  else if (action === 'open') openDetail(id, true)
  else if (action === 'toggle-done') toggleDone(id)
  else if (action === 'clear-search') { resetSearch(); searchInput()?.focus() }
  else if (action === 'all-classes') setClass('all')
  else if (action === 'mark-all-read') markAllRead()
  else if (action === 'retry') load()
})
app.addEventListener('change', event => {
  const { action } = event.target.dataset
  if (action === 'sort') update({ sort: event.target.value, limit: PAGE })
  else if (action === 'format') update({ format: event.target.value, limit: PAGE })
})
function resetSearch() { const input = searchInput(); if (input) input.value = ''; update({ query: '', limit: PAGE }) }

addEventListener('keydown', event => {
  if (event.isComposing || dialog.open || !SECTIONS[section]) return
  const active = document.activeElement
  const typing = active && (/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName) || active.isContentEditable)
  const shortcut = ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') || (event.key === '/' && !typing && !event.ctrlKey && !event.metaKey && !event.altKey)
  if (!shortcut) return
  event.preventDefault()
  searchInput()?.focus()
  searchInput()?.select()
})
addEventListener('hashchange', route)

async function load() {
  state.error = ''
  try {
    const response = await fetch('./content.json', { cache: 'no-store' })
    if (!response.ok) throw new Error('内容暂时无法加载，请稍后重试。')
    state.data = validateContent(await response.json())
  } catch (error) {
    state.error = error instanceof TypeError ? '网络连接不稳定，内容暂时无法加载。' : error.message
  }
  if (section !== 'admin') { section = null; route() }
}

document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon) })
classSelect.innerHTML = CLASSES.map(([id, label]) => `<option value="${id}">${id === 'all' ? '全部班级' : label}</option>`).join('')
classSelect.value = state.classId
classSelect.addEventListener('change', () => setClass(classSelect.value))
applyTheme(storage.read('theme', 'auto'))
themeButton.addEventListener('click', () => {
  const order = Object.keys(THEMES)
  const next = order[(order.indexOf(themeButton.dataset.mode) + 1) % order.length]
  storage.write('theme', next)
  applyTheme(next)
  toast(`外观：${THEMES[next][0]}`)
})
route()
load()
