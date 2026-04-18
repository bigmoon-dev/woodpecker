#!/bin/bash
set -e

VERSION="0.22.1"
NODE_VERSION="v20.11.1"
BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="$BASE_DIR/dist/desktop"

download_node() {
  local platform=$1
  local arch=$2
  local ext=$3
  local target_dir="$BUILD_DIR/$platform-$arch/node"
  
  mkdir -p "$target_dir"
  local url="https://nodejs.org/dist/$NODE_VERSION/node-$NODE_VERSION-$platform-$arch.$ext"
  echo "  下载 Node.js $NODE_VERSION for $platform-$arch..."
  
  if [ "$ext" = "zip" ]; then
    curl -fSL "$url" -o /tmp/node-$platform-$arch.zip
    unzip -q -o /tmp/node-$platform-$arch.zip -d /tmp/
    cp /tmp/node-$NODE_VERSION-$platform-$arch/bin/node "$target_dir/node" 2>/dev/null || \
      cp /tmp/node-$NODE_VERSION-$platform-$arch/node.exe "$target_dir/node.exe" 2>/dev/null || true
    rm -rf /tmp/node-$platform-$arch.zip /tmp/node-$NODE_VERSION-$platform-$arch
  else
    curl -fSL "$url".tar.gz -o /tmp/node-$platform-$arch.tar.gz
    tar xzf /tmp/node-$platform-$arch.tar.gz -C /tmp/
    cp /tmp/node-$NODE_VERSION-$platform-$arch/bin/node "$target_dir/node"
    rm -rf /tmp/node-$platform-$arch.tar.gz /tmp/node-$NODE_VERSION-$platform-$arch
  fi
  echo "  ✅ Node.js 下载完成"
}

build_platform() {
  local platform=$1
  local arch=$2
  local pkg_name=$3
  local start_script=$4
  
  echo ""
  echo "=== 构建 $platform-$arch ==="
  
  local target="$BUILD_DIR/$platform-$arch"
  mkdir -p "$target"
  
  # 复制应用文件
  echo "  复制应用文件..."
  cp -r "$BASE_DIR/dist" "$target/dist"
  cp -r "$BASE_DIR/public" "$target/public"
  cp "$BASE_DIR/package.json" "$target/package.json"
  
  # 安装生产依赖（包含embedded-postgres会自动下载对应平台二进制）
  echo "  安装生产依赖..."
  cd "$target"
  npm install --omit=dev --ignore-scripts 2>/dev/null
  
  # 下载Node.js
  download_node "$platform" "$arch" "$pkg_name"
  
  # 写启动脚本
  echo "$start_script" > "$target/start.sh"
  chmod +x "$target/start.sh"
  
  echo "  ✅ $platform-$arch 构建完成"
  du -sh "$target"
}

# 清理
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# 构建前端
echo "构建前端..."
cd "$BASE_DIR/client"
npx vite build 2>&1 | tail -3

# 构建后端
echo "构建后端..."
cd "$BASE_DIR"
npm run build 2>&1 | tail -3

# Windows x64
WIN_START='@echo off
set PORT=3000
set DB_HOST=localhost
set DB_PORT=15432
set DB_USERNAME=postgres
set DB_PASSWORD=postgres
set DB_DATABASE=psych_scale
set DB_SYNC=false
set DB_LOGGING=false
set JWT_SECRET=woodpecker-desktop
set ENCRYPTION_KEY=woodpecker-desktop-encryption
set AUDIT_HMAC_SECRET=woodpecker-desktop-hmac
set NODE_ENV=production
start http://localhost:3000
node.exe dist\main.js
'
echo "$WIN_START" > "$BUILD_DIR/win-x64/start.bat" 2>/dev/null || true

# macOS x64
MAC_START='#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
export PORT=3000
export DB_HOST=localhost
export DB_PORT=15432
export DB_USERNAME=postgres
export DB_PASSWORD=postgres
export DB_DATABASE=psych_scale
export DB_SYNC=false
export DB_LOGGING=false
export JWT_SECRET=woodpecker-desktop
export ENCRYPTION_KEY=woodpecker-desktop-encryption
export AUDIT_HMAC_SECRET=woodpecker-desktop-hmac
export NODE_ENV=production
open "http://localhost:3000"
"$DIR/node" "$DIR/dist/main.js"
'
echo "$MAC_START" > "$BUILD_DIR/darwin-x64/start.sh" 2>/dev/null || true

echo ""
echo "=== 构建完成 ==="
echo "输出目录: $BUILD_DIR"
