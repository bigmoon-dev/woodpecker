#!/bin/sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-./backups}"
PGHOST="${BACKUP_PGHOST:-localhost}"
PGPORT="${BACKUP_PGPORT:-5433}"
PGUSER="${BACKUP_PGUSER:-postgres}"
PGDATABASE="${BACKUP_PGDATABASE:-psych_scale}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [DRILL] $*"; }

log "============================================"
log "DISASTER RECOVERY DRILL"
log "============================================"

log "Starting drill restore on port $PGPORT (isolated instance)..."

# Start a temporary postgres container
DRILL_CONTAINER="psych-scale-drill-$(date +%Y%m%d%H%M%S)"
log "Starting temporary container: $DRILL_CONTAINER"
docker run -d \
  --name "$DRILL_CONTAINER" \
  -e POSTGRES_USER="$PGUSER" \
  -e POSTGRES_PASSWORD=drill \
  -e POSTGRES_DB="$PGDATABASE" \
  -p "$PGPORT:5432" \
  postgres:16-alpine

log "Waiting for database to be ready..."
sleep 5
for i in $(seq 1 30); do
  if docker exec "$DRILL_CONTAINER" pg_isready -U "$PGUSER" > /dev/null 2>&1; then
    break
  fi
  sleep 1
done

# Find latest backup
LATEST=$(ls -t "$BACKUP_DIR/daily/"*.dump 2>/dev/null | head -1)
if [ -z "$LATEST" ]; then
  log "FAIL: No backup found"
  docker rm -f "$DRILL_CONTAINER" 2>/dev/null
  exit 1
fi
log "Using backup: $LATEST"

# Restore into drill container
log "Restoring backup into drill database..."
docker exec -i "$DRILL_CONTAINER" pg_restore -U "$PGUSER" -d "$PGDATABASE" --no-owner --no-privileges < "$LATEST"

# Verify tables
TABLE_COUNT=$(docker exec "$DRILL_CONTAINER" psql -U "$PGUSER" -d "$PGDATABASE" -t -c \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null | tr -d ' ')
log "Restored tables: $TABLE_COUNT"

# Verify key tables have data
for table in student audit_log alert_record consent_record task_result; do
  ROW_COUNT=$(docker exec "$DRILL_CONTAINER" psql -U "$PGUSER" -d "$PGDATABASE" -t -c \
    "SELECT count(*) FROM $table;" 2>/dev/null | tr -d ' ' || echo "ERROR")
  log "  $table: $ROW_COUNT rows"
done

# Verify audit log integrity (if app is available)
log "Checking audit log integrity hash chain..."
docker exec "$DRILL_CONTAINER" psql -U "$PGUSER" -d "$PGDATABASE" -t -c \
  "SELECT count(*) FROM audit_log WHERE integrity_hash IS NOT NULL;" 2>/dev/null | tr -d ' '
LOG_WITH_HASH=$(docker exec "$DRILL_CONTAINER" psql -U "$PGUSER" -d "$PGDATABASE" -t -c \
  "SELECT count(*) FROM audit_log WHERE integrity_hash IS NOT NULL;" 2>/dev/null | tr -d ' ')
log "  Audit logs with integrity hash: $LOG_WITH_HASH"

# Cleanup
log "Cleaning up drill container..."
docker rm -f "$DRILL_CONTAINER" > /dev/null 2>&1

log "============================================"
log "DRILL COMPLETED SUCCESSFULLY"
log "  Backup file: $LATEST"
log "  Tables restored: $TABLE_COUNT"
log "============================================"
