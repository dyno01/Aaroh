#!/bin/sh
cd "$(dirname "$0")"
if [ ! -d node_modules ]; then
  npm install
fi
if [ ! -f ../client/dist/index.html ]; then
  (cd ../client && npm install && npm run build)
fi
while true; do
  echo "starting Aaroh $(date)"
  node index.js
  echo "Aaroh exited $?, restarting in 1s"
  sleep 1
done
