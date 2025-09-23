// pages/index/index.js 的测试函数
// 添加到页面文件的末尾，在 shareApp 函数之后

// 添加到 data 对象中
data: {
  // ... 其他数据
  testResult: ''
},

// 添加测试函数
testCloudFunction: function() {
  console.log('开始测试云函数连接...')
  
  wx.showLoading({ title: '测试中...' })
  
  // 测试1：基本云函数连接
  wx.cloud.callFunction({
    name: 'mbti-service',
    data: {
      action: 'get_user_info'
    }
  }).then(res => {
    console.log('测试1 - 用户信息获取成功:', res)
    this.setData({ testResult: '✅ 用户信息获取成功' })
    
    // 测试2：数据库初始化
    return wx.cloud.callFunction({
      name: 'mbti-service',
      data: {
        action: 'init_database',
        admin_key: 'mbti_admin_2024'
      }
    })
  }).then(res => {
    console.log('测试2 - 数据库初始化成功:', res)
    this.setData({ testResult: this.data.testResult + '\n✅ 数据库初始化成功' })
    
    wx.hideLoading()
    wx.showModal({
      title: '测试成功',
      content: '云函数连接正常，可以继续使用',
      showCancel: false
    })
  }).catch(err => {
    console.error('云函数测试失败:', err)
    wx.hideLoading()
    
    let errorMsg = '未知错误'
    if (err.errCode === -501007) {
      errorMsg = '云函数未部署或权限问题'
    } else if (err.errCode === -504002) {
      errorMsg = '云函数不存在'
    } else if (err.errCode === -501000) {
      errorMsg = '网络超时'
    } else if (err.errCode) {
      errorMsg = `错误代码: ${err.errCode}`
    }
    
    this.setData({ testResult: `❌ 测试失败: ${errorMsg}` })
    
    wx.showModal({
      title: '测试失败',
      content: `错误: ${errorMsg}\n\n请检查云函数部署和网络连接`,
      confirmText: '重试',
      cancelText: '取消'
    })
  })
}

// 在wxml中添加测试按钮（临时使用）
// 在 admin-section 中添加
<button class="btn-admin" bindtap="testCloudFunction">测试云函数</button>