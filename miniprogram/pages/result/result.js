// pages/result/result.js
const app = getApp();

Page({
  data: {
    resultId: '',
    mbtiResult: null,
    mbtiReport: null,
    loading: true,
    isFavorite: false,
    isShared: false,
    
    // 维度映射
    dimensionNames: {
      E: '外向', I: '内向',
      S: '感觉', N: '直觉',
      T: '思考', F: '情感',
      J: '判断', P: '感知'
    },
    
    // 置信度等级
    confidenceLevels: [
      { min: 0, max: 30, level: '微弱倾向', color: '#FF6B6B' },
      { min: 31, max: 50, level: '轻度倾向', color: '#FFA500' },
      { min: 51, max: 70, level: '明显倾向', color: '#4CAF50' },
      { min: 71, max: 85, level: '强烈倾向', color: '#2196F3' },
      { min: 86, max: 100, level: '极强倾向', color: '#7B68EE' }
    ]
  },

  onLoad: function (options) {
    const { id, data, testType, timeSpent } = options;
    
    // 优先处理通过data参数传递的完整结果数据
    if (data) {
      try {
        const resultData = JSON.parse(decodeURIComponent(data));
        // 添加测试相关信息
        resultData.test_version = testType || 'simple';
        resultData.test_duration = parseInt(timeSpent) || 0;
        resultData.created_at = new Date().toISOString();
        
        this.setData({
          mbtiResult: resultData,
          loading: false
        });
        this.loadMBTIReport(resultData.mbti_type);
        return;
      } catch (err) {
        console.error('解析结果数据失败:', err);
      }
    }
    
    // 如果有ID，从数据库加载
    if (id) {
      this.setData({ resultId: id });
      this.loadSavedResult(id);
    } else {
      // 如果没有ID和data，显示示例结果
      this.loadSampleResult();
    }
  },

  onShow: function () {
    // 分享功能回调处理
    if (this.data.isShared) {
      this.setData({ isShared: false });
    }
  },

  // 加载保存的测试结果
  loadSavedResult: function (resultId) {
    wx.showLoading({ title: '加载结果...' });
    
    // 先从缓存中查找
    const cachedResult = app.globalData.testResults.find(r => r._id === resultId);
    if (cachedResult) {
      this.setData({
        mbtiResult: cachedResult,
        loading: false
      });
      this.loadMBTIReport(cachedResult.mbti_type);
      wx.hideLoading();
      return;
    }
    
    // 如果缓存中没有，直接通过ID获取单个结果
    wx.cloud.callFunction({
      name: 'mbti-service',
      data: {
        action: 'get_test_result',
        resultId: resultId
      }
    }).then(res => {
      wx.hideLoading();
      
      if (res.result && res.result.success) {
        const result = res.result.data;
        
        if (result) {
          console.log('获取到测试结果:', result);
          this.setData({
            mbtiResult: result,
            loading: false
          });
          this.loadMBTIReport(result.mbti_type);
          
          // 更新全局缓存
          if (!app.globalData.testResults) {
            app.globalData.testResults = [];
          }
          // 避免重复添加
          if (!app.globalData.testResults.find(r => r._id === result._id)) {
            app.globalData.testResults.push(result);
          }
        } else {
          // 如果找不到指定ID的结果，显示错误信息
          wx.showModal({
            title: '结果不存在',
            content: '无法找到指定的测试结果，可能已被删除',
            showCancel: false,
            success: () => {
              wx.navigateBack();
            }
          });
        }
      } else {
        // 处理错误情况
        const errorMsg = res.result && res.result.error ? res.result.error : '无法加载测试结果，请检查网络连接';
        console.error('加载测试结果失败:', errorMsg);
        wx.showModal({
          title: '加载失败',
          content: errorMsg,
          showCancel: false,
          success: () => {
            wx.navigateBack();
          }
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('加载测试结果失败:', err);
      wx.showModal({
        title: '加载失败',
        content: '网络异常，请重试',
        showCancel: false,
        success: () => {
          wx.navigateBack();
        }
      });
    });
  },

  // 加载示例结果（用于演示）
  loadSampleResult: function () {
    const sampleResult = {
      mbti_type: 'INTJ',
      dimension_scores: { E: 2, I: 4, S: 1, N: 5, T: 5, F: 1, J: 4, P: 2 },
      dimension_details: {
        EI: { E: 2, I: 4, winner: 'I' },
        SN: { S: 1, N: 5, winner: 'N' },
        TF: { T: 5, F: 1, winner: 'T' },
        JP: { J: 4, P: 2, winner: 'J' }
      },
      strengths: {
        EI_strength: 67,
        SN_strength: 83,
        TF_strength: 83,
        JP_strength: 67
      },
      confidence: 75,
      test_version: 'simple',
      test_duration: 342,
      created_at: new Date().toISOString()
    };
    
    this.setData({
      mbtiResult: sampleResult,
      loading: false
    });
    this.loadMBTIReport('INTJ');
  },

  // 加载MBTI报告
  loadMBTIReport: function (mbtiType) {
    wx.cloud.callFunction({
      name: 'mbti-service',
      data: {
        action: 'get_report',
        mbti_type: mbtiType
      }
    }).then(res => {
      if (res.result && res.result.success) {
        this.setData({
          mbtiReport: res.result.data
        });
      }
    }).catch(err => {
      console.error('加载MBTI报告失败:', err);
    });
  },

  // 获取置信度等级
  getConfidenceLevel: function (strength) {
    const confidence = Math.round(strength);
    for (const level of this.data.confidenceLevels) {
      if (confidence >= level.min && confidence <= level.max) {
        return level;
      }
    }
    return this.data.confidenceLevels[0]; // 默认返回最低等级
  },

  // 获取维度强度描述
  getStrengthDescription: function (strength) {
    const confidence = Math.round(strength);
    if (confidence >= 80) return '这个维度的特征在你身上表现得非常明显';
    if (confidence >= 60) return '这个维度的特征在你身上比较明显';
    if (confidence >= 40) return '这个维度的特征在你身上有一定的体现';
    if (confidence >= 20) return '这个维度的特征在你身上体现不明显';
    return '这个维度的特征在你身上几乎看不到';
  },

  // 获取维度强度键名
  getStrengthKey: function (dimension) {
    const keyMap = {
      'E': 'EI_strength',
      'I': 'EI_strength',
      'S': 'SN_strength',
      'N': 'SN_strength',
      'T': 'TF_strength',
      'F': 'TF_strength',
      'J': 'JP_strength',
      'P': 'JP_strength'
    };
    return keyMap[dimension] || 'EI_strength';
  },

  // 重新测试
  retakeTest: function () {
    wx.switchTab({
      url: '/pages/index/index'
    });
  },

  // 分享结果
  // 分享给朋友
  onShareAppMessage: function (res) {
    // 分享事件来源：button（页面内分享按钮）、menu（右上角分享按钮）
    if (res.from === 'button') {
      console.log('通过分享按钮分享结果');
    }
    
    if (!this.data.mbtiResult) {
      return {
      title: 'MBTI性格测试 - 发现真实的自己',
      path: '/pages/index/index',
      imageUrl: '/images/share-banner.svg'
    };
    }
    
    const report = this.data.mbtiReport;
    const result = this.data.mbtiResult;
    
    let shareTitle = `我的MBTI性格类型是${result.mbti_type}`;
    if (report && report.metadata) {
      shareTitle += ` - ${report.metadata.nickname}`;
    }
    
    const sharePath = result._id ? `/pages/result/result?id=${result._id}` : '/pages/index/index';
    
    // 标记为已分享
    this.setData({ isShared: true });
    
    return {
      title: shareTitle,
      path: sharePath,
      imageUrl: '/images/share-banner.svg'
    };
  },

  // 分享到朋友圈
  onShareTimeline: function () {
    if (!this.data.mbtiResult) {
      return {
      title: 'MBTI性格测试 - 发现真实的自己',
      imageUrl: '/images/share-banner.svg'
    };
    }
    
    const report = this.data.mbtiReport;
    const result = this.data.mbtiResult;
    
    let shareTitle = `我的MBTI性格类型：${result.mbti_type}`;
    if (report && report.metadata) {
      shareTitle += ` (${report.metadata.nickname})`;
    }
    shareTitle += ' | MBTI性格测试';
    
    return {
      title: shareTitle,
      imageUrl: '/images/share-banner.svg'
    };
  },

  // 收藏结果
  toggleFavorite: function () {
    const isFavorite = !this.data.isFavorite;
    this.setData({ isFavorite });
    
    wx.showToast({
      title: isFavorite ? '已收藏' : '已取消收藏',
      icon: 'success'
    });
    
    // TODO: 这里可以添加实际的收藏逻辑，保存到数据库
  },

  // 查看详细解析
  viewDetailedAnalysis: function () {
    wx.showModal({
      title: '详细解析',
      content: '详细解析功能正在开发中，敬请期待！',
      showCancel: false
    });
  },

  // 生成图片报告
  generateImageReport: function () {
    wx.showModal({
      title: '图片报告',
      content: '图片生成功能正在开发中，敬请期待！',
      showCancel: false
    });
  },

  // 格式化时间显示
  formatTime: function (seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}分${secs}秒`;
  },

  // 格式化日期显示
  formatDate: function (dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 30) return `${diffDays}天前`;
    
    return date.toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
});