/**
 * webhook-deploy.js
 * Lightweight HTTP server that listens for GitHub push webhooks
 * and runs the deploy script automatically.
 *
 * Run with: node webhook-deploy.js
 * Or via PM2: pm2 start webhook-deploy.js --name pettycash-webhook
 */

require('dotenv').config({ path: '/var/www/pettycash.astutehealthcare.co.uk/html/backend/.env' });
const http = require('http');
const crypto = require('crypto');
const { exec } = require('child_process');
const path = require('path');

const PORT = process.env.WEBHOOK_PORT || 9000;
const SECRET = process.env.WEBHOOK_SECRET || '523bbcd190f0c1f0b6eaa1f142da2020b48e5a513f795ac35e9a843593ebbb5f';
const REPO_DIR = '/var/www/pettycash.astutehealthcare.co.uk/html';
const LOG_FILE = path.join(REPO_DIR, 'deploy.log');

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  require('fs').appendFileSync(LOG_FILE, line + '\n');
}

function verifySignature(payload, signature) {
  if (!signature) {
    log('Webhook rejected — no signature header');
    return false;
  }
  const hmac = crypto.createHmac('sha256', SECRET);
  hmac.update(payload);
  const digest = 'sha256=' + hmac.digest('hex');
  log(`Expected: ${digest.slice(0, 20)}... Received: ${signature.slice(0, 20)}...`);
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    return false;
  }
}

function runDeploy(callback) {
  const script = `
    set -e
    cd ${REPO_DIR}
    echo "--- git pull ---"
    git pull origin main
    echo "--- backend install ---"
    cd ${REPO_DIR}/backend && npm install --production
    echo "--- frontend build ---"
    cd ${REPO_DIR}/frontend && npm install && rm -rf dist && npm run build
    echo "--- pm2 restart ---"
    pm2 restart pettycash-backend --update-env
    echo "--- done ---"
  `;
  exec(`bash -c '${script.replace(/'/g, "'\\''")}'`, { timeout: 300000 }, (err, stdout, stderr) => {
    if (err) {
      log('Deploy FAILED: ' + err.message);
      log('stderr: ' + stderr);
    } else {
      log('Deploy SUCCESS');
    }
    log('stdout: ' + stdout);
    if (callback) callback(err);
  });
}

let deploying = false;

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok', deploying }));
    return;
  }

  if (req.method !== 'POST' || req.url !== '/webhook') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    const signature = req.headers['x-hub-signature-256'];

    if (!verifySignature(body, signature)) {
      log('Webhook rejected — invalid signature');
      res.writeHead(401);
      res.end('Unauthorized');
      return;
    }

    let payload;
    try { payload = JSON.parse(body); } catch {
      res.writeHead(400);
      res.end('Bad request');
      return;
    }

    // Only deploy on pushes to main branch
    if (payload.ref !== 'refs/heads/main') {
      res.writeHead(200);
      res.end('Ignored — not main branch');
      return;
    }

    if (deploying) {
      log('Deploy already in progress — queued push ignored');
      res.writeHead(202);
      res.end('Deploy already running');
      return;
    }

    log(`Deploy triggered by push from ${payload.pusher?.name || 'unknown'} — commit: ${payload.after?.slice(0, 7)}`);
    res.writeHead(200);
    res.end('Deploy started');

    deploying = true;
    runDeploy(() => { deploying = false; });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  log(`Webhook server listening on port ${PORT}`);
});
