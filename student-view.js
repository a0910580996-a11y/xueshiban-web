import { CURRENT_COURSES, OTHER_COURSES, courseOptions, normalizeCourse, formatSize } from './courses.js?v=20261007-4'
import { CATEGORIES, SUBMISSION_PLATFORMS, escapeHtml as e, visibleItems, deadlineState } from './domain.js?v=20261007-6'

const titles = { homeworks: ['学习有序，心中有数。', '作业与进度', '待办、截止日期和完成记录，在这里一眼看清。'], notices: ['重要的事，不错过。', '课程与考试通知', '把课程安排和考试信息，放在恰好的位置。'], materials: ['让资料，真正用起来。', '课程资料库', '从课程出发，找到讲义、复习重点和历年练习。'] }
export function studentView(data, state, kind, card, classPicker) {
  const all = visibleItems(data, kind, { classId: state.classId })
  const list = visibleItems(data, kind, state)
  const options = kind === 'homeworks' ? { all: '全部', pending: '待完成', done: '已完成', expired: '已截止' } : { all: '全部', ...CATEGORIES[kind] }
  const [title, eyebrow, subtitle] = titles[kind]
  const headingTitle = title.split('，').map((part,index) => `<span>${e(part)}${index === 0 ? '，' : ''}</span>`).join('')
  const courses = courseOptions(all)
  const courseControl = kind !== 'notices' ? `<label class="select-field">课程<select id="subject-filter" aria-label="按课程筛选"><option value="all">全部课程</option>${courses.map(subject => `<option value="${e(subject)}" ${normalizeCourse(state.subject) === subject ? 'selected' : ''}>${e(subject)}</option>`).join('')}</select></label>` : ''
  const sortControl = kind === 'homeworks' ? `<label class="select-field">排序<select id="sort-order" aria-label="作业排序">${[['deadline-asc', '截止日期 · 由近到远'], ['deadline-desc', '截止日期 · 由远到近'], ['subject', '课程名称']].map(([id, label]) => `<option value="${id}" ${state.sort === id ? 'selected' : ''}>${label}</option>`).join('')}</select></label>` : ''
  const formatControl = kind === 'materials' ? `<label class="select-field">文件类型<select id="format-filter" aria-label="按文件类型筛选">${[['all','所有格式'],['pdf','PDF'],['docx','Word DOCX'],['doc','Word DOC'],['pptx','PPTX'],['ppt','PPT'],['md','Markdown']].map(([id,label])=>`<option value="${id}" ${state.format === id ? 'selected' : ''}>${label}</option>`).join('')}</select></label>` : ''
  const stats = kind === 'homeworks' ? `<section class="stats" aria-label="作业进度">${[
    ['待完成', all.filter(i => !state.done.includes(i.id) && !deadlineState(i.deadline).expired).length],
    ['今天／明天截止', all.filter(i => !state.done.includes(i.id) && [0,1].includes(deadlineState(i.deadline).days)).length],
    ['已完成', all.filter(i => state.done.includes(i.id)).length]
  ].map(([label,value])=>`<div class="stat"><strong>${value}</strong><span>${label}</span></div>`).join('')}</section>` : ''
  const courseTile = subject => {
    const count = all.filter(i => normalizeCourse(i.subject) === subject).length
    return `<button class="course-card ${normalizeCourse(state.subject) === subject ? 'selected' : ''}" data-course="${e(subject)}" aria-pressed="${normalizeCourse(state.subject) === subject}"><span class="course-mark" aria-hidden="true">${e(subject === 'Python语言程序设计' ? 'Py' : subject.slice(0,2))}</span><span class="course-name">${e(subject)}</span><small>${count ? `${count} 份${kind === 'materials' ? '资料' : '作业'}` : '待补充'}</small><span class="course-arrow" aria-hidden="true">↗</span></button>`
  }
  const browse = kind !== 'notices' ? `<section class="course-section" aria-label="课程入口"><div class="section-heading"><div><span class="eyebrow">YOUR SEMESTER</span><h2>本学期课程 <small>11 门</small></h2></div><button id="toggle-courses" class="text-button" aria-expanded="${state.coursesOpen}">${state.coursesOpen ? '收起课程 −' : '展开课程 +'}</button></div>${state.coursesOpen ? `<div class="course-grid">${CURRENT_COURSES.map(courseTile).join('')}</div><details class="other-courses"><summary>大二其他课程 · 学期暂未确认</summary><div class="course-grid">${OTHER_COURSES.map(courseTile).join('')}</div></details>` : `<p class="course-hint">数学分析三、概率论、Python 等 11 门课程。展开选择，或使用下方课程筛选。</p>`}</section>` : ''
  const filtered = state.subject !== 'all' || state.filter !== 'all' || state.query.trim() || state.format !== 'all' || state.classId !== 'all'
  const heading = state.subject === 'all' ? kind === 'materials' ? '全部资料' : kind === 'homeworks' ? '我的作业' : '全部通知' : normalizeCourse(state.subject)
  return `<section class="hero"><div class="hero-copy"><span class="eyebrow">${e(eyebrow)}</span><h1>${headingTitle}</h1><p>${subtitle}</p><div class="hero-note">${kind === 'materials' ? `${all.length} 条已入库资料 · 按课程整理` : kind === 'homeworks' ? '做好眼前这一件，再继续下一件。' : '只保留课程通知与考试通知。'}</div></div><div class="hero-art" aria-hidden="true"></div></section>${stats}${browse}
  <section class="control-panel" aria-label="筛选与搜索"><div class="search-row"><div class="search-wrap"><span aria-hidden="true">⌕</span><input class="search" id="search" type="search" placeholder="${kind === 'materials' ? '搜课程、资料或文件名…' : kind === 'homeworks' ? '搜索作业或课程…' : '搜索通知…'}" aria-label="搜索${kind === 'materials' ? '资料' : kind === 'homeworks' ? '作业' : '通知'}" aria-keyshortcuts="Control+K Meta+K" value="${e(state.query)}"><kbd>Ctrl K</kbd></div><div class="scope-bar"><label for="class-picker">班级</label>${classPicker()}</div></div><div class="filter-row">${courseControl}${sortControl}${formatControl}<button id="reset-filters" class="text-button" ${filtered ? '' : 'disabled'}>重置筛选</button></div><div class="filters" aria-label="内容筛选">${Object.entries(options).map(([id,label])=>`<button data-filter="${id}" class="${state.filter === id ? 'active' : ''}" aria-pressed="${state.filter === id}">${label}</button>`).join('')}</div></section>
  <div class="results-heading"><h2>${e(heading)}</h2><span role="status">${list.length} ${kind === 'materials' ? '份资料' : '条内容'}</span></div><section class="list ${kind === 'materials' ? 'resource-list' : ''}" aria-label="${kind === 'materials' ? '资料' : kind === 'homeworks' ? '作业' : '通知'}列表">${list.slice(0,state.limit).map(item=>card(item,kind)).join('') || `<div class="empty"><span class="empty-symbol" aria-hidden="true">${filtered ? '⌕' : '—'}</span><strong>${filtered ? '这里暂时没有匹配内容' : '内容正在积累中'}</strong><p>${filtered ? '换一个课程或关键词，或重置筛选。' : '真实内容发布后就会出现在这里，不用反复翻聊天记录。'}</p>${filtered ? '<button id="empty-reset" class="secondary">重置筛选</button>' : ''}</div>`}</section>${list.length > state.limit ? `<button id="load-more" class="load-more">再显示 ${Math.min(24,list.length-state.limit)} 条 · 还有 ${list.length-state.limit} 条</button>` : ''}<p class="inline-meta">${kind === 'homeworks' ? '完成记录只保存在当前设备。' : kind === 'materials' ? '历史资料仅供学习参考，不代表本学期考试范围。PDF 可在浏览器查看；Word / PPT 下载后打开。' : '已读记录只保存在当前设备。'}</p>`
}
export function submissionLink(platform, prominent = false) {
  const target = typeof platform === 'string' && Object.hasOwn(SUBMISSION_PLATFORMS, platform) ? SUBMISSION_PLATFORMS[platform] : null
  if (platform === 'notebook') return '<span class="submission-offline">作业本 · 线下提交</span>'
  return target?.url ? `<a class="${prominent ? 'primary ' : ''}submission-link" href="${target.url}" target="_blank" rel="noopener noreferrer" aria-label="前往${target.label}提交（打开平台网站）">前往提交 · ${target.label} ↗</a>` : ''
}
export function submissionSelect(platform = 'none') {
  return `<label for="submission-platform">提交方式</label><select id="submission-platform" name="submissionPlatform">${Object.entries(SUBMISSION_PLATFORMS).map(([id, target]) => `<option value="${id}" ${platform === id ? 'selected' : ''}>${target.label}</option>`).join('')}</select><p class="hint">在线作业只需选择平台，不用填写具体作业链接。作业本显示线下提交提示；提交时间、地点等要求请写在说明中。</p>`
}
export function materialCard(item) {
  const file = item.attachments[0]
  const type = file?.name.split('.').pop().toUpperCase() || '资料'
  return `<article class="entry resource-entry"><button class="entry-body" data-open="${e(item.id)}"><span class="file-type">${e(type)}</span><div class="resource-copy"><div class="entry-meta"><span>${e(normalizeCourse(item.subject) || '未分类课程')}</span><span>${e(CATEGORIES.materials[item.category])}</span></div><h2>${e(item.title)}</h2><p>${e(item.description || '')}</p><div class="resource-meta">${item.attachments.length} 个文件 · ${e(formatSize(item.attachments.reduce((s,a)=>s+(a.size || 0),0)))}${item.year ? ` · ${e(item.year)} 年资料` : ''}</div></div><span class="resource-arrow" aria-hidden="true">↗</span></button></article>`
}
