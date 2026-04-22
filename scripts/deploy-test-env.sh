#!/bin/bash
# deploy-test-env.sh — 创建独立的 OTA/黑盒测试部署环境
# 模拟真实用户安装目录结构（跨平台逻辑一致）
#
# 结构:
#   /opt/woodpecker-test/              ← APP_DIR (安装目录)
#   ├── desktop/                       ← 桌面端启动/OTA 脚本
#   │   ├── start-desktop.js
#   │   ├── ota-client.js
#   │   ├── ota-config.json
#   │   └── ota-keys/
#   ├── dist/                          ← 编译后的后端
#   ├── public/                        ← 前端静态资源
#   ├── node_modules/                  ← 生产依赖
#   ├── package.json
#   └── version.json
#
#   ~/.local/share/woodpecker/         ← DATA_DIR (用户数据，与安装目录分离)
#       └── db/                        ← embedded-postgres 数据
#
# 用法:
#   ./scripts/deploy-test-env.sh              # 首次部署
#   ./scripts/deploy-test-env.sh --update     # 模拟 OTA 更新（只刷新 dist/desktop/public）

set -e

SOURCE_DIR="/home/maxin/project/psych-scale-server"
DEPLOY_DIR="/opt/woodpecker-test"
ACTION="${1:-init}"

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║  部署测试环境: $DEPLOY_DIR"
echo "║  操作: $ACTION"
echo "╚════════════════════════════════════════════════════════╝"

if [ "$ACTION" = "--clean" ]; then
  echo "完全清理部署环境..."
  # 停止运行中的实例
  pkill -f "start-desktop.js" 2>/dev/null || true
  sleep 1
  pkill -f "dist/main.js" 2>/dev/null || true
  sleep 1
  rm -rf "$DEPLOY_DIR"
  rm -rf ~/.local/share/woodpecker
  echo "✅ 已清理"
  exit 0
fi

# Step 1: Build source if needed
if [ ! -f "$SOURCE_DIR/dist/main.js" ]; then
  echo "  构建 dist..."
  cd "$SOURCE_DIR"
  npm run build
fi

VERSION=$(node -p "require('$SOURCE_DIR/package.json').version")
echo "  源码版本: v${VERSION}"

# Step 2: Create deploy directory
sudo mkdir -p "$DEPLOY_DIR"
sudo chown "$(id -u):$(id -g)" "$DEPLOY_DIR"

if [ "$ACTION" = "--update" ]; then
  # OTA 模拟模式: 只更新 dist/desktop/public，不动 node_modules
  echo ""
  echo "  [OTA 模式] 更新应用文件..."

  # Bump version for OTA
  OTA_VERSION=$(echo "$VERSION" | awk -F. '{print $1"."$2"."$3+1}')
  echo "  OTA 目标版本: v${OTA_VERSION}"

  # Update version.json
  echo "{\"version\":\"${OTA_VERSION}\",\"lastChecked\":\"$(date -Iseconds)\",\"lastUpdated\":\"$(date -Iseconds)\"}" > "$DEPLOY_DIR/version.json"

  # Replace dist/, desktop/, public/ — 这就是 OTA scanDirs 的内容
  rm -rf "$DEPLOY_DIR/dist"
  cp -r "$SOURCE_DIR/dist" "$DEPLOY_DIR/dist"

  rm -rf "$DEPLOY_DIR/public"
  cp -r "$SOURCE_DIR/public" "$DEPLOY_DIR/public"

  rm -rf "$DEPLOY_DIR/desktop"
  cp -r "$SOURCE_DIR/desktop" "$DEPLOY_DIR/desktop"

  # Copy version.json to dist for OTA client
  cp "$DEPLOY_DIR/version.json" "$DEPLOY_DIR/dist/version.json"

  echo "  ✅ OTA 文件已更新 → v${OTA_VERSION}"
  echo ""
  echo "  注意: 用户数据目录 (~/.local/share/woodpecker/) 未改动"
  echo "  下次启动 start-desktop.js 时，embedded-postgres 将加载现有数据库"
  exit 0
fi

# Step 3: Full init — create complete deployment
echo ""
echo "  [初始化] 创建完整部署..."

# Copy application files
echo "  复制 dist/..."
rm -rf "$DEPLOY_DIR/dist"
cp -r "$SOURCE_DIR/dist" "$DEPLOY_DIR/dist"

echo "  复制 public/..."
rm -rf "$DEPLOY_DIR/public"
cp -r "$SOURCE_DIR/public" "$DEPLOY_DIR/public"

echo "  复制 desktop/..."
rm -rf "$DEPLOY_DIR/desktop"
cp -r "$SOURCE_DIR/desktop" "$DEPLOY_DIR/desktop"

echo "  复制 package.json..."
cp "$SOURCE_DIR/package.json" "$DEPLOY_DIR/package.json"

# Create version.json
echo "{\"version\":\"${VERSION}\"}" > "$DEPLOY_DIR/version.json"
cp "$DEPLOY_DIR/version.json" "$DEPLOY_DIR/dist/version.json"

# Create OTA config (point to test server or empty for offline testing)
if [ -n "$OTA_BASE_URL" ]; then
  echo "{\"baseUrl\":\"$OTA_BASE_URL\"}" > "$DEPLOY_DIR/desktop/ota-config.json"
else
  echo "{}" > "$DEPLOY_DIR/desktop/ota-config.json"
fi

# Install production dependencies
echo "  安装生产依赖..."
cd "$DEPLOY_DIR"
if [ -d "$DEPLOY_DIR/node_modules" ]; then
  echo "  node_modules 已存在，增量更新..."
  npm install --omit=dev --ignore-scripts 2>&1 | tail -3
else
  npm install --omit=dev --ignore-scripts 2>&1 | tail -3
fi

# Ensure embedded-postgres platform binary exists
if [ ! -d "$DEPLOY_DIR/node_modules/@embedded-postgres/linux-x64" ]; then
  echo "  安装 embedded-postgres Linux 二进制..."
  cd "$DEPLOY_DIR"
  npm install --no-save --force "@embedded-postgres/linux-x64" 2>&1 | tail -3
fi

# Fix ICU symlinks — npm install --ignore-scripts may drop .so symlinks
EP_LIB_DIR="$DEPLOY_DIR/node_modules/@embedded-postgres/linux-x64/native/lib"
if [ -d "$EP_LIB_DIR" ]; then
  echo "  修复 ICU 符号链接..."
  cd "$EP_LIB_DIR"
  for so in libicuuc libicui18n libicudata; do
    if [ -f "${so}.so.60.2" ] && [ ! -L "${so}.so.60" ]; then
      ln -sf "${so}.so.60.2" "${so}.so.60"
    fi
    if [ -L "${so}.so.60" ] && [ ! -L "${so}.so" ]; then
      ln -sf "${so}.so.60" "${so}.so"
    fi
  done
  # Also fix other common .so symlinks
  for f in *.so.*.*; do
    base="${f%.*.*}"
    major="${f##*.so.}"
    if [ ! -L "${base}.so.${major%%.*}" ] && [ -f "$f" ]; then
      ln -sf "$f" "${base}.so.${major%%.*}"
    fi
    if [ ! -L "${base}.so" ] && [ -f "$f" ]; then
      ln -sf "${base}.so.${major%%.*}" "${base}.so" 2>/dev/null || true
    fi
  done
fi

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║  ✅ 部署完成                                          ║"
echo "╠════════════════════════════════════════════════════════╣"
echo "║  安装目录: $DEPLOY_DIR"
DEPLOY_SIZE=$(du -sh "$DEPLOY_DIR" 2>/dev/null | cut -f1)
echo "║  大小: ${DEPLOY_SIZE}"
echo "║  版本: v${VERSION}"
echo "║                                                        ║"
echo "║  启动: node $DEPLOY_DIR/desktop/start-desktop.js"
echo "║  数据: ~/.local/share/woodpecker/"
echo "║                                                        ║"
echo "║  OTA 模拟: $0 --update"
echo "║  完全清理: $0 --clean"
echo "╚════════════════════════════════════════════════════════╝"
