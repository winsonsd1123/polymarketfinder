#!/bin/bash
#
# 本地 Cron Job 快速设置脚本
# 使用方法: bash scripts/setup-local-cron.sh
#

set -e

echo "=========================================="
echo "Polymarket Scanner - 本地 Cron 设置向导"
echo "=========================================="
echo ""

# 检查是否已存在 .env 文件
if [ -f .env ]; then
    echo "⚠️  发现已存在的 .env 文件"
    read -p "是否覆盖？(y/N): " overwrite
    if [ "$overwrite" != "y" ] && [ "$overwrite" != "Y" ]; then
        echo "跳过 .env 文件创建"
    else
        rm .env
    fi
fi

# 创建 .env 文件
if [ ! -f .env ]; then
    echo ""
    echo "📝 配置环境变量..."
    echo ""
    
    read -p "请输入 Vercel API 地址 (例如: https://your-app.vercel.app/api/cron/scan): " SCAN_API_URL
    read -p "请输入 CRON_SECRET (需与 Vercel 环境变量一致): " CRON_SECRET
    
    cat > .env << EOF
# Polymarket Scanner 环境变量配置
# 生成时间: $(date)

# Vercel 部署的 API 地址
SCAN_API_URL=${SCAN_API_URL}

# 认证密钥（需与 Vercel 环境变量中的 CRON_SECRET 一致）
CRON_SECRET=${CRON_SECRET}

# 循环运行的间隔时间（毫秒，仅在 loop 模式下使用）
SCAN_INTERVAL_MS=300000
EOF
    
    # 设置文件权限
    chmod 600 .env
    echo "✅ .env 文件已创建"
else
    echo "✅ .env 文件已存在"
fi

# 测试配置
echo ""
echo "🧪 测试配置..."
echo ""

if npm run auto-scan > /tmp/polymarket-test.log 2>&1; then
    echo "✅ 配置测试成功！"
    echo ""
    echo "测试输出："
    tail -n 10 /tmp/polymarket-test.log
    rm /tmp/polymarket-test.log
else
    echo "❌ 配置测试失败，请检查："
    echo "1. SCAN_API_URL 是否正确"
    echo "2. CRON_SECRET 是否与 Vercel 环境变量一致"
    echo "3. 网络连接是否正常"
    echo ""
    echo "错误日志："
    cat /tmp/polymarket-test.log
    rm /tmp/polymarket-test.log
    exit 1
fi

# 询问是否设置 cron job
echo ""
read -p "是否设置 cron job？(y/N): " setup_cron

if [ "$setup_cron" = "y" ] || [ "$setup_cron" = "Y" ]; then
    echo ""
    echo "📅 设置 cron job..."
    echo ""
    
    # 获取项目绝对路径
    PROJECT_DIR=$(pwd)
    
    # 获取 npm 路径
    NPM_PATH=$(which npm)
    if [ -z "$NPM_PATH" ]; then
        echo "❌ 未找到 npm，请先安装 Node.js"
        exit 1
    fi
    
    # 创建日志目录
    LOG_DIR="/var/log"
    LOG_FILE="$LOG_DIR/polymarket-scan.log"
    
    if [ ! -w "$LOG_DIR" ]; then
        echo "⚠️  需要 sudo 权限创建日志文件"
        sudo touch "$LOG_FILE"
        sudo chmod 666 "$LOG_FILE"
    else
        touch "$LOG_FILE"
        chmod 666 "$LOG_FILE"
    fi
    
    # 询问执行频率
    echo "选择执行频率："
    echo "1) 每小时整点 (0 * * * *) - 推荐"
    echo "2) 每2小时整点 (0 */2 * * *)"
    echo "3) 每6小时整点 (0 */6 * * *)"
    echo "4) 每天 0点 (0 0 * * *)"
    echo "5) 自定义"
    read -p "请选择 (1-5): " frequency
    
    case $frequency in
        1)
            CRON_SCHEDULE="0 * * * *"
            echo "✅ 已设置为每小时整点执行（例如：1:00, 2:00, 3:00...）"
            ;;
        2)
            CRON_SCHEDULE="0 */2 * * *"
            echo "✅ 已设置为每2小时整点执行（例如：0:00, 2:00, 4:00...）"
            ;;
        3)
            CRON_SCHEDULE="0 */6 * * *"
            echo "✅ 已设置为每6小时整点执行（例如：0:00, 6:00, 12:00, 18:00）"
            ;;
        4)
            CRON_SCHEDULE="0 0 * * *"
            echo "✅ 已设置为每天 0点执行"
            ;;
        5)
            read -p "请输入 cron 表达式 (例如: 0 * * * * 表示每小时整点): " CRON_SCHEDULE
            ;;
        *)
            echo "无效选择，使用默认值：每小时整点"
            CRON_SCHEDULE="0 * * * *"
            ;;
    esac
    
    # 创建 cron job 条目
    CRON_ENTRY="$CRON_SCHEDULE cd $PROJECT_DIR && $NPM_PATH run auto-scan >> $LOG_FILE 2>&1"
    
    # 检查是否已存在
    if crontab -l 2>/dev/null | grep -q "polymarketfinder\|auto-scan"; then
        echo "⚠️  发现已存在的 cron job"
        read -p "是否替换？(y/N): " replace
        if [ "$replace" = "y" ] || [ "$replace" = "Y" ]; then
            (crontab -l 2>/dev/null | grep -v "polymarketfinder\|auto-scan"; echo "$CRON_ENTRY") | crontab -
            echo "✅ Cron job 已更新"
        else
            echo "跳过 cron job 设置"
        fi
    else
        (crontab -l 2>/dev/null; echo "$CRON_ENTRY") | crontab -
        echo "✅ Cron job 已添加"
    fi
    
    echo ""
    echo "📋 当前 cron jobs:"
    crontab -l | grep -E "polymarketfinder|auto-scan" || echo "  (无)"
    
    echo ""
    echo "📝 日志文件位置: $LOG_FILE"
    echo "   查看日志: tail -f $LOG_FILE"
fi

echo ""
echo "=========================================="
echo "✅ 设置完成！"
echo "=========================================="
echo ""
echo "下一步："
echo "1. 查看日志: tail -f /var/log/polymarket-scan.log"
echo "2. 手动测试: npm run auto-scan"
echo "3. 查看 cron: crontab -l"
echo ""
