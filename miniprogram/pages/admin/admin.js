// pages/admin/admin.js
Page({
  data: {
    updateStatus: '',
    isUpdating: false
  },

  onLoad: function (options) {
    console.log('管理页面加载');
  },

  // 更新24题数据库
  updateDatabase: function() {
    const that = this;
    
    that.setData({
      updateStatus: '正在更新数据库...',
      isUpdating: true
    });

    wx.cloud.callFunction({
      name: 'mbti-service',
      data: {
        action: 'update_questions_database',
        admin_key: 'mbti_admin_2024'
      },
      success: function(res) {
        console.log('数据库更新结果:', res.result);
        
        if (res.result.success) {
          const details = res.result.details;
          that.setData({
            updateStatus: `✅ 更新成功！\n删除旧数据: ${details.deleted_count} 条\n插入新数据: ${details.inserted_count} 条\n\n题目分组验证:\nEI维度: ${details.group_distribution.EI || 0} 题\nSN维度: ${details.group_distribution.SN || 0} 题\nTF维度: ${details.group_distribution.TF || 0} 题\nJP维度: ${details.group_distribution.JP || 0} 题`,
            isUpdating: false
          });
          
          wx.showToast({
            title: '数据库更新成功',
            icon: 'success',
            duration: 2000
          });
        } else {
          that.setData({
            updateStatus: `❌ 更新失败: ${res.result.error}`,
            isUpdating: false
          });
          
          wx.showToast({
            title: '更新失败',
            icon: 'error',
            duration: 2000
          });
        }
      },
      fail: function(err) {
        console.error('调用云函数失败:', err);
        that.setData({
          updateStatus: `❌ 调用失败: ${err.errMsg}`,
          isUpdating: false
        });
        
        wx.showToast({
          title: '调用失败',
          icon: 'error',
          duration: 2000
        });
      }
    });
  },

  // 测试24题功能
  testQuestions: function() {
    wx.navigateTo({
      url: '/pages/test24/test24'
    });
  },

  // 返回首页
  goHome: function() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  }
});