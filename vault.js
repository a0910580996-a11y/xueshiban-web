// Keeps the admin's GitHub token on this device, encrypted. Password unlock derives an AES-GCM key with PBKDF2;
// "stay signed in" seals the token with a non-extractable AES key kept in IndexedDB, so the raw key never touches storage.
const VAULT = 'xueshiban:admin-vault'
const REMEMBER = 'xueshiban:admin-remember'
const ITERATIONS = 600000
const DAY = 86400000
export const TOKEN_DAYS = 365

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const toBase64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)))
const fromBase64 = text => Uint8Array.from(atob(text), char => char.charCodeAt(0))
const readJSON = key => { try { return JSON.parse(localStorage.getItem(key)) } catch { return null } }

async function passwordKey(password, salt, iterations) {
  const base = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}
async function seal(key, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  return { iv: toBase64(iv), data: toBase64(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(text))) }
}
async function unseal(key, box) {
  return decoder.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(box.iv) }, key, fromBase64(box.data)))
}
function keyStore(mode, run) {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('indexedDB unavailable')); return }
    const opening = indexedDB.open('xueshiban', 1)
    opening.onupgradeneeded = () => opening.result.createObjectStore('keys')
    opening.onerror = () => reject(opening.error)
    opening.onsuccess = () => {
      const db = opening.result
      const tx = db.transaction('keys', mode)
      const request = run(tx.objectStore('keys'))
      tx.oncomplete = () => { db.close(); resolve(request.result) }
      tx.onerror = tx.onabort = () => { db.close(); reject(tx.error) }
    }
  })
}

export function vaultInfo() {
  const vault = readJSON(VAULT)
  if (vault?.version !== 1) return null
  return { createdAt: vault.createdAt, expiresAt: vault.expiresAt, remembered: Boolean(readJSON(REMEMBER)) }
}

export async function saveVault(token, password, { remember = false, now = Date.now(), createdAt, expiresAt } = {}) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const record = {
    version: 1, iterations: ITERATIONS, salt: toBase64(salt),
    createdAt: createdAt || new Date(now).toISOString(),
    expiresAt: expiresAt || new Date(now + TOKEN_DAYS * DAY).toISOString(),
    ...(await seal(await passwordKey(password, salt, ITERATIONS), token))
  }
  localStorage.setItem(VAULT, JSON.stringify(record))
  return { remembered: await setRemember(token, remember, record.expiresAt) }
}

export async function unlockWithPassword(password) {
  const vault = readJSON(VAULT)
  if (vault?.version !== 1) throw new Error('这台设备还没有保存授权。')
  try { return await unseal(await passwordKey(password, fromBase64(vault.salt), vault.iterations), vault) } catch { throw new Error('密码不正确，请重试。') }
}

export async function setRemember(token, remember, until) {
  localStorage.removeItem(REMEMBER)
  if (!remember) { await keyStore('readwrite', store => store.delete('device')).catch(() => {}); return false }
  try {
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
    await keyStore('readwrite', store => store.put(key, 'device'))
    localStorage.setItem(REMEMBER, JSON.stringify({ until, ...(await seal(key, token)) }))
    return true
  } catch { return false }
}

export async function unlockRemembered(now = Date.now()) {
  const remembered = readJSON(REMEMBER)
  if (!remembered) return ''
  if (!(Date.parse(remembered.until) > now)) { await setRemember('', false); return '' }
  try {
    const key = await keyStore('readonly', store => store.get('device'))
    return key ? await unseal(key, remembered) : ''
  } catch { return '' }
}

export async function forgetDevice() {
  localStorage.removeItem(VAULT)
  await setRemember('', false)
}

export function daysLeft(info, now = Date.now()) {
  return info?.expiresAt ? Math.ceil((Date.parse(info.expiresAt) - now) / DAY) : null
}
