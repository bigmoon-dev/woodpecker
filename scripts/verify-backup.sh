#!/bin/sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-./backups}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
fail=0

usage() {
  echo "Usage: $0 [--backup <file.dump>] [--all]"
  echo ""
  echo "  --backup <file>   Verify a specific backup file"
  echo "  --all             Verify all daily backups"
  exit 0
}

verify_one() {
  file="$1"
  log "Verifying: $file"

  if [ ! -f "$file" ]; then
    log "  FAIL: File not found"
    fail=$((fail + 1))
    return
  fi

  # Check file size > 0
  size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo 0)
  if [ "$size" -eq 0 ]; then
    log "  FAIL: Empty file"
    fail=$((fail + 1))
    return
  fi
  log "  Size: $size bytes"

  # Verify checksum
  checksum_file="${file}.sha256"
  if [ -f "$checksum_file" ]; then
    if sha256sum -c "$checksum_file" > /dev/null 2>&1; then
      log "  Checksum: OK"
    else
      log "  FAIL: Checksum mismatch"
      fail=$((fail + 1))
      return
    fi
  else
    log "  WARNING: No checksum file"
  fi

  # Verify pg_restore can read it
  if pg_restore --list "$file" > /dev/null 2>&1; then
    table_count=$(pg_restore --list "$file" 2>/dev/null | grep -c "TABLE" || echo "?")
    log "  pg_restore: OK ($table_count tables)"
  else
    log "  FAIL: pg_restore --list failed"
    fail=$((fail + 1))
    return
  fi

  log "  PASS"
}

TARGET=""
ALL=false

while [ $# -gt 0 ]; do
  case "$1" in
    --backup) TARGET="$2"; shift 2 ;;
    --all) ALL=true; shift ;;
    --help|-h) usage ;;
    *) echo "Unknown option: $1"; usage ;;
  esac
done

log "============================================"
log "BACKUP VERIFICATION"
log "============================================"

if [ -n "$TARGET" ]; then
  verify_one "$TARGET"
elif [ "$ALL" = true ]; then
  for f in "$BACKUP_DIR/daily/"*.dump "$BACKUP_DIR/weekly/"*.dump "$BACKUP_DIR/monthly/"*.dump; do
    if [ -f "$f" ]; then
      verify_one "$f"
      echo ""
    fi
  done
else
  LATEST=$(ls -t "$BACKUP_DIR/daily/"*.dump 2>/dev/null | head -1)
  if [ -z "$LATEST" ]; then
    log "No backups found in $BACKUP_DIR/daily/"
    exit 1
  fi
  verify_one "$LATEST"
fi

log "============================================"
if [ "$fail" -eq 0 ]; then
  log "ALL CHECKS PASSED"
else
  log "$fail CHECK(S) FAILED"
  exit 1
fi
