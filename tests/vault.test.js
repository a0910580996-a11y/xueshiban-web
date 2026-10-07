import test from 'node:test'
import assert from 'node:assert/strict'

const memory = new Map()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: { getItem: key => memory.has(key) ? memory.get(key) : null, setItem: (key, value) => memory.set(key, String(value)), removeItem: key => memory.delete(key) }
})
const vault = await import('../vault.js')
const { tokenUrl } = await import('../admin.js')
const token = 'github_pat_TESTONLY_' + 'x'.repeat(40)

test('授权加密保存在本机：存储中没有明文，错误密码无法解锁', async () => {
  memory.clear()
  const now = Date.parse('2026-10-07T00:00:00Z')
  await vault.saveVault(token, 'correct-horse', { now })
  const stored = [...memory.values()].join('')
  assert.ok(!stored.includes(token))
  assert.ok(!stored.includes('correct-horse'))
  assert.equal(await vault.unlockWithPassword('correct-horse'), token)
  await assert.rejects(() => vault.unlockWithPassword('wrong-password'), /密码不正确/)
  const info = vault.vaultInfo()
  assert.equal(info.expiresAt, '2027-10-07T00:00:00.000Z')
  assert.equal(vault.daysLeft(info, now), 365)
})

test('修改密码保留原到期时间；清除本机授权后无法再解锁', async () => {
  memory.clear()
  await vault.saveVault(token, 'first-password', { now: Date.parse('2026-01-01T00:00:00Z') })
  const before = vault.vaultInfo()
  await vault.saveVault(token, 'second-password', { createdAt: before.createdAt, expiresAt: before.expiresAt })
  assert.equal(vault.vaultInfo().expiresAt, before.expiresAt)
  await assert.rejects(() => vault.unlockWithPassword('first-password'), /密码不正确/)
  assert.equal(await vault.unlockWithPassword('second-password'), token)
  await vault.forgetDevice()
  assert.equal(vault.vaultInfo(), null)
  await assert.rejects(() => vault.unlockWithPassword('second-password'), /还没有保存授权/)
})

test('不支持本机密钥存储时，保持登录安全降级为输入密码', async () => {
  memory.clear()
  const { remembered } = await vault.saveVault(token, 'correct-horse', { remember: true })
  assert.equal(remembered, false)
  assert.equal(vault.vaultInfo().remembered, false)
  assert.equal(await vault.unlockRemembered(), '')
})

test('GitHub 生成链接预填一年有效期、仓库所有者与内容读写权限', () => {
  const url = new URL(tokenUrl(new Date('2026-10-07T04:00:00Z')))
  assert.equal(url.origin + url.pathname, 'https://github.com/settings/personal-access-tokens/new')
  assert.equal(url.searchParams.get('expires_in'), '365')
  assert.equal(url.searchParams.get('contents'), 'write')
  assert.equal(url.searchParams.get('target_name'), 'a0910580996-a11y')
  assert.equal(url.searchParams.get('name'), '学事板发布 2026-10-07')
})
