// pages/index/index.js
const app = getApp();

Page({
  data: {
    welcomeText: '发现真实的自己',
    subtitle: '专业的MBTI性格测试，深入了解你的内在特质',
    testTypes: [
      {
        id: 'simple',
        title: '快速测试',
        subtitle: '24题 · 约5分钟',
        description: '快速了解你的性格类型，适合首次体验',
        icon: '⚡',
        color: '#7B68EE',
        questions: 24,
        estimatedTime: '5分钟'
      },
      {
        id: 'detailed',
        title: '深度测试',
        subtitle: '93题 · 约18分钟',
        description: '更全面精准的分析，推荐追求深度了解的用户',
        icon: '🔍',
        color: '#9370DB',
        questions: 93,
        estimatedTime: '18分钟'
      }
    ],
    userInfo: null,
    recentTests: [],
    isAdminMode: false,
    adminClickCount: 0,
    adminClickTimer: null
  },

  onLoad: function (options) {
    this.setData({
      userInfo: app.globalData.userInfo
    });
    this.loadRecentTests();
  },

  onShow: function () {
    // 每次显示时更新数据
    if (app.globalData.userInfo) {
      this.setData({
        userInfo: app.globalData.userInfo
      });
    }
    this.loadRecentTests();
  },

  // 加载最近的测试记录
  loadRecentTests: function () {
    const app = getApp();
    if (app.globalData.testResults && app.globalData.testResults.length > 0) {
      // 只显示最近3次测试
      const recentTests = app.globalData.testResults.slice(0, 3);
      this.setData({
        recentTests: recentTests
      });
    }
  },

  // 选择测试类型
  selectTestType: function (e) {
    const testType = e.currentTarget.dataset.type;
    const testData = this.data.testTypes.find(t => t.id === testType);
    
    if (!testData) return;

    // 显示测试说明
    wx.showModal({
      title: `${testData.title}`,
      content: `${testData.description}\n\n${testData.questions}道题目 · 预计${testData.estimatedTime}`,
      confirmText: '开始测试',
      confirmColor: '#7B68EE',
      success: (res) => {
        if (res.confirm) {
          this.startTest(testType);
        }
      }
    });
  },

  // 开始测试
  startTest: function (testType) {
    // 检查用户授权
    this.checkUserAuth(() => {
      // 跳转到测试页面
      wx.navigateTo({
        url: `/pages/test/test?type=${testType}`
      });
    });
  },

  // 检查用户授权
  checkUserAuth: function (callback) {
    const app = getApp();
    
    if (app.globalData.userInfo) {
      callback && callback();
      return;
    }

    // 提示用户需要完善个人信息
    wx.showModal({
      title: '完善个人信息',
      content: '请前往个人中心完善头像和昵称信息',
      confirmText: '去完善',
      cancelText: '暂不',
      success: (res) => {
        if (res.confirm) {
          wx.switchTab({
            url: '/pages/profile/profile'
          });
        } else {
          // 用户选择暂不完善，仍然可以继续使用
          callback && callback();
        }
      }
    });
  },

  // 查看历史记录
  viewHistory: function () {
    wx.navigateTo({
      url: '/pages/profile/profile'
    });
  },

  // 查看测试结果
  viewResult: function (e) {
    const resultId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/result/result?id=${resultId}`
    });
  },

  // 激活管理员模式
  toggleAdminMode: function () {
    let adminClickCount = this.data.adminClickCount + 1;
    this.setData({ adminClickCount });
    
    if (adminClickCount >= 5) {
      this.setData({ 
        isAdminMode: true,
        adminClickCount: 0 
      });
      
      wx.showToast({
        title: '管理员模式已激活',
        icon: 'success',
        duration: 2000
      });
    }
  },

  // 初始化数据库
  initDatabase: function () {
    wx.showModal({
      title: '确认初始化',
      content: '确定要初始化数据库吗？这将创建必要的集合。',
      confirmText: '确定',
      confirmColor: '#7B68EE',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '初始化中...' });
          
          wx.cloud.callFunction({
            name: 'mbti-service',
            data: {
              action: 'init_database',
              data: {
                admin_key: 'mbti_admin_2024'
              }
            }
          }).then(res => {
            wx.hideLoading();
            
            if (res.result && res.result.success) {
              wx.showModal({
                title: '初始化成功',
                content: '数据库初始化完成！',
                showCancel: false
              });
            } else {
              wx.showModal({
                title: '初始化失败',
                content: res.result?.error || '未知错误',
                showCancel: false
              });
            }
          }).catch(err => {
            wx.hideLoading();
            console.error('初始化失败:', err);
            wx.showModal({
              title: '初始化失败',
              content: '网络异常，请检查网络连接',
              showCancel: false
            });
          });
        }
      }
    });
  },

  // 导入数据
  importData: function () {
    wx.showModal({
      title: '确认导入',
      content: '确定要导入MBTI数据吗？这将导入题目和报告数据。',
      confirmText: '确定',
      confirmColor: '#7B68EE',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '导入中...' });
          
          wx.cloud.callFunction({
            name: 'mbti-service',
            data: {
              action: 'import_data',
              data: {
                admin_key: 'mbti_admin_2024'
              }
            }
          }).then(res => {
            wx.hideLoading();
            
            if (res.result && res.result.success) {
              const stats = res.result.stats;
              wx.showModal({
                title: '导入成功',
                content: `24题：${stats.questions24}条\n93题：${stats.questions93}条\n报告：${stats.reports}条`,
                showCancel: false
              });
            } else {
              wx.showModal({
                title: '导入失败',
                content: res.result?.error || '未知错误',
                showCancel: false
              });
            }
          }).catch(err => {
            wx.hideLoading();
            console.error('导入失败:', err);
            wx.showModal({
              title: '导入失败',
              content: '网络异常，请检查网络连接',
              showCancel: false
            });
          });
        }
      }
    });
  },

  // 快速导入（用于测试）
  quickImport: function () {
    wx.showModal({
      title: '确认快速导入',
      content: '确定要导入测试数据吗？这将导入6道题目和2个报告。',
      confirmText: '确定',
      confirmColor: '#9370DB',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '快速导入中...' });
          
          wx.cloud.callFunction({
            name: 'mbti-service',
            data: {
              action: 'quick_import',
              data: {
                admin_key: 'mbti_admin_2024'
              }
            }
          }).then(res => {
            wx.hideLoading();
            
            if (res.result && res.result.success) {
              const stats = res.result.stats;
              wx.showModal({
                title: '快速导入成功',
                content: `题目：${stats.questions}条\n报告：${stats.reports}条`,
                showCancel: false
              });
            } else {
              wx.showModal({
                title: '快速导入失败',
                content: res.result?.error || '未知错误',
                showCancel: false
              });
            }
          }).catch(err => {
            wx.hideLoading();
            console.error('快速导入失败:', err);
            wx.showModal({
              title: '快速导入失败',
              content: '网络异常，请检查网络连接',
              showCancel: false
            });
          });
        }
      }
    });
  },

  // 连续点击进入管理员模式
  onWelcomeTextTap: function() {
    this.data.adminClickCount++;
    
    // 清除之前的定时器
    if (this.data.adminClickTimer) {
      clearTimeout(this.data.adminClickTimer);
    }
    
    // 设置新的定时器，2秒后重置计数
    this.data.adminClickTimer = setTimeout(() => {
      this.data.adminClickCount = 0;
    }, 2000);
    
    console.log('点击次数:', this.data.adminClickCount);
    
    if (this.data.adminClickCount >= 5) {
      // 连续点击5次，进入管理员模式
      wx.navigateTo({
        url: '/pages/admin/admin'
      });
      
      // 重置计数
      this.data.adminClickCount = 0;
      if (this.data.adminClickTimer) {
        clearTimeout(this.data.adminClickTimer);
        this.data.adminClickTimer = null;
      }
      
      wx.showToast({
        title: '进入管理员模式',
        icon: 'success'
      });
    } else if (this.data.adminClickCount >= 3) {
      // 给用户提示
      wx.showToast({
        title: `再点击${5 - this.data.adminClickCount}次`,
        icon: 'none',
        duration: 1000
      });
    }
  },

  // 分享功能
  // 分享给朋友
  onShareAppMessage: function (res) {
    // 分享事件来源：button（页面内分享按钮）、menu（右上角分享按钮）
    if (res.from === 'button') {
      console.log('通过分享按钮分享');
    }
    
    return {
      title: 'MBTI性格测试 - 发现真实的自己',
      path: '/pages/index/index',
      imageUrl: '/images/share-banner.svg'
    };
  },

  // 分享到朋友圈
  onShareTimeline: function () {
    return {
      title: 'MBTI性格测试 - 发现真实的自己',
      imageUrl: '/images/share-banner.svg'
    };
  },

  onUnload: function() {
    // 页面卸载时清除定时器
    if (this.data.adminClickTimer) {
      clearTimeout(this.data.adminClickTimer);
    }
  }
});