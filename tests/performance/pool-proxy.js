/**
 * Concurrency Worker Pool & Reverse Proxy (ESM)
 * Mimics Nginx + PHP-FPM pool (pm.max_children = 30) for isolated load testing.
 */

import http from 'http';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKER_COUNT = parseInt(process.env.WORKER_COUNT || '30', 10);
const PROXY_PORT = parseInt(process.env.PROXY_PORT || '8000', 10);
const BASE_WORKER_PORT = parseInt(process.env.BASE_WORKER_PORT || '8101', 10);
const FAIL_FAST_TIMEOUT_MS = 60000; // 60s matching fastcgi_read_timeout

const rootDir = path.resolve(__dirname, '../../');
const backendPublic = path.join(rootDir, 'backend/public');
const indexPhp = path.join(backendPublic, 'index.php');

console.log(`[Proxy] Initializing PHP-FPM Simulation Pool (${WORKER_COUNT} workers)...`);

const workers = [];
for (let i = 0; i < WORKER_COUNT; i++) {
  const port = BASE_WORKER_PORT + i;
  workers.push({
    id: i + 1,
    port,
    busy: false,
    process: null,
    activeRequests: 0,
    totalServed: 0,
  });
}

// Spawn PHP workers with production-grade OPcache bytecode caching
const phpArgs = [
  '-d', 'zend_extension=opcache',
  '-d', 'opcache.enable=1',
  '-d', 'opcache.enable_cli=1',
  '-d', 'opcache.memory_consumption=128',
  '-d', 'opcache.interned_strings_buffer=16',
  '-d', 'opcache.max_accelerated_files=10000',
  '-d', 'opcache.validate_timestamps=0',
];

workers.forEach(w => {
  const child = spawn('php', [...phpArgs, '-S', `127.0.0.1:${w.port}`, '-t', backendPublic, indexPhp], {
    cwd: rootDir,
    stdio: 'ignore',
  });
  w.process = child;
});

console.log(`[Proxy] Spawned ${WORKER_COUNT} PHP workers on ports ${BASE_WORKER_PORT}..${BASE_WORKER_PORT + WORKER_COUNT - 1}`);

const queue = [];
let maxActiveWorkers = 0;
let totalRequests = 0;
let timedOut504 = 0;
let error5xx = 0;

function dispatchNext() {
  if (queue.length === 0) return;

  const idleWorker = workers.find(w => !w.busy);
  if (!idleWorker) return;

  const item = queue.shift();
  forwardToWorker(item.req, item.res, idleWorker, item.timer);
}

function forwardToWorker(req, res, worker, timeoutTimer) {
  worker.busy = true;
  worker.activeRequests++;
  const activeCount = workers.filter(w => w.busy).length;
  if (activeCount > maxActiveWorkers) {
    maxActiveWorkers = activeCount;
  }

  const options = {
    hostname: '127.0.0.1',
    port: worker.port,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: `127.0.0.1:${worker.port}`,
      'x-forwarded-for': req.socket.remoteAddress || '127.0.0.1',
      'x-forwarded-proto': 'http',
    },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    if (timeoutTimer) clearTimeout(timeoutTimer);
    worker.busy = false;
    worker.activeRequests--;
    worker.totalServed++;

    if (proxyRes.statusCode >= 500) {
      error5xx++;
    }

    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });

    proxyRes.on('end', () => {
      setImmediate(dispatchNext);
    });
  });

  proxyReq.on('error', (err) => {
    if (timeoutTimer) clearTimeout(timeoutTimer);
    worker.busy = false;
    worker.activeRequests--;
    error5xx++;
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Bad Gateway: worker error', detail: err.message }));
    }
    setImmediate(dispatchNext);
  });

  req.pipe(proxyReq, { end: true });
}

const server = http.createServer((req, res) => {
  totalRequests++;

  // Internal metrics endpoint
  if (req.url === '/__proxy_status') {
    const active = workers.filter(w => w.busy).length;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      workerCount: WORKER_COUNT,
      activeWorkers: active,
      idleWorkers: WORKER_COUNT - active,
      queuedRequests: queue.length,
      maxActiveWorkers,
      totalRequests,
      timedOut504,
      error5xx,
    }));
  }

  // Set fail-fast timeout (matching fastcgi_read_timeout 60s)
  const timer = setTimeout(() => {
    timedOut504++;
    // Remove from queue if still queued
    const idx = queue.findIndex(item => item.req === req);
    if (idx !== -1) queue.splice(idx, 1);

    if (!res.headersSent) {
      res.writeHead(504, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: '504 Gateway Timeout',
        message: `Upstream worker failed to respond within ${FAIL_FAST_TIMEOUT_MS / 1000}s`,
      }));
    }
  }, FAIL_FAST_TIMEOUT_MS);

  const idleWorker = workers.find(w => !w.busy);
  if (idleWorker && queue.length === 0) {
    forwardToWorker(req, res, idleWorker, timer);
  } else {
    queue.push({ req, res, timer });
  }
});

server.listen(PROXY_PORT, '127.0.0.1', () => {
  console.log(`[Proxy] Load-balancer listening on http://127.0.0.1:${PROXY_PORT}`);
});

function cleanup() {
  console.log('\n[Proxy] Shutting down worker processes...');
  workers.forEach(w => {
    if (w.process) {
      try { w.process.kill(); } catch (e) {}
    }
  });
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);
