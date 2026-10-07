import { CURRENT_COURSES, OTHER_COURSES, normalizeCourse, shortCourse, courseTone, formatSize } from './courses.js?v=20261007-9'
import { CLASSES, CATEGORIES, SUBMISSION_PLATFORMS, escapeHtml as e, safeUrl, visibleItems, deadlineState, groupHomeworks, groupBy, formatDate, shanghaiDate, fileExtension } from './domain.js?v=20261007-9'
import { icon } from './icons.js?v=20261007-9'

export const SECTIONS = {
  homeworks: { label: '作业', noun: '作业', unit: '项', all: '全部作业', search: '搜索作业、课程或说明' },
  notices: { label: '通知', noun: '通知', unit: '条', all: '全部通知', search: '搜索通知' },
  materials: { label: '资料库', noun: '资料', unit: '份', all: '全部资料', search: '搜索资料、课程或文件名' }
}
const STATUS = [['all', '全部'], ['pending', '待完成'], ['done', '已完成'], ['expired', '已截止']]
const SORTS = [['deadline-asc', '截止时间 · 由近到远'], ['deadline-desc', '截止时间 · 由远到近'], ['subject', '按课程分组']]
const FILE_KINDS = { pdf: 'pdf', doc: 'word', docx: 'word', ppt: 'slides', pptx: 'slides', md: 'text', png: 'image', jpg: 'image', jpeg: 'image', webp: 'image' }
const VIEWABLE = ['pdf', 'md', 'png', 'jpg', 'jpeg', 'webp']
const FOOTNOTES = {
  homeworks: '完成记录只保存在这台设备上，换设备需要重新标记。',
  notices: '已读记录只保存在这台设备上。',
  materials: '历史资料仅供学习参考，不代表本学期考试范围。PDF 可在浏览器中直接查看，Word 文件需下载后打开。'
}

const prefs = state => ({ done: state.done || [], read: state.read || [] })
const classLabel = id => CLASSES.find(([value]) => value === id)?.[1] || ''
const isPending = (item, done, now) => !done.includes(item.id) && !deadlineState(item.deadline, now).expired
const isFiltered = (state, kind) => state.subject !== 'all' || state.filter !== 'all' || Boolean(state.query.trim()) || (kind === 'materials' && state.format !== 'all')
const platformOf = value => typeof value === 'string' && Object.hasOwn(SUBMISSION_PLATFORMS, value) && value !== 'none' ? SUBMISSION_PLATFORMS[value] : null
const meta = parts => parts.filter(Boolean).map(part => `<span>${e(part)}</span>`).join('')
const courseKicker = subject => `<span class="dot" data-tone="${courseTone(subject)}"></span>${e(shortCourse(subject))}`

export function studentView(data, state, kind, now = new Date()) {
  const parts = regions(data, state, kind, now)
  return `<div class="page" data-kind="${kind}">
  <section class="page-head">
    <div class="page-art" aria-hidden="true"></div>
    <div class="container page-head-inner">
      <div data-region="head">${parts.head}</div>
      ${searchBar(kind, state)}
    </div>
  </section>
  <div class="container layout">
    <aside class="layout-aside" data-region="facets">${parts.facets}</aside>
    <div class="layout-main" data-region="body">${parts.body}</div>
  </div>
</div>`
}

export function regions(data, state, kind, now = new Date()) {
  const all = visibleItems(data, kind, { classId: state.classId })
  return { head: pageHead(kind, all, state, now), facets: facets(kind, all, state), body: body(data, kind, all, state, now) }
}

function pageHead(kind, all, state, now) {
  const scope = state.classId && state.classId !== 'all' ? ` · ${classLabel(state.classId)}` : ''
  return `<p class="page-kicker">${icon('calendar')}<span>${e(formatDate(shanghaiDate(now), { weekday: true, now }))}${e(scope)}</span></p>
<h1 class="page-title">${SECTIONS[kind].label}</h1>
<p class="page-summary">${summary(kind, all, state, now)}</p>`
}

function summary(kind, all, state, now) {
  const { done, read } = prefs(state)
  if (kind === 'homeworks') {
    if (!all.length) return '目前没有布置作业，新作业发布后会自动出现在这里。'
    const pending = all.filter(item => isPending(item, done, now)).sort((a, b) => (a.deadline || '9').localeCompare(b.deadline || '9'))
    if (!pending.length) return '作业都已完成或截止，可以安心休息一下。'
    const days = deadlineState(pending[0].deadline, now).days
    const when = days === 0 ? '<em data-due="today">今天</em>截止' : days === 1 ? '<em data-due="tomorrow">明天</em>截止' : days !== null && days <= 7 ? `${days} 天后截止` : `在${e(formatDate(pending[0].deadline, { now }))}截止`
    return `还有 <strong>${pending.length}</strong> 项待完成，最近一项${when}。`
  }
  if (kind === 'notices') {
    if (!all.length) return '暂时没有通知，课程安排和考试信息会第一时间放在这里。'
    const unread = all.filter(item => !read.includes(item.id)).length
    return unread ? `<strong>${unread}</strong> 条未读，共 ${all.length} 条通知。` : `${all.length} 条通知都已读过。`
  }
  if (!all.length) return '资料正在整理中，发布后会按课程归类在这里。'
  const courses = new Set(all.map(item => normalizeCourse(item.subject)).filter(Boolean)).size
  return `<strong>${all.length}</strong> 份资料，覆盖 ${courses} 门课程。`
}

function searchBar(kind, state) {
  const label = SECTIONS[kind].search
  return `<div class="search" role="search">
  ${icon('search', 'search-icon')}
  <input class="search-input" id="search" type="search" enterkeyhint="search" autocomplete="off" spellcheck="false" placeholder="${label}" aria-label="${label}" aria-keyshortcuts="Control+K Meta+K /" value="${e(state.query)}">
  <kbd class="search-kbd" aria-hidden="true">/</kbd>
  <button class="search-clear" type="button" data-action="clear-search" aria-label="清除搜索">${icon('x')}</button>
</div>`
}

function facetButton({ action, value, label, title = label, count, selected, tone, note = '' }) {
  return `<button class="facet${count ? '' : ' is-empty'}" type="button" data-action="${action}" data-value="${e(value)}" aria-pressed="${selected}"${title !== label ? ` title="${e(title)}"` : ''}>${tone === undefined ? '' : `<span class="dot" data-tone="${tone}"></span>`}<span class="facet-label">${e(label)}</span><span class="facet-count">${count}</span>${note && !count ? `<span class="facet-note">${note}</span>` : ''}</button>`
}

function facets(kind, all, state) {
  if (kind === 'notices') {
    const options = [['all', '全部通知', all.length], ...Object.entries(CATEGORIES.notices).map(([id, label]) => [id, label, all.filter(item => item.category === id).length])]
    return `<nav class="facets" aria-label="按类型筛选"><div class="facets-scroll" data-keep-scroll="facets">${options.map(([value, label, count]) => facetButton({ action: 'filter', value, label, count, selected: state.filter === value })).join('')}</div></nav>`
  }
  const counts = new Map()
  for (const item of all) { const course = normalizeCourse(item.subject); if (course) counts.set(course, (counts.get(course) || 0) + 1) }
  const extra = [...counts.keys()].filter(course => !CURRENT_COURSES.includes(course) && !OTHER_COURSES.includes(course))
  const others = [...OTHER_COURSES, ...extra].filter(course => counts.get(course))
  const selected = normalizeCourse(state.subject)
  const course = name => facetButton({ action: 'subject', value: name, label: shortCourse(name), title: name, count: counts.get(name) || 0, selected: selected === name, tone: courseTone(name), note: kind === 'materials' ? '待补充' : '' })
  return `<nav class="facets" aria-label="按课程筛选"><div class="facets-scroll" data-keep-scroll="facets">
${facetButton({ action: 'subject', value: 'all', label: '全部课程', count: all.length, selected: state.subject === 'all' })}
<p class="facet-heading">本学期</p>${CURRENT_COURSES.map(course).join('')}
${others.length ? `<p class="facet-heading">其他课程</p>${others.map(course).join('')}` : ''}
</div></nav>`
}

function segments(kind, all, scoped, state, done, now) {
  let options
  if (kind === 'homeworks') {
    const count = { all: scoped.length, pending: scoped.filter(item => isPending(item, done, now)).length, done: scoped.filter(item => done.includes(item.id)).length, expired: scoped.filter(item => deadlineState(item.deadline, now).expired).length }
    options = STATUS.map(([value, label]) => [value, label, count[value]])
  } else if (kind === 'materials') {
    const present = Object.keys(CATEGORIES.materials).filter(id => id === state.filter || all.some(item => item.category === id))
    if (present.length < 2) return ''
    options = [['all', '全部', scoped.length], ...present.map(id => [id, CATEGORIES.materials[id], scoped.filter(item => item.category === id).length])]
  } else return ''
  return `<div class="segmented" role="group" aria-label="${kind === 'homeworks' ? '按状态筛选' : '按用途筛选'}" data-keep-scroll="segments">${options.map(([value, label, count]) => `<button class="segment" type="button" data-action="filter" data-value="${value}" aria-pressed="${state.filter === value}">${label}<span class="segment-count">${count}</span></button>`).join('')}</div>`
}

function resultsTools(kind, all, list, state) {
  const tools = []
  if (isFiltered(state, kind)) tools.push('<button class="text-button" type="button" data-action="reset">清除筛选</button>')
  if (kind === 'notices' && list.some(item => !prefs(state).read.includes(item.id))) tools.push('<button class="text-button" type="button" data-action="mark-all-read">全部标为已读</button>')
  if (kind === 'homeworks' && all.length) tools.push(selectChip('sort', '排序方式', SORTS, state.sort))
  if (kind === 'materials') {
    const formats = [...new Set(all.flatMap(item => item.attachments.map(file => fileExtension(file.name))).filter(Boolean))].sort()
    if (formats.length > 1 || state.format !== 'all') tools.push(selectChip('format', '文件格式', [['all', '全部格式'], ...formats.map(ext => [ext, ext.toUpperCase()])], state.format))
  }
  return tools.join('')
}

function selectChip(action, label, options, value) {
  return `<label class="select-chip"><span class="visually-hidden">${label}</span><select data-action="${action}">${options.map(([id, text]) => `<option value="${e(id)}"${id === value ? ' selected' : ''}>${e(text)}</option>`).join('')}</select>${icon('chevron-down')}</label>`
}

function body(data, kind, all, state, now) {
  const { done } = prefs(state)
  const query = { ...state, done }
  const scoped = visibleItems(data, kind, { ...query, filter: 'all' })
  const list = visibleItems(data, kind, query)
  const keyword = state.query.trim()
  const title = keyword ? `搜索“${e(keyword)}”` : state.subject !== 'all' ? e(normalizeCourse(state.subject)) : kind === 'notices' && state.filter !== 'all' ? CATEGORIES.notices[state.filter] || SECTIONS[kind].all : SECTIONS[kind].all
  const shown = list.slice(0, state.limit)
  const rest = list.length - shown.length
  return `${segments(kind, all, scoped, state, done, now)}
<div class="results-head">
  <h2 class="results-title" data-count="${list.length}" data-unit="${SECTIONS[kind].unit}"><span class="results-name">${title}</span><span class="results-count">${list.length} ${SECTIONS[kind].unit}</span></h2>
  <div class="results-tools">${resultsTools(kind, all, list, state)}</div>
</div>
${shown.length ? groups(kind, shown, state, now) : emptyState(kind, all, state)}
${rest > 0 ? `<button class="load-more" type="button" data-action="more">显示更多<span>还有 ${rest} 条</span></button>` : ''}
<p class="footnote">${e(FOOTNOTES[kind])}${state.classId !== 'all' ? ` 当前只显示与${e(classLabel(state.classId))}相关的内容。` : ''}</p>`
}

function groups(kind, items, state, now) {
  let sections, row
  if (kind === 'homeworks') {
    sections = groupHomeworks(items, { done: prefs(state).done, sort: state.sort, now })
    row = item => homeworkRow(item, state, now)
  } else if (kind === 'materials') {
    const byCourse = state.subject === 'all'
    sections = byCourse ? groupBy(items, item => normalizeCourse(item.subject) || '未分类课程') : groupBy(items, item => item.category, key => CATEGORIES.materials[key] || '其他')
    row = item => materialCard(item, { hide: byCourse ? 'course' : 'category' })
  } else {
    sections = [{ key: 'all', label: '', items }]
    row = item => noticeRow(item, state, now)
  }
  const courseGrouped = (kind === 'materials' && state.subject === 'all') || (kind === 'homeworks' && state.sort === 'subject')
  return sections.map(({ key, label, items: rows }) => `<section class="group" data-group="${e(key)}"${label ? ` aria-label="${e(label)}"` : ''}>
${label ? `<h3 class="group-head">${courseGrouped ? `<span class="dot" data-tone="${courseTone(key)}"></span>` : ''}<span class="group-label">${e(label)}</span><span class="group-count">${rows.length}</span></h3>` : ''}
<div class="rows">${rows.map(row).join('')}</div>
</section>`).join('')
}

function emptyState(kind, all, state) {
  const { noun } = SECTIONS[kind]
  const box = (symbol, title, text, button = '') => `<div class="empty"><span class="empty-icon">${icon(symbol)}</span><p class="empty-title">${title}</p><p class="empty-text">${text}</p>${button}</div>`
  if (!all.length) {
    const scoped = state.classId !== 'all'
    return box('inbox', scoped ? `${e(classLabel(state.classId))}暂时没有${noun}` : `暂时没有${noun}`, kind === 'materials' ? '资料整理好后会按课程出现在这里。' : '发布后会自动出现在这里，不用再翻聊天记录。', scoped ? '<button class="button button--secondary" type="button" data-action="all-classes">查看全部班级</button>' : '')
  }
  const courseOnly = state.subject !== 'all' && state.filter === 'all' && !state.query.trim() && state.format === 'all'
  if (courseOnly) return box('inbox', `${e(shortCourse(state.subject))}还没有${noun}`, '内容发布后会出现在这里。', '<button class="button button--secondary" type="button" data-action="subject" data-value="all">查看全部课程</button>')
  return box('search', '没有找到匹配的内容', '换个关键词试试，或清除筛选条件。', '<button class="button button--secondary" type="button" data-action="reset">清除筛选</button>')
}

function fileBadge(ext) {
  return `<span class="file-badge" data-kind="${FILE_KINDS[ext] || 'other'}" aria-hidden="true">${e((ext || '文件').toUpperCase().slice(0, 4))}</span>`
}

function dueState(item, isDone, now) {
  const { days, expired } = deadlineState(item.deadline, now)
  if (isDone) return ['done', '']
  if (days === null) return ['later', '']
  if (expired) return ['expired', '已截止']
  if (days === 0) return ['today', '今天']
  if (days === 1) return ['tomorrow', '明天']
  return [days <= 7 ? 'week' : 'later', days <= 30 ? `${days} 天` : formatDate(item.deadline, { now })]
}

export function homeworkRow(item, state = {}, now = new Date()) {
  const isDone = prefs(state).done.includes(item.id)
  const [due, badge] = dueState(item, isDone, now)
  const platform = platformOf(item.submissionPlatform)
  const id = e(item.id)
  return `<article class="row hw-row${isDone ? ' is-done' : ''}" data-id="${id}" data-due="${due}">
<button class="check" type="button" data-action="toggle-done" data-id="${id}" aria-pressed="${isDone}" aria-label="标记完成：${e(item.title)}">${icon('check')}</button>
<button class="row-main" type="button" data-action="open" data-id="${id}">
<span class="row-text"><span class="row-kicker">${courseKicker(item.subject)}</span><span class="row-title">${e(item.title)}</span><span class="row-meta">${meta([`${formatDate(item.deadline, { weekday: true, now })}截止`, platform && (item.submissionPlatform === 'notebook' ? '作业本提交' : `${platform.label}提交`)])}</span></span>
${badge ? `<span class="due-badge">${e(badge)}</span>` : ''}
</button>
</article>`
}

export function noticeRow(item, state = {}, now = new Date()) {
  const unread = !prefs(state).read.includes(item.id)
  const excerpt = String(item.description || item.content || '').replace(/\s+/g, ' ').trim().slice(0, 120)
  const date = formatDate(item.updatedAt, { now })
  return `<article class="row notice-row${unread ? ' is-unread' : ''}" data-id="${e(item.id)}">
<button class="row-main" type="button" data-action="open" data-id="${e(item.id)}">
<span class="row-text"><span class="row-kicker"><span class="tag" data-category="${e(item.category)}">${e(CATEGORIES.notices[item.category] || '通知')}</span>${date ? `<span>${e(date)}</span>` : ''}${unread ? '<span class="visually-hidden">未读</span>' : ''}</span><span class="row-title">${e(item.title)}</span>${excerpt ? `<span class="row-excerpt">${e(excerpt)}</span>` : ''}</span>
${icon('chevron-right', 'row-chevron')}
</button>
</article>`
}

export function materialCard(item, { hide = '' } = {}) {
  const files = item.attachments
  const size = files.reduce((sum, file) => sum + (file.size || 0), 0)
  return `<article class="row file-row" data-id="${e(item.id)}">
<button class="row-main" type="button" data-action="open" data-id="${e(item.id)}">
${fileBadge(fileExtension(files[0]?.name))}
<span class="row-text"><span class="row-title">${e(item.title)}</span><span class="row-meta">${meta([hide !== 'course' && normalizeCourse(item.subject) && shortCourse(item.subject), hide !== 'category' && CATEGORIES.materials[item.category], files.length > 1 && `${files.length} 个版本`, size && formatSize(size), item.year && `${item.year} 年版`])}</span></span>
${icon('chevron-right', 'row-chevron')}
</button>
</article>`
}

function fileItem(file) {
  const url = safeUrl(file.url)
  if (!url) return ''
  const ext = fileExtension(file.name)
  const local = url.startsWith('files/')
  const viewable = VIEWABLE.includes(ext)
  const open = `<a class="button button--small button--secondary" href="${e(url)}" target="_blank" rel="noopener noreferrer"${local && !viewable ? ` download="${e(file.name)}"` : ''}>${viewable ? '查看' : local ? '下载' : '打开'}</a>`
  const download = local && viewable ? `<a class="icon-button icon-button--small" href="${e(url)}" download="${e(file.name)}" aria-label="下载 ${e(file.name)}" title="下载">${icon('download')}</a>` : ''
  return `<div class="file">${fileBadge(ext)}<div class="file-info"><span class="file-name">${e(file.name)}</span><span class="file-meta">${e([file.size ? formatSize(file.size) : '', viewable ? '可在浏览器中查看' : '下载后用对应应用打开'].filter(Boolean).join(' · '))}</span></div><div class="file-actions">${open}${download}</div></div>${/^(png|jpe?g|webp)$/.test(ext) ? `<img class="detail-image" src="${e(url)}" alt="${e(file.name)}" loading="lazy">` : ''}`
}

export function detailView(item, kind, state = {}, now = new Date()) {
  const isDone = prefs(state).done.includes(item.id)
  const classes = item.targetClasses.map(classLabel).filter(Boolean).join('、')
  const facts = []
  let kicker
  if (kind === 'homeworks') {
    const due = deadlineState(item.deadline, now)
    const platform = platformOf(item.submissionPlatform)
    kicker = courseKicker(item.subject)
    facts.push(['截止', `${formatDate(item.deadline, { weekday: true, now })}${due.days === null ? '' : ` · ${due.label}`}`], ['课程', normalizeCourse(item.subject)])
    if (platform) facts.push(['提交', platform.label])
  } else if (kind === 'notices') {
    kicker = `<span class="tag" data-category="${e(item.category)}">${e(CATEGORIES.notices[item.category] || '通知')}</span>`
  } else {
    kicker = normalizeCourse(item.subject) ? courseKicker(item.subject) : '资料'
    if (normalizeCourse(item.subject)) facts.push(['课程', normalizeCourse(item.subject)])
    facts.push(['用途', CATEGORIES.materials[item.category] || '其他'])
    if (item.year) facts.push(['年份', `${item.year} 年版`])
  }
  facts.push(['范围', classes === '全体' ? '全体同学' : classes])
  if (item.updatedAt) facts.push(['更新', formatDate(item.updatedAt, { now })])
  const text = String(item.description || item.content || '')
  const files = item.attachments.map(fileItem).join('')
  const actions = kind === 'homeworks'
    ? `${submissionLink(item.submissionPlatform, true)}<button class="button button--secondary" type="button" data-action="toggle-done" data-id="${e(item.id)}" aria-pressed="${isDone}">${icon('check')}${isDone ? '已完成' : '标记完成'}</button>`
    : ''
  return `<header class="sheet-head"><p class="sheet-kicker">${kicker}</p><button class="icon-button" type="button" data-action="close" aria-label="关闭详情">${icon('x')}</button></header>
<div class="sheet-body">
<h2 class="sheet-title" id="detail-title">${e(item.title)}</h2>
<dl class="facts">${facts.map(([term, value]) => `<div><dt>${term}</dt><dd>${e(value)}</dd></div>`).join('')}</dl>
${text ? `<div class="prose">${e(text)}</div>` : ''}
${files ? `<section class="attachments" aria-label="附件"><h3 class="attachments-head">附件<span>${item.attachments.length}</span></h3>${files}</section>` : ''}
</div>
<footer class="sheet-foot">${actions}<button class="button button--ghost" type="button" data-action="share" data-id="${e(item.id)}">${icon('share')}分享</button></footer>`
}

export function navCounts(data, state, now = new Date()) {
  const { done, read } = prefs(state)
  return {
    homeworks: visibleItems(data, 'homeworks', { classId: state.classId }).filter(item => isPending(item, done, now)).length,
    notices: visibleItems(data, 'notices', { classId: state.classId }).filter(item => !read.includes(item.id)).length
  }
}

export function errorView(message) {
  return `<div class="container state-screen"><div class="empty"><span class="empty-icon">${icon('alert')}</span><p class="empty-title">暂时没能打开学事板</p><p class="empty-text">${e(message)}</p><button class="button button--primary" type="button" data-action="retry">${icon('refresh')}重新加载</button></div></div>`
}

export function submissionLink(platform, prominent = false) {
  const target = typeof platform === 'string' && Object.hasOwn(SUBMISSION_PLATFORMS, platform) ? SUBMISSION_PLATFORMS[platform] : null
  if (platform === 'notebook') return '<span class="submission-offline">作业本 · 线下提交</span>'
  return target?.url ? `<a class="${prominent ? 'button button--primary' : 'link'} submission-link" href="${target.url}" target="_blank" rel="noopener noreferrer" aria-label="前往${target.label}提交（打开平台网站）">前往提交 · ${target.label}${icon('external')}</a>` : ''
}

export function submissionSelect(platform = 'none') {
  return `<div class="field"><label for="submission-platform">提交方式</label><select id="submission-platform" name="submissionPlatform">${Object.entries(SUBMISSION_PLATFORMS).map(([id, target]) => `<option value="${id}" ${platform === id ? 'selected' : ''}>${target.label}</option>`).join('')}</select><p class="field-hint">在线作业只需选择平台，不用填写具体作业链接。作业本显示线下提交提示；提交时间、地点等要求请写在说明中。</p></div>`
}
