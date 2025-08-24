#!/usr/bin/env bash
set -euo pipefail

echo "[deploy] building images..."
docker compose build
echo "[deploy] starting services..."
docker compose up -d
echo "[deploy] done"

