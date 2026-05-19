#!/bin/bash
source ~/.nvm/nvm.sh
nvm use 20 --silent
cd "$(dirname "$0")"
npm run dev
