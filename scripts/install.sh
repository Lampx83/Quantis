#!/usr/bin/env bash
# Install dependencies (frontend + backend if present). Run from app root.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
npm run install:all
