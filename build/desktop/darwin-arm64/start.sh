#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
exec "$DIR/node/node" "$DIR/desktop/start-desktop.js"
