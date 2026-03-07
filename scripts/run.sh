#!/usr/bin/env bash
# Start app (frontend + backend if present). Run from app root.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
npm run start
