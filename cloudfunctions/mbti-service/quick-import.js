// 快速测试数据导入脚本 - 只导入少量数据避免超时
const fs = require('fs')
const path = require('path')

// 数据目录
const DATA_DIR = path.resolve(__dirname, '../../data_yangben')

// 读取少量24题数据用于测试
function loadTestQuestions() {
  const jsonPath = path.join(DATA_DIR, '24questions.json')
  if (fs.existsSync(jsonPath)) {
    const content = fs.readFileSync(jsonPath, 'utf8')
    const json = JSON.parse(content)
    // 只取前6题进行测试
    return json.questions.slice(0, 6).map(q => ({
      question_id: q.question_id,
      question_text: q.question_text,
      option_a: { text: q.options[0].text, dimension: q.options[0].dimension, score: q.options[0].weight || 1 },
      option_b: { text: q.options[1].text, dimension: q.options[1].dimension, score: q.options[1].weight || 1 },
      dimension_group: q.dimension_group,
      version: 'simple'
    }))
  }
  return []
}

// 创建简化的MBTI报告（只创建2个类型）
function loadTestReports() {
  return [
    {
      mbti_type: 'INTJ',
      metadata: {
        nickname: '战略家',
        title: '战略思考者',
        category: '理性者联盟'
      },
      personality_profile: {
        description: 'INTJ是富有想象力和战略思维的性格类型，善于分析和规划。',
        psychological_analysis: 'INTJ属于直觉-思考型人格，擅长抽象思维和系统分析。',
        imagery: '像一位运筹帷幄的将军🎯'
      },
      superpowers: [
        { ability: '战略思维', description: '擅长制定长期计划和策略' },
        { ability: '独立思考', description: '能够独立分析和解决问题' }
      ],
      characteristics: {
        catchphrases: ['从长远考虑', '这需要计划'],
        habits: ['制定详细计划', '独立工作'],
        social_style: '选择性社交',
        relationship_style: '深度连接'
      },
      career_profile: {
        suitable_roles: [
          { category: '管理类', positions: ['项目经理', '战略顾问'] },
          { category: '技术类', positions: ['系统架构师', '数据分析师'] }
        ],
        motto: '计划先行，执行在后'
      },
      love_guide: {
        ideal_partner: '同样独立思考、有深度的伴侣',
        relationship_mode: '深度交流，重视智力连接',
        confession_style: '理性表达，注重事实'
      },
      personality_group: '理性者联盟'
    },
    {
      mbti_type: 'ENFP',
      metadata: {
        nickname: '激励者',
        title: '热情创造者',
        category: '理想家联盟'
      },
      personality_profile: {
        description: 'ENFP是热情、富有创造力的性格类型，喜欢帮助他人成长。',
        psychological_analysis: 'ENFP属于直觉-情感型人格，重视人际关系和可能性。',
        imagery: '像一位充满激情的艺术家🎨'
      },
      superpowers: [
        { ability: '热情感染', description: '能够激励和鼓舞他人' },
        { ability: '创意思维', description: '善于产生新想法和解决方案' }
      ],
      characteristics: {
        catchphrases: ['想想可能性', '这很有趣'],
        habits: ['尝试新事物', '帮助他人'],
        social_style: '广泛社交',
        relationship_style: '温暖连接'
      },
      career_profile: {
        suitable_roles: [
          { category: '创意类', positions: ['创意总监', '内容创作者'] },
          { category: '教育类', positions: ['教师', '培训师'] }
        ],
        motto: '激发潜能，创造美好'
      },
      love_guide: {
        ideal_partner: '充满热情、理解支持的人',
        relationship_mode: '情感丰富，共同成长',
        confession_style: '真诚表达，注重感受'
      },
      personality_group: '理想家联盟'
    }
  ]
}

// 快速导入函数
async function quickImport() {
  const cloud = require('wx-server-sdk')
  cloud.init({
    env: cloud.DYNAMIC_CURRENT_ENV,
  })
  
  const db = cloud.database()
  
  try {
    console.log('开始快速测试导入...')
    
    // 检查并创建集合
    const collections = ['questions', 'reports', 'user_results']
    for (const collectionName of collections) {
      try {
        await db.createCollection(collectionName)
        console.log(`创建集合: ${collectionName}`)
      } catch (err) {
        if (err.errCode === -1) {
          console.log(`集合已存在: ${collectionName}`)
        }
      }
    }
    
    // 导入少量测试题目
    const questionsCollection = db.collection('questions')
    const testQuestions = loadTestQuestions()
    
    console.log(`导入${testQuestions.length}道测试题目...`)
    for (const question of testQuestions) {
      await questionsCollection.add({
        data: {
          ...question,
          created_at: new Date()
        }
      })
    }
    
    // 导入测试报告
    const reportsCollection = db.collection('reports')
    const testReports = loadTestReports()
    
    console.log(`导入${testReports.length}个测试报告...`)
    for (const report of testReports) {
      await reportsCollection.add({
        data: {
          ...report,
          created_at: new Date(),
          updated_at: new Date()
        }
      })
    }
    
    console.log('🎉 快速测试导入完成！')
    
    return {
      success: true,
      message: '快速测试导入完成',
      stats: {
        questions: testQuestions.length,
        reports: testReports.length
      }
    }
    
  } catch (error) {
    console.error('快速导入失败:', error)
    return {
      success: false,
      error: error.message || '导入失败'
    }
  }
}

// 导出函数
module.exports = {
  loadTestQuestions,
  loadTestReports,
  quickImport
}

// 如果直接运行此脚本
if (require.main === module) {
  console.log('开始快速测试导入...')
  
  quickImport()
    .then((result) => {
      if (result.success) {
        console.log('✅ 快速测试导入成功！')
        console.log('📊 导入统计:', result.stats)
      } else {
        console.log('❌ 快速测试导入失败:', result.error)
      }
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ 快速测试导入异常:', error)
      process.exit(1)
    })
}