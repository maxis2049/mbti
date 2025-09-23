// 优化的数据导入脚本 - 分批处理避免超时
const fs = require('fs')
const path = require('path')

// 数据目录优先级：
// 1) 项目根下的 data_yangben（本地开发/脚本运行）
// 2) 云函数目录自身的 JSON 副本（云端部署时常见场景）
const PRIMARY_DATA_DIR = path.resolve(__dirname, '../../data_yangben')
const FALLBACK_DATA_DIR = __dirname

function readJsonFromPaths(filename) {
  const candidatePaths = [
    path.join(PRIMARY_DATA_DIR, filename),
    path.join(FALLBACK_DATA_DIR, filename)
  ]
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8')
      return { json: JSON.parse(content), usedPath: p }
    }
  }
  return { json: null, usedPath: null }
}

// 读取24题数据
function load24Questions() {
  const { json, usedPath } = readJsonFromPaths('24questions.json')
  if (json && json.questions) {
    console.log(`[import] 使用24题数据: ${usedPath}`)
    return json.questions.map(q => ({
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

// 读取93题数据
function load93Questions() {
  const { json, usedPath } = readJsonFromPaths('93questions.json')
  if (json && json.questions) {
    console.log(`[import] 使用93题数据: ${usedPath}`)
    return json.questions.map(q => ({
      question_id: q.question_id,
      question_text: q.question_text,
      options: q.options,
      dimension_group: q.dimension_group,
      version: 'detailed'
    }))
  }
  return []
}

// 读取MBTI报告数据
function loadMBTIReports() {
  const { json, usedPath } = readJsonFromPaths('mbti_reports.json')
  if (json && json.reports) {
    console.log(`[import] 使用报告数据: ${usedPath}`)
    return json.reports || []
  }
  return []
}

// 分批导入函数
async function batchImport(collection, data, batchSize = 10) {
  const totalBatches = Math.ceil(data.length / batchSize)
  let imported = 0
  
  for (let i = 0; i < totalBatches; i++) {
    const batch = data.slice(i * batchSize, (i + 1) * batchSize)
    
    for (const item of batch) {
      try {
        await collection.add({
          data: {
            ...item,
            created_at: new Date()
          }
        })
        imported++
        console.log(`已导入 ${imported}/${data.length} 条数据`)
      } catch (err) {
        console.error('导入单条数据失败:', err)
        // 继续导入其他数据
      }
    }
    
    // 每批之间稍作延迟，避免连续操作
    if (i < totalBatches - 1) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
  
  return imported
}

// 分批清理函数
async function batchClear(collection, condition, batchSize = 20) {
  let totalCleared = 0
  
  while (true) {
    const { data } = await collection.where(condition).limit(batchSize).get()
    if (!data || data.length === 0) break
    
    for (const doc of data) {
      try {
        await collection.doc(doc._id).remove()
        totalCleared++
        console.log(`已清理 ${totalCleared} 条旧数据`)
      } catch (err) {
        console.error('清理单条数据失败:', err)
      }
    }
    
    // 批次之间稍作延迟
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  
  return totalCleared
}

// 优化的导入数据到云数据库
async function importToDatabase() {
  const cloud = require('wx-server-sdk')
  cloud.init({
    env: cloud.DYNAMIC_CURRENT_ENV,
  })
  
  const db = cloud.database()
  const _ = db.command
  
  try {
    console.log('开始优化导入MBTI数据到云数据库...')
    
    // 加载数据
    const questions24 = load24Questions()
    const questions93 = load93Questions()
    const reports = loadMBTIReports()
    
    console.log(`24题数据: ${questions24.length} 条`)
    console.log(`93题数据: ${questions93.length} 条`)
    console.log(`MBTI报告: ${reports.length} 条`)
    
    // 检查集合是否存在，不存在则创建
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
    
    const questionsCollection = db.collection('questions')
    const reportsCollection = db.collection('reports')
    
    // 分步导入：先清理，再导入
    
    // 1. 清理24题旧数据
    console.log('开始清理24题旧数据...')
    const cleared24 = await batchClear(questionsCollection, { version: 'simple' }, 10)
    console.log(`24题旧数据清理完成，共清理 ${cleared24} 条`)
    
    // 2. 分批导入24题数据
    console.log('开始分批导入24题数据...')
    const imported24 = await batchImport(questionsCollection, questions24, 5)
    console.log(`24题数据导入完成，成功导入 ${imported24}/${questions24.length} 条`)
    
    // 短暂延迟，避免连续操作
    await new Promise(resolve => setTimeout(resolve, 200))
    
    // 3. 清理93题旧数据
    console.log('开始清理93题旧数据...')
    const cleared93 = await batchClear(questionsCollection, { version: 'detailed' }, 10)
    console.log(`93题旧数据清理完成，共清理 ${cleared93} 条`)
    
    // 4. 分批导入93题数据
    console.log('开始分批导入93题数据...')
    const imported93 = await batchImport(questionsCollection, questions93, 8)
    console.log(`93题数据导入完成，成功导入 ${imported93}/${questions93.length} 条`)
    
    // 再次延迟
    await new Promise(resolve => setTimeout(resolve, 200))
    
    // 5. 清理MBTI报告旧数据
    console.log('开始清理MBTI报告旧数据...')
    const clearedReports = await batchClear(reportsCollection, {}, 5)
    console.log(`MBTI报告旧数据清理完成，共清理 ${clearedReports} 条`)
    
    // 6. 分批导入MBTI报告
    console.log('开始分批导入MBTI报告...')
    const importedReports = await batchImport(reportsCollection, reports, 3)
    console.log(`MBTI报告导入完成，成功导入 ${importedReports}/${reports.length} 条`)
    
    console.log('🎉 所有数据导入完成！')
    
    return {
      success: true,
      message: '数据导入完成',
      stats: {
        questions24: imported24,
        questions93: imported93,
        reports: importedReports
      }
    }
    
  } catch (error) {
    console.error('数据导入失败:', error)
    return {
      success: false,
      error: error.message || '未知错误'
    }
  }
}

// 导出数据导入函数
module.exports = {
  load24Questions,
  load93Questions,
  loadMBTIReports,
  importToDatabase
}

// 如果直接运行此脚本，执行数据导入
if (require.main === module) {
  console.log('开始优化导入MBTI数据...')
  
  importToDatabase()
    .then((result) => {
      if (result.success) {
        console.log('✅ 数据导入成功！')
        console.log('📊 导入统计:', result.stats)
      } else {
        console.log('❌ 数据导入失败:', result.error)
      }
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ 数据导入异常:', error)
      process.exit(1)
    })
}