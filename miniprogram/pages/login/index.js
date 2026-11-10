const { request } = require('../../utils/api')

Page({
  data: { registering: false, email: '', password: '', name: '', busy: false, error: '' },
  input(event) { this.setData({ [event.currentTarget.dataset.field]: event.detail.value }) },
  toggle() { this.setData({ registering: !this.data.registering, error: '' }) },
  async submit() {
    if (this.data.busy) return
    const email = this.data.email.trim()
    const { password, registering } = this.data
    const name = this.data.name.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { this.setData({ error: '请输入有效邮箱' }); return }
    if (!password || (registering && password.length < 8)) { this.setData({ error: '请输入密码，注册密码至少 8 位' }); return }
    if (registering && !name) { this.setData({ error: '请输入昵称' }); return }
    this.setData({ busy: true, error: '' })
    try {
      const session = await request(registering ? '/auth/register' : '/auth/login', 'POST', { email, password, ...(registering ? { name } : {}) })
      getApp().setSession(session)
      this.setData({ password: '' })
      wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/profile/index' }) })
    } catch (error) { this.setData({ error: error.message }) }
    finally { this.setData({ busy: false }) }
  }
})
