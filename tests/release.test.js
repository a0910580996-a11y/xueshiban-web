import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { ICON_NAMES } from '../icons.js'

const root = fileURLToPath(new URL('../', import.meta.url))
const read = name => readFileSync(root + name, 'utf8')
const modules = readdirSync(root).filter(name => name.endsWith('.js') && name !== 'serve.js')

test('所有静态资源使用同一个缓存版本号，避免新旧模块混用', () => {
  const tokens = new Set()
  for (const name of ['index.html', ...modules]) for (const [, token] of read(name).matchAll(/\?v=([\w-]+)/g)) tokens.add(token)
  assert.equal(tokens.size, 1, `发现多个版本号：${[...tokens].join(', ')}。请运行 npm run version:bump`)
})

test('页面、模块与样式引用的本地文件都存在', () => {
  const refs = [...read('index.html').matchAll(/(?:href|src)="\.\/([^"?#]+)/g)].map(m => m[1])
  for (const name of modules) refs.push(...[...read(name).matchAll(/from '\.\/([^'?]+)/g)].map(m => m[1]))
  refs.push(...[...read('styles.css').matchAll(/url\("\.\/([^"]+)"\)/g)].map(m => m[1]))
  assert.ok(refs.length > 10)
  for (const ref of refs) assert.ok(existsSync(root + ref), `缺少文件：${ref}`)
})

test('深色主题的两处令牌保持一致', () => {
  const css = read('styles.css')
  const tokens = selector => {
    const start = css.indexOf(`${selector} {`)
    assert.notEqual(start, -1, `缺少 ${selector}`)
    return Object.fromEntries([...css.slice(start, css.indexOf('}', start)).matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]))
  }
  const manual = tokens(':root[data-theme="dark"]')
  assert.ok(Object.keys(manual).length > 20)
  assert.deepEqual(tokens(':root:not([data-theme="light"])'), manual)
})

test('CSP 不放宽，页面不含内联脚本、内联样式或未定义图标', () => {
  const html = read('index.html')
  const csp = html.match(/Content-Security-Policy" content="([^"]+)"/)[1]
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/)
  assert.match(csp, /script-src 'self'/)
  assert.doesNotMatch(html, /<script(?![^>]*\ssrc=)[^>]*>/)
  assert.doesNotMatch(html, /\sstyle=/)
  for (const [, name] of html.matchAll(/data-icon="([\w-]+)"/g)) assert.ok(ICON_NAMES.includes(name), `未定义的图标：${name}`)
})
