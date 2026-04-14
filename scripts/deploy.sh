#!/bin/bash

# ============================================
# 部署脚本（镜像回滚版）
# ============================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

STATE_FILE=".deploy-state.env"
TARGET_IMAGE=""
PREVIOUS_IMAGE=""

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

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

get_running_app_image() {
    docker inspect --format='{{.Config.Image}}' bid-platform-app 2>/dev/null || true
}

record_previous_image() {
    PREVIOUS_IMAGE=$(get_running_app_image)
    if [ -n "$PREVIOUS_IMAGE" ]; then
        log_info "当前运行镜像: $PREVIOUS_IMAGE"
    else
        log_warn "未发现正在运行的 app 容器，首次部署将无可回滚镜像"
    fi
}

build_image() {
    local timestamp
    timestamp=$(date +%Y%m%d_%H%M%S)
    TARGET_IMAGE="bid-platform:release-$timestamp"

    log_info "开始构建Docker镜像: $TARGET_IMAGE"
    docker build -t "$TARGET_IMAGE" .
    log_info "Docker镜像构建完成"
}

start_services() {
    log_info "使用镜像启动服务: $TARGET_IMAGE"
    APP_IMAGE="$TARGET_IMAGE" docker compose up -d --remove-orphans
    log_info "服务启动完成"
}

wait_for_health() {
    log_info "等待服务健康检查..."
    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost:5000/api/health >/dev/null 2>&1; then
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

run_migrations() {
    log_info "运行数据库迁移..."
    APP_IMAGE="$TARGET_IMAGE" docker compose run --rm app pnpm run db:migrate
    log_info "数据库迁移完成"
}

cleanup_old_images() {
    log_info "清理旧的Docker镜像..."
    docker image prune -f
    log_info "清理完成"
}

backup_database() {
    log_info "备份数据库..."
    local timestamp
    timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="/backup/bid-platform-$timestamp.sql"

    docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > "$backup_file"
    log_info "数据库备份完成: $backup_file"
}

write_state_file() {
    cat > "$STATE_FILE" <<EOF
PREVIOUS_IMAGE=$PREVIOUS_IMAGE
TARGET_IMAGE=$TARGET_IMAGE
EOF
}

rollback() {
    log_warn "开始镜像回滚..."

    if [ -z "$PREVIOUS_IMAGE" ] && [ -f "$STATE_FILE" ]; then
        # shellcheck disable=SC1090
        source "$STATE_FILE"
        PREVIOUS_IMAGE=${PREVIOUS_IMAGE:-}
    fi

    if [ -z "$PREVIOUS_IMAGE" ]; then
        log_error "未找到可回滚镜像，无法自动回滚"
        exit 1
    fi

    log_warn "回滚到镜像: $PREVIOUS_IMAGE"
    APP_IMAGE="$PREVIOUS_IMAGE" docker compose up -d --remove-orphans

    if wait_for_health; then
        log_info "回滚成功"
    else
        log_error "回滚失败"
        exit 1
    fi
}

main() {
    log_info "开始部署..."
    check_env_vars
    backup_database

    log_info "拉取最新代码..."
    git pull origin main

    record_previous_image
    build_image
    write_state_file
    run_migrations
    start_services

    if ! wait_for_health; then
        log_error "部署失败，开始回滚..."
        rollback
        exit 1
    fi

    cleanup_old_images
    log_info "部署完成！"
}

trap 'log_error "部署被中断"; exit 1' INT TERM

main "$@"
