# MBTI小程序数据库部署指南

## 🚀 快速开始

### 1. 云开发环境配置
1. 在微信开发者工具中打开项目
2. 点击工具栏"云开发"按钮
3. 创建云开发环境，记录环境ID
4. 在 `miniprogram/app.js` 中更新环境ID：
```javascript
env: "your-env-id" // 替换为你的云开发环境ID
```

### 2. 部署云函数
1. 右键点击 `cloudfunctions/mbti-service` 文件夹
2. 选择"上传并部署：云端安装依赖"
3. 等待部署完成

### 3. 初始化数据库
调用云函数初始化数据库：

```javascript
// 在小程序中调用（临时方式，可在首页添加按钮）
wx.cloud.callFunction({
  name: 'mbti-service',
  data: {
    action: 'init_database',
    admin_key: 'mbti_admin_2024'
  }
}).then(res => {
  console.log('数据库初始化结果:', res.result)
}).catch(err => {
  console.error('初始化失败:', err)
})
```

## 📊 数据库结构设计

### questions 集合
存储24题和93题版本的所有题目

```javascript
{
  _id: "auto_id",
  question_id: Number,
  question_text: String,
  option_a: {
    text: String,
    dimension: String, // "E", "I", "S", "N", "T", "F", "J", "P"
    score: Number
  },
  option_b: {
    text: String,
    dimension: String,
    score: Number
  },
  dimension_group: String, // "EI", "SN", "TF", "JP"
  version: String, // "simple", "detailed"
  created_at: Date
}
```

### reports 集合
存储16种MBTI人格类型的详细解读报告

```javascript
{
  _id: "auto_id",
  mbti_type: String, // "ISTJ", "ISFJ", ...
  metadata: {
    nickname: String, // "靠谱小能手"
    title: String, // "守护者 🛡️"
    category: String // "内向型人格"
  },
  personality_profile: {
    description: String,
    psychological_analysis: String,
    imagery: String
  },
  superpowers: [
    {
      ability: String,
      description: String
    }
  ],
  characteristics: {
    catchphrases: [String],
    habits: [String],
    social_style: String,
    relationship_style: String
  },
  career_profile: {
    suitable_roles: [
      {
        category: String,
        positions: [String],
        description: String
      }
    ],
    motto: String
  },
  love_guide: {
    ideal_partner: String,
    relationship_mode: String,
    confession_style: String
  },
  personality_group: String,
  created_at: Date,
  updated_at: Date
}
```

### user_results 集合
存储用户的测试结果记录

```javascript
{
  _id: "auto_id",
  user_id: String, // 用户openid
  mbti_type: String, // 测试结果
  test_version: String, // "simple", "detailed"
  dimension_scores: {
    E: Number, I: Number, S: Number, N: Number,
    T: Number, F: Number, J: Number, P: Number
  },
  dimension_details: {
    EI: { E: Number, I: Number, winner: String },
    SN: { S: Number, N: Number, winner: String },
    TF: { T: Number, F: Number, winner: String },
    JP: { J: Number, P: Number, winner: String }
  },
  detailed_analysis: { // 仅93题版本
    EI_score: Number,
    SN_score: Number,
    TF_score: Number,
    JP_score: Number
  },
  total_questions: Number,
  answered_questions: Number,
  test_duration: Number, // 测试时长（秒）
  session_id: String,
  created_at: Date,
  is_shared: Boolean,
  is_favorite: Boolean
}
```

## 🔧 数据导入脚本

### 运行数据导入
1. 在云函数目录下安装依赖：
```bash
cd cloudfunctions/mbti-service
npm install fs
```

2. 运行数据导入脚本：
```bash
node data-import.js
```

3. 验证数据导入结果：
```javascript
// 在小程序中验证题目数据
wx.cloud.callFunction({
  name: 'mbti-service',
  data: {
    action: 'get_questions',
    version: 'simple'
  }
}).then(res => {
  console.log('24题题目数量:', res.result.total)
})

wx.cloud.callFunction({
  name: 'mbti-service',
  data: {
    action: 'get_questions',
    version: 'detailed'
  }
}).then(res => {
  console.log('93题题目数量:', res.result.total)
})

wx.cloud.callFunction({
  name: 'mbti-service',
  data: {
    action: 'get_report',
    mbti_type: 'ISTJ'
  }
}).then(res => {
  console.log('ISTJ报告:', res.result.success ? '存在' : '不存在')
})
```

## ✅ 验证清单

- [ ] 云开发环境配置完成
- [ ] mbti-service云函数部署成功
- [ ] 数据库集合创建成功
- [ ] 24题题目数据导入成功（24条）
- [ ] 93题题目数据导入成功（93条）
- [ ] MBTI报告数据导入成功（16条）
- [ ] 数据库查询功能正常

## 🎯 下一步

数据库初始化完成后，可以开始：
1. 第三阶段：24题版本核心功能开发
2. 创建测试页面和结果展示页面
3. 实现用户交互和数据流转

## ⚠️ 注意事项

1. **环境ID替换**：确保在app.js中使用了正确的云开发环境ID
2. **权限设置**：确保云开发环境有足够的读写权限
3. **数据验证**：导入后验证数据完整性和正确性
4. **错误处理**：在小程序中添加适当的错误处理逻辑
5. **性能优化**：对于大量数据查询，考虑添加索引和分页