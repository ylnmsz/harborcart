import { reactive } from 'vue'
// Bearer credentials stay in memory; refreshing signs the demo user out.
export const session = reactive({ token: '', user: null })
export async function api(path, options = {}) {
  const response = await fetch('/api' + path, { ...options, headers: { 'Content-Type': 'application/json', ...(session.token ? { Authorization: 'Bearer ' + session.token } : {}), ...options.headers } })
  const text = await response.text()
  let data
  try { data = text ? JSON.parse(text) : null } catch { throw new Error('服务返回了无法识别的数据，请检查后端是否已启动') }
  if (!response.ok) {
    if (response.status === 401) { session.token = ''; session.user = null }
    throw new Error(data?.message || '请求失败，请稍后重试')
  }
  return data
}
export const send = (method, body) => ({ method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
export const money = (amount, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(amount || 0))
