#!/bin/sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
PGHOST="${PGHOST:-db}"
PGUSER="${PGUSER:-postgres}"
PGDATABASE="${PGDATABASE:-psych_scale}"
DAILY_KEEP=${DAILY_KEEP:-7}
WEEKLY_KEEP=${WEEKLY_KEEP:-4}
MONTHLY_KEEP=${MONTHLY_KEEP:-12}

NOW=$(date +%Y%m%d_%H%M%S)
DAY=$(date +%u)
DOM=$(date +%d)

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

mkdir -p "$BACKUP_DIR/daily" "$BACKUP_DIR/weekly" "$BACKUP_DIR/monthly" "$BACKUP_DIR/wal"

log "Starting backup for $PGDATABASE"

# Full backup
DUMP_FILE="$BACKUP_DIR/daily/${PGDATABASE}_${NOW}.dump"
log "Running pg_dump -> $DUMP_FILE"
pg_dump -Fc -h "$PGHOST" -U "$PGUSER" "$PGDATABASE" -f "$DUMP_FILE"

# Verify backup
log "Verifying backup integrity..."
pg_restore --list "$DUMP_FILE" > /dev/null 2>&1
log "Backup verified: $DUMP_FILE"

# SHA256 checksum
CHECKSUM=$(sha256sum "$DUMP_FILE" | cut -d' ' -f1)
echo "$CHECKSUM  $DUMP_FILE" > "${DUMP_FILE}.sha256"
log "Checksum: $CHECKSUM"

chmod 600 "$DUMP_FILE" "${DUMP_FILE}.sha256"

# Weekly copy (Sunday = day 7)
if [ "$DAY" = "7" ]; then
  cp "$DUMP_FILE" "$BACKUP_DIR/weekly/"
  cp "${DUMP_FILE}.sha256" "$BACKUP_DIR/weekly/"
  log "Weekly backup created"
fi

# Monthly copy (1st of month)
if [ "$DOM" = "01" ]; then
  cp "$DUMP_FILE" "$BACKUP_DIR/monthly/"
  cp "${DUMP_FILE}.sha256" "$BACKUP_DIR/monthly/"
  log "Monthly backup created"
fi

# Retention cleanup
log "Cleaning old daily backups (keep $DAILY_KEEP)..."
ls -t "$BACKUP_DIR/daily/"*.dump 2>/dev/null | tail -n +"$((DAILY_KEEP + 1))" | xargs rm -f 2>/dev/null || true

log "Cleaning old weekly backups (keep $WEEKLY_KEEP)..."
ls -t "$BACKUP_DIR/weekly/"*.dump 2>/dev/null | tail -n +"$((WEEKLY_KEEP + 1))" | xargs rm -f 2>/dev/null || true

log "Cleaning old monthly backups (keep $MONTHLY_KEEP)..."
ls -t "$BACKUP_DIR/monthly/"*.dump 2>/dev/null | tail -n +"$((MONTHLY_KEEP + 1))" | xargs rm -f 2>/dev/null || true

log "Cleaning old WAL segments (keep 7 days)..."
find "$BACKUP_DIR/wal" -type f -mtime +7 -delete 2>/dev/null || true

log "Backup completed successfully"
