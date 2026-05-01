#!/bin/bash
# Deploy script — run this on the Azure server to pull latest code and rebuild
# Usage: bash deploy.sh
set -e

REPO_DIR="/home/azureadmin/Petty-Cash-Management"
BACKEND_DIR="$REPO_DIR/backend"
FRONTEND_DIR="$REPO_DIR/frontend"
PM2_APP="pettycash-backend"
BACKEND_PORT=5177

echo "======================================"
echo " PocketPro HR — Deploy Script"
echo " $(date)"
echo "======================================"

# ── 1. Pull latest code ───────────────────────────────────────────────────
echo ""
echo ">>> Pulling latest code from GitHub..."
cd "$REPO_DIR"
git pull origin main

# ── 2. Backend dependencies ───────────────────────────────────────────────
echo ""
echo ">>> Installing backend dependencies..."
cd "$BACKEND_DIR"
npm install --production

# ── 3. Build frontend ─────────────────────────────────────────────────────
echo ""
echo ">>> Building frontend..."
cd "$FRONTEND_DIR"
npm install
rm -rf dist
npm run build

echo ">>> Frontend build complete. Bundle size:"
du -sh dist/

# ── 4. Restart backend via PM2 ────────────────────────────────────────────
echo ""
echo ">>> Restarting backend (PM2)..."
if pm2 describe "$PM2_APP" > /dev/null 2>&1; then
  pm2 restart "$PM2_APP" --update-env
else
  # First-time setup: start the app
  cd "$BACKEND_DIR"
  pm2 start server.js --name "$PM2_APP" --update-env
fi
pm2 save

# ── 5. Verify ─────────────────────────────────────────────────────────────
echo ""
echo ">>> Verifying deployment..."
sleep 3

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$BACKEND_PORT/api/health" 2>/dev/null || echo "000")
if [ "$HTTP_STATUS" = "200" ]; then
  echo "✅ Backend health check passed (HTTP $HTTP_STATUS)"
else
  echo "⚠️  Backend health check returned HTTP $HTTP_STATUS — check pm2 logs"
fi

BUNDLE=$(curl -s "http://127.0.0.1:$BACKEND_PORT/" 2>/dev/null | grep -o 'index-[^"]*\.js' | head -1)
if [ -n "$BUNDLE" ]; then
  echo "✅ Serving frontend bundle: $BUNDLE"
else
  echo "⚠️  Could not detect frontend bundle — check that dist/ was built"
fi

echo ""
echo "======================================"
echo " Deploy complete!"
echo " Live at: https://pettycash.astutehealthcare.co.uk"
echo "======================================"
