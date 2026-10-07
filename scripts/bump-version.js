// Stamps one cache-busting token (YYYYMMDD-N, Shanghai date) across index.html and every root module.
// GitHub Pages caches files for minutes; a single shared token keeps old and new modules from mixing.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const files = ['index.html', ...readdirSync(root).filter(name => name.endsWith('.js') && name !== 'serve.js')]
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' }).replaceAll('-', '')
const sameDay = [...readFileSync(root + 'index.html', 'utf8').matchAll(/\?v=(\d{8})-(\d+)/g)].filter(([, date]) => date === today).map(([, , n]) => Number(n))
const token = `${today}-${sameDay.length ? Math.max(...sameDay) + 1 : 1}`
for (const name of files) {
  const text = readFileSync(root + name, 'utf8')
  const next = text.replace(/\?v=[\w-]+/g, `?v=${token}`)
  if (next !== text) writeFileSync(root + name, next)
}
console.log(`版本号已更新为 ${token}`)
