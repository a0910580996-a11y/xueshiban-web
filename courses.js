export const CURRENT_COURSES = [
  '数学分析三', '习近平新时代中国特色社会主义思想概论', '习近平总书记关于教育的重要论述',
  '概率论与数理统计', '大学语文', '走在前列的广东实践', '大学英语三', '心理学', '形势与政策',
  '中国近现代史纲要', 'Python语言程序设计'
]
export const OTHER_COURSES = ['常微分方程', '发展与教育心理学', '教育学', '近世代数', '毛泽东思想和中国特色社会主义理论体系概论', '数学建模']
const aliases = { 数分3: '数学分析三', 数学分析III: '数学分析三', 数学分析Ⅲ: '数学分析三', 概率论: '概率论与数理统计', 习概: CURRENT_COURSES[1], 近代史: '中国近现代史纲要', python: 'Python语言程序设计', 毛概: OTHER_COURSES[4] }
const shortNames = {
  [CURRENT_COURSES[1]]: '习概', [CURRENT_COURSES[2]]: '教育重要论述', 概率论与数理统计: '概率论',
  走在前列的广东实践: '广东实践', 中国近现代史纲要: '近代史纲要', Python语言程序设计: 'Python', [OTHER_COURSES[4]]: '毛概'
}
export const TONE_COUNT = 8
export function normalizeCourse(value = '') { return aliases[String(value).trim()] || String(value).trim() }
export function shortCourse(value = '') { const name = normalizeCourse(value); return shortNames[name] || name }
export function courseRank(value = '') {
  const index = [...CURRENT_COURSES, ...OTHER_COURSES].indexOf(normalizeCourse(value))
  return index === -1 ? CURRENT_COURSES.length + OTHER_COURSES.length : index
}
export function courseTone(value = '') {
  const name = normalizeCourse(value)
  const index = [...CURRENT_COURSES, ...OTHER_COURSES].indexOf(name)
  if (index !== -1) return index % TONE_COUNT
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.codePointAt(0)) >>> 0
  return hash % TONE_COUNT
}
export function courseOptions(items = []) { return [...new Set([...CURRENT_COURSES, ...OTHER_COURSES, ...items.map(i => normalizeCourse(i.subject)).filter(Boolean)])] }
export function formatSize(bytes) { return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : bytes ? `${Math.max(1, Math.round(bytes / 1024))} KB` : '大小未提供' }
