#!/bin/sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
PGHOST="${PGHOST:-db}"
PGUSER="${PGUSER:-postgres}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

mkdir -p "$BACKUP_DIR/daily" "$BACKUP_DIR/weekly" "$BACKUP_DIR/monthly" "$BACKUP_DIR/wal"

log "Backup sidecar started. Running daily backup at 02:00, WAL archiving continuous."

# Run backup immediately on start for initial backup
/usr/local/bin/backup-script.sh

# Schedule daily at 02:00 via busybox crond
echo "0 2 * * * /usr/local/bin/backup-script.sh" > /etc/crontabs/root

# Start crond in background
crond -b -l 2

# Keep container alive — also handle WAL archiving signals
log "Cron scheduler running. Container ready."
exec sleep infinity
