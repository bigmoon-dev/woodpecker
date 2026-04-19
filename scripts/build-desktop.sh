#!/bin/bash
set -e

VERSION=$(node -p "require('./package.json').version")
NODE_VERSION="v20.11.1"
BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="$BASE_DIR/build/desktop"

EP_PKG_linux_x64="@embedded-postgres/linux-x64"
EP_PKG_win32_x64="@embedded-postgres/windows-x64"
EP_PKG_darwin_arm64="@embedded-postgres/darwin-arm64"

download_node() {
  local platform=$1
  local arch=$2
  local ext=$3
  local target_dir="$4"

  local node_platform
  case "$platform" in
    win32) node_platform="win" ;;
    *) node_platform="$platform" ;;
  esac

  local url="https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-${node_platform}-${arch}.${ext}"
  echo "  下载 Node.js ${NODE_VERSION} (${node_platform}-${arch})..."

  mkdir -p "$target_dir"
  if [ "$ext" = "zip" ]; then
    curl -fSL "$url" -o /tmp/wp-node.zip
    unzip -q -o /tmp/wp-node.zip -d /tmp/wp-node-extract
    cp "/tmp/wp-node-extract/node-${NODE_VERSION}-${node_platform}-${arch}/node.exe" "$target_dir/node.exe"
    rm -rf /tmp/wp-node.zip /tmp/wp-node-extract
  else
    curl -fSL "$url" -o /tmp/wp-node.tar.gz
    tar xzf /tmp/wp-node.tar.gz -C /tmp/
    cp "/tmp/node-${NODE_VERSION}-${node_platform}-${arch}/bin/node" "$target_dir/node"
    chmod +x "$target_dir/node"
    rm -rf /tmp/wp-node.tar.gz "/tmp/node-${NODE_VERSION}-${node_platform}-${arch}"
  fi
  echo "  ✅ Node.js 下载完成"
}

build_platform() {
  local platform=$1
  local arch=$2
  local node_ext=$3
  local target="$BUILD_DIR/${platform}-${arch}"

  local ep_var="EP_PKG_${platform}_${arch}"
  local ep_pkg="${!ep_var}"

  echo ""
  echo "=== 构建 ${platform}-${arch} ==="

  rm -rf "$target"
  mkdir -p "$target"

  echo "  复制应用文件..."
  cp -r "$BASE_DIR/dist" "$target/dist"
  cp -r "$BASE_DIR/public" "$target/public"
  cp -r "$BASE_DIR/desktop" "$target/desktop"
  cp "$BASE_DIR/package.json" "$target/package.json"

  echo "  安装生产依赖..."
  cd "$target"
  npm install --omit=dev --ignore-scripts 2>&1 | tail -3

  if [ -n "$ep_pkg" ]; then
    echo "  安装目标平台 PG 二进制 (${ep_pkg})..."
    npm install --no-save --force "$ep_pkg" 2>&1 | tail -3
  fi

  echo "  清理跨平台 PG 二进制..."
  local keep_dir=""
  case "${platform}-${arch}" in
    linux-x64)    keep_dir="linux-x64" ;;
    win32-x64)    keep_dir="windows-x64" ;;
    darwin-arm64) keep_dir="darwin-arm64" ;;
  esac
  if [ -d "$target/node_modules/@embedded-postgres" ]; then
    for d in "$target/node_modules/@embedded-postgres"/*/; do
      local dname
      dname=$(basename "$d")
      [ "$dname" = "$keep_dir" ] || rm -rf "$d"
    done 2>/dev/null || true
  fi

  echo "  下载 Node.js 运行时..."
  download_node "$platform" "$arch" "$node_ext" "$target/node"

  echo "  写入启动脚本..."
  if [ "$platform" = "win32" ]; then
    cat > "$target/start.bat" <<'BATEOF'
@echo off
chcp 65001 >nul 2>&1
title 啄木鸟心理预警辅助系统
"%~dp0node\node.exe" "%~dp0desktop\start-desktop.js"
pause
BATEOF
     sed -i 's/$/\r/' "$target/start.bat"
   else
     cat > "$target/start.sh" <<'SHEOF'
#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
exec "$DIR/node/node" "$DIR/desktop/start-desktop.js"
SHEOF
     chmod +x "$target/start.sh"
   fi

   # Generate OTA config from env var
   if [ -n "$OTA_BASE_URL" ]; then
     echo "{\"baseUrl\":\"$OTA_BASE_URL\"}" > "$target/desktop/ota-config.json"
     echo "  ✅ OTA config generated (baseUrl: $OTA_BASE_URL)"
   fi

  local size
  size=$(du -sh "$target" 2>/dev/null | cut -f1)
  echo "  ✅ ${platform}-${arch} 构建完成 ($size)"

  echo "  打包压缩..."
  local archive_ext="tar.gz"
  local archive_name="woodpecker-v${VERSION}-${platform}-${arch}"
  if [ "$platform" = "win32" ]; then
    archive_ext="zip"
    cd "$target"
    zip -r -q "$BUILD_DIR/${archive_name}.zip" .
    cd "$BASE_DIR"
  else
    tar czf "$BUILD_DIR/${archive_name}.tar.gz" -C "$target" .
  fi
  local archive_size
  archive_size=$(ls -lh "$BUILD_DIR/${archive_name}.${archive_ext}" | awk '{print $5}')
  echo "  ✅ 压缩包: $BUILD_DIR/${archive_name}.${archive_ext} ($archive_size)"
}

mkdir -p "$BUILD_DIR"

if [ "${SKIP_BUILD:-}" != "1" ]; then
  echo "构建前端..."
  cd "$BASE_DIR/client"
  npx vite build 2>&1 | tail -3

  echo "构建后端..."
  cd "$BASE_DIR"
  npm run build 2>&1 | tail -3
fi

TARGET="${1:-all}"
case "$TARGET" in
  linux)    build_platform "linux" "x64" "tar.gz" ;;
  win32)    build_platform "win32" "x64" "zip" ;;
  darwin)   build_platform "darwin" "arm64" "tar.gz" ;;
  all)
    build_platform "linux" "x64" "tar.gz"
    build_platform "win32" "x64" "zip"
    build_platform "darwin" "arm64" "tar.gz"
    ;;
  *) echo "未知目标: $TARGET (可选: linux, win32, darwin, all)"; exit 1 ;;
esac

echo ""
echo "=== 全部构建完成 ==="
echo "输出目录: $BUILD_DIR"
echo ""
du -sh "$BUILD_DIR"/*/
