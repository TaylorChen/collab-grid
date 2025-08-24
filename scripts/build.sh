#!/usr/bin/env bash
set -euo pipefail

echo "[build] building shared, server, client..."
npm run -w @collab-grid/shared build
npm run -w @collab-grid/server build
npm run -w @collab-grid/client build
echo "[build] done"

