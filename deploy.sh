#!/bin/bash

# MBTI云函数部署脚本
# 使用方法：./deploy.sh [环境ID]

# 检查参数
ENV_ID=${1:-"mbti-test-1g8x6y5q49e9a86"}  # 默认环境ID，请替换为你的实际环境ID

echo "========================================="
echo "MBTI云函数部署脚本"
echo "========================================="
echo "目标环境: $ENV_ID"
echo "开始时间: $(date)"
echo ""

# 检查是否在正确的目录
if [ ! -f "project.config.json" ]; then
    echo "错误: 请在项目根目录下运行此脚本"
    exit 1
fi

# 检查云函数目录
if [ ! -d "cloudfunctions/mbti-service" ]; then
    echo "错误: cloudfunctions/mbti-service 目录不存在"
    exit 1
fi

echo "1. 安装云函数依赖..."
cd cloudfunctions/mbti-service
if [ ! -d "node_modules" ]; then
    npm install
    if [ $? -ne 0 ]; then
        echo "错误: npm install 失败"
        exit 1
    fi
else
    echo "依赖已安装，跳过..."
fi

echo ""
echo "2. 检查云函数文件..."
if [ ! -f "index.js" ]; then
    echo "错误: index.js 文件不存在"
    exit 1
fi

if [ ! -f "package.json" ]; then
    echo "错误: package.json 文件不存在"
    exit 1
fi

echo ""
echo "3. 云函数检查完成"
echo "   - 入口文件: index.js ✓"
echo "   - 配置文件: package.json ✓"
echo "   - 依赖包: node_modules ✓"

echo ""
echo "========================================="
echo "部署说明:"
echo "========================================="
echo "请按照以下步骤在微信开发者工具中部署:"
echo ""
echo "1. 打开微信开发者工具"
echo "2. 加载项目: $(pwd)/../"
echo "3. 右键点击 cloudfunctions/mbti-service 文件夹"
echo "4. 选择 '上传并部署：云端安装依赖'"
echo "5. 等待部署完成"
echo ""
echo "部署完成后，请验证:"
echo "1. 点击工具栏'云开发'按钮"
echo "2. 选择'云函数'标签"
echo "3. 确认 mbti-service 函数存在"
echo ""
echo "环境ID: $ENV_ID"
echo "结束时间: $(date)"
echo "========================================="