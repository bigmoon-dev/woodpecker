#!/bin/sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-./backups}"
PGHOST="${BACKUP_PGHOST:-localhost}"
PGPORT="${BACKUP_PGPORT:-5432}"
PGUSER="${BACKUP_PGUSER:-postgres}"
PGDATABASE="${BACKUP_PGDATABASE:-psych_scale}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
error() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $*" >&2; exit 1; }

usage() {
  echo "Usage: $0 [--backup <file.dump|latest>] [--target-time <ISO timestamp>]"
  echo ""
  echo "  --backup <file>      Specific backup file (default: latest daily)"
  echo "  --target-time <ts>   Point-in-time recovery target (optional)"
  echo ""
  echo "Examples:"
  echo "  $0                           # Restore latest backup"
  echo "  $0 --backup backups/daily/psych_scale_20260415_020000.dump"
  echo "  $0 --target-time '2026-04-15 14:30:00'"
  exit 0
}

BACKUP_FILE=""
TARGET_TIME=""

while [ $# -gt 0 ]; do
  case "$1" in
    --backup) BACKUP_FILE="$2"; shift 2 ;;
    --target-time) TARGET_TIME="$2"; shift 2 ;;
    --help|-h) usage ;;
    *) error "Unknown option: $1" ;;
  esac
done

# Find latest backup if not specified
if [ -z "$BACKUP_FILE" ]; then
  BACKUP_FILE=$(ls -t "$BACKUP_DIR/daily/"*.dump 2>/dev/null | head -1)
  if [ -z "$BACKUP_FILE" ]; then
    error "No backup files found in $BACKUP_DIR/daily/"
  fi
fi

if [ ! -f "$BACKUP_FILE" ]; then
  error "Backup file not found: $BACKUP_FILE"
fi

# Verify checksum
CHECKSUM_FILE="${BACKUP_FILE}.sha256"
if [ -f "$CHECKSUM_FILE" ]; then
  log "Verifying checksum..."
  sha256sum -c "$CHECKSUM_FILE" || error "Checksum verification failed!"
  log "Checksum OK"
else
  log "WARNING: No checksum file found, skipping verification"
fi

log "============================================"
log "RESTORE PLAN"
log "  Backup file: $BACKUP_FILE"
log "  Target DB:   $PGDATABASE on $PGHOST:$PGPORT"
if [ -n "$TARGET_TIME" ]; then
  log "  Target time: $TARGET_TIME"
fi
log "============================================"
log ""
log "This will DROP the existing database and restore from backup."
read -p "Continue? [y/N] " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
  log "Aborted"
  exit 0
fi

# Stop app (if docker compose)
log "Stopping application..."
docker compose stop app 2>/dev/null || log "No docker compose app to stop"

# Verify backup is restorable
log "Checking backup contents..."
TABLE_COUNT=$(pg_restore --list "$BACKUP_FILE" 2>/dev/null | grep -c "TABLE" || true)
log "Backup contains $TABLE_COUNT tables"

# Drop and recreate database
log "Dropping database $PGDATABASE..."
PGDATABASE=postgres psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$PGDATABASE';" 2>/dev/null || true
dropdb -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" --if-exists "$PGDATABASE" 2>/dev/null || true

log "Creating database $PGDATABASE..."
createdb -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" "$PGDATABASE"

# Restore
log "Restoring from $BACKUP_FILE..."
pg_restore -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" --no-owner --no-privileges "$BACKUP_FILE"

log "Restore completed successfully"

# Restart app
log "Starting application..."
docker compose start app 2>/dev/null || log "Manual app restart required"

log "============================================"
log "RESTORE COMPLETE"
log "============================================"
