
// 数据导入脚本 - 将题目数据导入数据库
const fs = require('fs')
const path = require('path')

// 通过环境变量传入环境ID（本地执行用）
const ENV_ID = process.env.WX_ENV || process.env.ENV_ID || process.env.npm_config_env

// 数据目录：优先使用项目根的 data_yangben 目录
const DATA_DIR = path.resolve(__dirname, '../../data_yangben')

// 读取24题数据
function load24Questions() {
  // 优先读取 JSON 文件
  const jsonPath = path.join(DATA_DIR, '24questions.json')
  if (fs.existsSync(jsonPath)) {
    const content = fs.readFileSync(jsonPath, 'utf8')
    const json = JSON.parse(content)
    return json.questions.map(q => ({
      question_id: q.question_id,
      question_text: q.question_text,
      option_a: { text: q.options[0].text, dimension: q.options[0].dimension, score: q.options[0].weight || 1 },
      option_b: { text: q.options[1].text, dimension: q.options[1].dimension, score: q.options[1].weight || 1 },
      dimension_group: q.dimension_group,
      version: 'simple'
    }))
  }

  const content = fs.readFileSync(path.join(__dirname, '24quesiton.md'), 'utf8')
  
  // 解析24题数据（基于实际文件格式）
  const lines = content.split('\n')
  const questions = []
  let questionId = 1
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    
    // 匹配题目格式：1. 在聚会或社交场合中，你通常： A. 主动和很多人交谈，感到精力充沛 B. 更喜欢和少数几个人深入交流
    if (line.match(/^(\d+)\./)) {
      // 提取题目编号和内容
      const parts = line.split(/\s+A\.\s+/)
      if (parts.length >= 2) {
        const questionPart = parts[0] // 例如: "1. 在聚会或社交场合中，你通常："
        const optionsPart = parts[1] // 例如: "主动和很多人交谈，感到精力充沛 B. 更喜欢和少数几个人深入交流"
        
        // 提取题目文本
        const questionText = questionPart.replace(/^(\d+)\.\s*/, '').trim()
        
        // 分离A和B选项
        const options = optionsPart.split(/\s+B\.\s+/)
        if (options.length >= 2) {
          const optionAText = options[0].trim()
          const optionBText = options[1].trim()
          
          // 根据题目位置确定维度分组
          let dimensionGroup = ''
          if (questionId >= 1 && questionId <= 6) {
            dimensionGroup = 'EI'
          } else if (questionId >= 7 && questionId <= 12) {
            dimensionGroup = 'SN'
          } else if (questionId >= 13 && questionId <= 18) {
            dimensionGroup = 'TF'
          } else if (questionId >= 19 && questionId <= 24) {
            dimensionGroup = 'JP'
          }
          
          const question = {
            question_id: questionId,
            question_text: questionText,
            option_a: { text: optionAText, dimension: '', score: 1 },
            option_b: { text: optionBText, dimension: '', score: 1 },
            dimension_group: dimensionGroup,
            version: 'simple'
          }
          
          // 根据题目位置设置维度
          setDimensionsForQuestion(question, questionId)
          
          questions.push(question)
          questionId++
        }
      }
    }
  }
  
  return questions
}

// 根据题目位置设置维度
function setDimensionsForQuestion(question, questionId) {
  if (questionId >= 1 && questionId <= 6) {
    // E vs I 组
    if (questionId % 2 === 1) {
      question.option_a.dimension = 'E'
      question.option_b.dimension = 'I'
    } else {
      question.option_a.dimension = 'I'
      question.option_b.dimension = 'E'
    }
  } else if (questionId >= 7 && questionId <= 12) {
    // S vs N 组
    if (questionId % 2 === 1) {
      question.option_a.dimension = 'S'
      question.option_b.dimension = 'N'
    } else {
      question.option_a.dimension = 'N'
      question.option_b.dimension = 'S'
    }
  } else if (questionId >= 13 && questionId <= 18) {
    // T vs F 组
    if (questionId % 2 === 1) {
      question.option_a.dimension = 'T'
      question.option_b.dimension = 'F'
    } else {
      question.option_a.dimension = 'F'
      question.option_b.dimension = 'T'
    }
  } else if (questionId >= 19 && questionId <= 24) {
    // J vs P 组
    if (questionId % 2 === 1) {
      question.option_a.dimension = 'J'
      question.option_b.dimension = 'P'
    } else {
      question.option_a.dimension = 'P'
      question.option_b.dimension = 'J'
    }
  }
}

// 读取93题数据
function load93Questions() {
  // 优先读取 JSON 文件
  const jsonPath = path.join(DATA_DIR, '93questions.json')
  if (fs.existsSync(jsonPath)) {
    const content = fs.readFileSync(jsonPath, 'utf8')
    const json = JSON.parse(content)
    return json.questions.map(q => ({
      question_id: q.question_id,
      question_text: q.question_text,
      options: q.options,
      dimension_group: q.dimension_group,
      version: 'detailed'
    }))
  }

  const content = fs.readFileSync(path.join(__dirname, '93question.md'), 'utf8')
  const jsonData = JSON.parse(content)
  return jsonData.questions.map(q => ({
    question_id: q.id,
    question_text: q.text,
    options: q.options,
    version: 'detailed'
  }))
}

// 读取MBTI报告数据
function loadMBTIReports() {
  // 优先读取 JSON 文件
  const jsonPath = path.join(DATA_DIR, 'mbti_reports.json')
  if (fs.existsSync(jsonPath)) {
    const content = fs.readFileSync(jsonPath, 'utf8')
    const json = JSON.parse(content)
    return json.reports
  }

  const content = fs.readFileSync(path.join(__dirname, 'mbti_result.md'), 'utf8')
  
  // 解析MBTI报告数据（基于实际文件格式）
  const reports = []
  const sections = content.split('---')
  
  for (const section of sections) {
    // 匹配所有MBTI类型格式：数字. 类型 - 标题 emoji
    if (section.match(/\d+\.\s+[A-Z]{4}\s+-\s+/)) {
      const report = parseMBTIReport(section)
      if (report) {
        reports.push(report)
      }
    }
  }
  
  return reports
}

// 解析单个MBTI报告
function parseMBTIReport(section) {
  const lines = section.split('\n').filter(line => line.trim())
  if (lines.length === 0) return null
  
  // 获取MBTI类型和标题
  const firstLine = lines[0]
  const typeMatch = firstLine.match(/(\d+)\.\s+([A-Z]{4})\s+-\s+(.+)/)
  if (!typeMatch) return null
  
  const mbti_type = typeMatch[2]
  const nickname = typeMatch[3]
  
  const report = {
    mbti_type,
    metadata: {
      nickname,
      title: '',
      category: ''
    },
    personality_profile: {
      description: '',
      psychological_analysis: '',
      imagery: ''
    },
    superpowers: [],
    characteristics: {
      catchphrases: [],
      habits: [],
      social_style: '',
      relationship_style: ''
    },
    career_profile: {
      suitable_roles: [],
      motto: ''
    },
    love_guide: {
      ideal_partner: '',
      relationship_mode: '',
      confession_style: ''
    },
    personality_group: ''
  }
  
  // 解析各个部分
  let currentSection = ''
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    
    if (line.startsWith('别名：')) {
      report.metadata.title = line.replace('别名：', '').trim()
    } else if (line.includes('人格画像')) {
      currentSection = 'profile'
    } else if (line.includes('超能力清单')) {
      currentSection = 'superpowers'
    } else if (line.includes('有趣特征')) {
      currentSection = 'characteristics'
    } else if (line.includes('职场人格')) {
      currentSection = 'career'
    } else if (line.includes('恋爱指南')) {
      currentSection = 'love'
    }
    
    if (currentSection === 'profile' && !line.startsWith('🎪')) {
      report.personality_profile.description += line + ' '
    } else if (currentSection === 'superpowers' && line.startsWith('- ')) {
      const power = line.replace('- ', '').trim()
      report.superpowers.push({ ability: power, description: power })
    } else if (currentSection === 'characteristics' && line.startsWith('- ')) {
      const habit = line.replace('- ', '').trim()
      report.characteristics.habits.push(habit)
    }
  }
  
  // 确定人格组别
  if (['ISTJ', 'ISFJ', 'ESTJ', 'ESFJ'].includes(mbti_type)) {
    report.personality_group = '守护者联盟'
  } else if (['ISTP', 'ISFP', 'ESTP', 'ESFP'].includes(mbti_type)) {
    report.personality_group = '探索者联盟'
  } else if (['INFJ', 'INFP', 'ENFJ', 'ENFP'].includes(mbti_type)) {
    report.personality_group = '理想家联盟'
  } else if (['INTJ', 'INTP', 'ENTJ', 'ENTP'].includes(mbti_type)) {
    report.personality_group = '理性者联盟'
  }
  
  return report
}

// 导出数据导入函数
module.exports = {
  load24Questions,
  load93Questions,
  loadMBTIReports
}

// 导入数据到云数据库
async function importToDatabase() {
  const cloud = require('wx-server-sdk')
  cloud.init({
    env: ENV_ID || cloud.DYNAMIC_CURRENT_ENV,
  })
  
  const db = cloud.database()
  const _ = db.command
  
  try {
    console.log('开始导入MBTI数据到云数据库...')
    
    // 加载数据
    const questions24 = load24Questions()
    const questions93 = load93Questions()
    const reports = loadMBTIReports()
    
    console.log(`24题数据: ${questions24.length} 条`)
    console.log(`93题数据: ${questions93.length} 条`)
    console.log(`MBTI报告: ${reports.length} 条`)
    
    // 创建集合（如果不存在）
    const collections = ['questions', 'reports', 'user_results']
    for (const collectionName of collections) {
      try {
        await db.createCollection(collectionName)
        console.log(`创建集合: ${collectionName}`)
      } catch (err) {
        if (err.errCode === -1) {
          console.log(`集合已存在: ${collectionName}`)
        } else {
          console.error(`创建集合失败: ${collectionName}`, err)
        }
      }
    }
    
    // 导入24题数据（清空旧版本）
    const questionsCollection = db.collection('questions')
    await clearByVersion(questionsCollection, 'simple')
    for (const question of questions24) {
      await questionsCollection.add({
        data: {
          ...question,
          created_at: new Date()
        }
      })
    }
    console.log('24题数据导入完成')
    
    // 导入93题数据（清空旧版本）
    await clearByVersion(questionsCollection, 'detailed')
    for (const question of questions93) {
      await questionsCollection.add({
        data: {
          ...question,
          created_at: new Date()
        }
      })
    }
    console.log('93题数据导入完成')
    
    // 导入MBTI报告（全量替换）
    const reportsCollection = db.collection('reports')
    await clearAll(reportsCollection)
    for (const report of reports) {
      await reportsCollection.add({
        data: {
          ...report,
          created_at: new Date(),
          updated_at: new Date()
        }
      })
    }
    console.log('MBTI报告导入完成')
    
    console.log('所有数据导入完成！')
    return true
    
  } catch (error) {
    console.error('数据导入失败:', error)
    throw error
  }
}

// 工具函数：按版本清理
async function clearByVersion(collection, version) {
  const batchSize = 20
  while (true) {
    const { data } = await collection.where({ version }).limit(batchSize).get()
    if (!data.length) break
    for (const doc of data) {
      await collection.doc(doc._id).remove()
    }
  }
}

// 工具函数：清空集合
async function clearAll(collection) {
  const batchSize = 20
  while (true) {
    const { data } = await collection.limit(batchSize).get()
    if (!data.length) break
    for (const doc of data) {
      await collection.doc(doc._id).remove()
    }
  }
}

// 如果直接运行此脚本，执行数据导入
if (require.main === module) {
  console.log('开始导入MBTI数据...')
  
  importToDatabase()
    .then(() => {
      console.log('数据导入完成！')
      process.exit(0)
    })
    .catch((error) => {
      console.error('数据导入失败:', error)
      process.exit(1)
    })
}