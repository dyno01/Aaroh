#!/bin/sh
set -e
export NPM_CONFIG_PRODUCTION=false
export NODE_ENV=development
npm install --prefix client --include=dev
npm run build --prefix client
NODE_ENV=production npm install --prefix server --omit=dev
