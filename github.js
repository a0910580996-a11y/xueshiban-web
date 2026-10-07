import { REPOSITORY } from './config.js'
import { validateContent } from './domain.js?v=20261007-4'

const root = `https://api.github.com/repos/${REPOSITORY.owner}/${REPOSITORY.name}`
export function createPublisher(token, fetcher = fetch) {
  async function request(path, method = 'GET', body) {
    const response = await fetcher(root + path, {
      method,
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    })
    if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'GitHub 授权无效或没有此仓库的写入权限。' : response.status === 422 || response.status === 409 ? '内容已被其他管理员更新，请刷新后重新操作。' : `GitHub 请求失败（${response.status}），请稍后重试。`)
    return response.json()
  }
  return {
    async load() {
      const ref = await request(`/git/ref/heads/${REPOSITORY.branch}`)
      const commit = await request(`/git/commits/${ref.object.sha}`)
      const file = await request(`/contents/content.json?ref=${ref.object.sha}`)
      const bytes = Uint8Array.from(atob(file.content.replace(/\s/g, '')), c => c.charCodeAt(0))
      return { data: validateContent(JSON.parse(new TextDecoder().decode(bytes))), head: ref.object.sha, tree: commit.tree.sha }
    },
    async publish(data, snapshot, files = []) {
      validateContent(data)
      const tree = [{ path: 'content.json', mode: '100644', type: 'blob', content: JSON.stringify(data, null, 2) + '\n' }]
      for (const file of files) {
        const blob = await request('/git/blobs', 'POST', { content: file.base64, encoding: 'base64' })
        tree.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha })
      }
      const nextTree = await request('/git/trees', 'POST', { base_tree: snapshot.tree, tree })
      const commit = await request('/git/commits', 'POST', { message: '更新学事板内容', tree: nextTree.sha, parents: [snapshot.head] })
      await request(`/git/refs/heads/${REPOSITORY.branch}`, 'PATCH', { sha: commit.sha, force: false })
      return { head: commit.sha, tree: nextTree.sha }
    }
  }
}
