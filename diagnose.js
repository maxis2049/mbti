// MBTI云函数诊断工具
// 使用方法：在微信开发者工具Console中运行此代码

function diagnoseMBTICloudFunction() {
  console.log('=====================================')
  console.log('MBTI云函数诊断工具')
  console.log('=====================================')
  
  // 1. 检查云开发初始化
  console.log('1. 检查云开发初始化...')
  try {
    if (!wx.cloud) {
      console.error('❌ wx.cloud未定义，请检查基础库版本')
      return
    }
    
    const env = getApp().globalData.env
    console.log('✅ 环境ID:', env)
    
    // 2. 测试云函数连接
    console.log('\n2. 测试云函数连接...')
    wx.cloud.callFunction({
      name: 'mbti-service',
      data: {
        action: 'get_user_info'
      }
    }).then(res => {
      console.log('✅ 云函数连接成功')
      console.log('响应结果:', res.result)
      
      // 3. 测试数据库初始化
      console.log('\n3. 测试数据库初始化...')
      return wx.cloud.callFunction({
        name: 'mbti-service',
        data: {
          action: 'init_database',
          admin_key: 'mbti_admin_2024'
        }
      })
    }).then(res => {
      console.log('✅ 数据库初始化成功')
      console.log('响应结果:', res.result)
      
      // 4. 测试数据导入
      console.log('\n4. 测试数据导入...')
      return wx.cloud.callFunction({
        name: 'mbti-service',
        data: {
          action: 'import_data',
          admin_key: 'mbti_admin_2024'
        }
      })
    }).then(res => {
      console.log('✅ 数据导入成功')
      console.log('响应结果:', res.result)
      console.log('\n🎉 所有测试通过！')
    }).catch(err => {
      console.error('❌ 测试失败:', err)
      
      // 详细错误分析
      if (err.errCode === -501007) {
        console.error('错误类型: 权限配置问题')
        console.error('解决方案: 检查云开发环境ID和安全配置')
      } else if (err.errCode === -504002) {
        console.error('错误类型: 云函数不存在')
        console.error('解决方案: 重新部署云函数')
      } else if (err.errCode === -501000) {
        console.error('错误类型: 网络超时')
        console.error('解决方案: 检查网络连接')
      } else {
        console.error('错误类型: 未知错误')
        console.error('错误代码:', err.errCode)
        console.error('错误信息:', err.errMsg)
      }
    })
    
  } catch (err) {
    console.error('❌ 诊断失败:', err)
  }
}

// 在Console中运行: diagnoseMBTICloudFunction()