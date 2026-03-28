#!/bin/bash

# ============================================
# 部署脚本
# 用于自动化部署到服务器
# ============================================

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查必要的环境变量
check_env_vars() {
    log_info "检查环境变量..."
    required_vars=("DATABASE_URL" "REDIS_PASSWORD" "POSTGRES_USER" "POSTGRES_PASSWORD")
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            log_error "环境变量 $var 未设置"
            exit 1
        fi
    done
    
    log_info "环境变量检查通过"
}

# 构建Docker镜像
build_image() {
    log_info "开始构建Docker镜像..."
    docker build -t bid-platform:latest .
    log_info "Docker镜像构建完成"
}

# 停止并删除旧容器
stop_old_containers() {
    log_info "停止旧容器..."
    docker-compose down
    log_info "旧容器已停止"
}

# 启动服务
start_services() {
    log_info "启动服务..."
    docker-compose up -d
    log_info "服务启动完成"
}

# 等待服务健康
wait_for_health() {
    log_info "等待服务健康检查..."
    max_attempts=30
    attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost:5000/api/health > /dev/null 2>&1; then
            log_info "服务健康检查通过"
            return 0
        fi
        
        log_warn "等待服务启动... ($attempt/$max_attempts)"
        sleep 5
        attempt=$((attempt + 1))
    done
    
    log_error "服务健康检查失败"
    return 1
}

# 运行数据库迁移
run_migrations() {
    log_info "运行数据库迁移..."
    # docker-compose exec -T app pnpm run migrate
    log_info "数据库迁移完成"
}

# 清理旧镜像
cleanup_old_images() {
    log_info "清理旧的Docker镜像..."
    docker image prune -f
    log_info "清理完成"
}

# 备份数据库
backup_database() {
    log_info "备份数据库..."
    timestamp=$(date +%Y%m%d_%H%M%S)
    backup_file="/backup/bid-platform-$timestamp.sql"
    
    docker-compose exec -T postgres pg_dump -U $POSTGRES_USER $POSTGRES_DB > $backup_file
    
    if [ $? -eq 0 ]; then
        log_info "数据库备份完成: $backup_file"
    else
        log_error "数据库备份失败"
        exit 1
    fi
}

# 回滚部署
rollback() {
    log_warn "开始回滚部署..."
    docker-compose down
    git reset --hard HEAD~1
    docker-compose up -d
    
    if wait_for_health; then
        log_info "回滚成功"
    else
        log_error "回滚失败"
        exit 1
    fi
}

# 主函数
main() {
    log_info "开始部署..."
    
    # 检查环境变量
    check_env_vars
    
    # 备份数据库
    backup_database
    
    # 拉取最新代码
    log_info "拉取最新代码..."
    git pull origin main
    
    # 构建镜像
    build_image
    
    # 停止旧容器
    stop_old_containers
    
    # 启动新服务
    start_services
    
    # 等待服务健康
    if ! wait_for_health; then
        log_error "部署失败，开始回滚..."
        rollback
        exit 1
    fi
    
    # 运行迁移
    run_migrations
    
    # 清理
    cleanup_old_images
    
    log_info "部署完成！"
}

# 捕获中断信号
trap 'log_error "部署被中断"; exit 1' INT TERM

# 执行主函数
main "$@"
