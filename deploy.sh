#!/bin/bash
# Auto-deploy script — run this on the server to pull latest and rebuild
set -e

echo "======================================"
echo " PocketPro HR — Deploy Script"
echo " $(date)"
echo "======================================"

cd /home/azureadmin/Petty-Cash-Management

echo ""
echo ">>> Pulling latest code from GitHub..."
git pull origin main

echo ""
echo ">>> Installing backend dependencies..."
cd /home/azureadmin/Petty-Cash-Management/backend
npm install --production

echo ""
echo ">>> Building frontend..."
cd /home/azureadmin/Petty-Cash-Management/frontend
npm install
rm -rf dist
npm run build

echo ""
echo ">>> Restarting backend..."
pm2 restart pettycash-backend --update-env

echo ""
echo ">>> Verifying deployment..."
sleep 2
BUNDLE=$(curl -s http://127.0.0.1:5176/ | grep -o 'index-[^"]*\.js' | head -1)
echo "Serving bundle: $BUNDLE"

echo ""
echo "======================================"
echo " Deploy complete! Site is live at:"
echo " http://103.206.209.210:5176"
echo "======================================"
