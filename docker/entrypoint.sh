#!/bin/sh
set -e

ROLE="${ROLE:-api}"

case "$ROLE" in
  api)
    node apps/api/src/index.js
    ;;
  worker)
    node apps/worker/src/index.js
    ;;
  web)
    npm run start --no-workspaces --prefix apps/web
    ;;
  *)
    echo "Unknown ROLE: $ROLE"
    exit 1
    ;;
esac
