/**
 * SIMMACI SEC-PERF-002: Comprehensive Load, Concurrency & Resilience Test Suite
 */

import http from 'http';
import { execSync } from 'child_process';

const TARGET_HOST = '127.0.0.1';
const TARGET_PORT = 8000;
const BASE_URL = `http://${TARGET_HOST}:${TARGET_PORT}`;

// Fetch auth token
let AUTH_TOKEN = '';
try {
  const tokenOutput = execSync('php scratch/test_token.php', { encoding: 'utf-8' });
  const match = tokenOutput.match(/TOKEN:(.+)/);
  if (match) {
    AUTH_TOKEN = match[1].trim();
  }
} catch (e) {
  console.warn('Could not auto-fetch token from scratch/test_token.php:', e.message);
}

console.log(`[LoadTest] Target: ${BASE_URL}`);
console.log(`[LoadTest] Auth Token: ${AUTH_TOKEN ? AUTH_TOKEN.substring(0, 15) + '...' : 'NONE'}`);

// HTTP Agent with keep-alive
const keepAliveAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 300,
  maxFreeSockets: 50,
  timeout: 65000,
});

/**
 * Perform a single HTTP request and record latency & status
 */
function makeRequest(path, method = 'GET', body = null, extraHeaders = {}) {
  return new Promise((resolve) => {
    const startTime = process.hrtime.bigint();
    const headers = {
      Accept: 'application/json',
      Connection: 'keep-alive',
      ...extraHeaders,
    };
    if (AUTH_TOKEN) {
      headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
    }
    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    const req = http.request(
      {
        hostname: TARGET_HOST,
        port: TARGET_PORT,
        path,
        method,
        headers,
        agent: keepAliveAgent,
        timeout: 62000,
      },
      (res) => {
        let responseBody = '';
        res.on('data', (chunk) => {
          responseBody += chunk;
        });
        res.on('end', () => {
          const endTime = process.hrtime.bigint();
          const durationMs = Number(endTime - startTime) / 1e6;
          resolve({
            status: res.statusCode,
            durationMs,
            success: res.statusCode >= 200 && res.statusCode < 400,
            bodyLength: responseBody.length,
          });
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1e6;
      resolve({
        status: 504,
        durationMs,
        success: false,
        error: 'ClientTimeout',
      });
    });

    req.on('error', (err) => {
      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1e6;
      resolve({
        status: 502,
        durationMs,
        success: false,
        error: err.message,
      });
    });

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

/**
 * Calculate statistical percentiles
 */
function calculateStats(durations) {
  if (durations.length === 0) return { p50: 0, p90: 0, p95: 0, p99: 0, avg: 0, max: 0, min: 0 };
  const sorted = [...durations].sort((a, b) => a - b);
  const percentile = (p) => sorted[Math.min(Math.floor((p / 100) * sorted.length), sorted.length - 1)];
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  return {
    min: sorted[0],
    p50: percentile(50),
    p90: percentile(90),
    p95: percentile(95),
    p99: percentile(99),
    max: sorted[sorted.length - 1],
    avg: sum / sorted.length,
  };
}

/**
 * Sample real-time proxy metrics
 */
async function getProxyMetrics() {
  return new Promise((resolve) => {
    http.get(`http://${TARGET_HOST}:${TARGET_PORT}/__proxy_status`, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

/**
 * Sample PostgreSQL activity stats
 */
function getDbStats() {
  try {
    const raw = execSync('php scratch/check_db_connections.php', { encoding: 'utf-8' });
    return JSON.parse(raw.trim());
  } catch {
    return { total: 0, active: 0, idle: 0 };
  }
}

/**
 * Run a concurrency test for a given number of VUs and duration
 */
async function runConcurrencyLadderStep(vuCount, durationSeconds, requestGenerator) {
  const endTime = Date.now() + durationSeconds * 1000;
  const results = [];
  const statusCounts = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0, '502': 0, '504': 0 };

  async function workerLoop() {
    while (Date.now() < endTime) {
      const reqConfig = requestGenerator();
      const res = await makeRequest(reqConfig.path, reqConfig.method, reqConfig.body);
      results.push(res);

      if (res.status >= 200 && res.status < 300) statusCounts['2xx']++;
      else if (res.status >= 300 && res.status < 400) statusCounts['3xx']++;
      else if (res.status >= 400 && res.status < 500) statusCounts['4xx']++;
      else if (res.status >= 500) {
        statusCounts['5xx']++;
        if (res.status === 502) statusCounts['502']++;
        if (res.status === 504) statusCounts['504']++;
      }
    }
  }

  // Launch VU workers
  const vuPromises = [];
  for (let i = 0; i < vuCount; i++) {
    vuPromises.push(workerLoop());
  }

  // Periodic sampler
  const proxyMetricsList = [];
  const dbMetricsList = [];
  const sampleInterval = setInterval(async () => {
    const pm = await getProxyMetrics();
    if (pm) proxyMetricsList.push(pm);
    dbMetricsList.push(getDbStats());
  }, 1000);

  await Promise.all(vuPromises);
  clearInterval(sampleInterval);

  const durations = results.map((r) => r.durationMs);
  const stats = calculateStats(durations);
  const rps = (results.length / durationSeconds).toFixed(1);

  const maxWorkers = proxyMetricsList.reduce((acc, p) => Math.max(acc, p.activeWorkers), 0);
  const maxDb = dbMetricsList.reduce((acc, d) => Math.max(acc, parseInt(d.total || '0', 10)), 0);

  return {
    vuCount,
    totalRequests: results.length,
    rps,
    stats,
    statusCounts,
    maxWorkers,
    maxDb,
  };
}

export {
  makeRequest,
  calculateStats,
  getProxyMetrics,
  getDbStats,
  runConcurrencyLadderStep,
  BASE_URL,
};
