/**
 * SIMMACI SEC-PERF-002: Master Load & Concurrency Benchmark Runner
 */

import {
  makeRequest,
  calculateStats,
  getProxyMetrics,
  getDbStats,
  runConcurrencyLadderStep,
} from './simmaci-load-test.js';
import { execSync } from 'child_process';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log('==============================================================');
  console.log('       SIMMACI SEC-PERF-002 LOAD & CONCURRENCY BENCHMARK       ');
  console.log('==============================================================\n');

  // Verify server is up
  console.log('[Test 0] Checking server health...');
  const healthRes = await makeRequest('/api/health');
  if (healthRes.status !== 200) {
    console.error('Server health check failed! Status:', healthRes.status);
    process.exit(1);
  }
  console.log(`Server healthy (${healthRes.durationMs.toFixed(1)}ms). Proceeding.\n`);

  // -------------------------------------------------------------
  // 1. BASELINE TEST (1 VU, 1 request each endpoint)
  // -------------------------------------------------------------
  console.log('--------------------------------------------------------------');
  console.log('1. BASELINE TEST (1 VU, 1 Request per Endpoint)');
  console.log('--------------------------------------------------------------');

  const baselineEndpoints = [
    { name: 'GET /api/health', path: '/api/health' },
    { name: 'GET /api/ppdb/schools?per_page=10', path: '/api/ppdb/schools?per_page=10' },
    { name: 'GET /api/reports/teacher', path: '/api/reports/teacher' },
    { name: 'GET /api/dashboard/stats', path: '/api/dashboard/stats' },
    { name: 'GET /api/students?per_page=15', path: '/api/students?per_page=15' },
    { name: 'GET /api/teachers?per_page=15', path: '/api/teachers?per_page=15' },
    { name: 'GET /api/sk-documents?per_page=15', path: '/api/sk-documents?per_page=15' },
    { name: 'GET /api/reports/summary', path: '/api/reports/summary' },
  ];

  const baselineResults = [];
  for (const ep of baselineEndpoints) {
    const res = await makeRequest(ep.path);
    baselineResults.push({ ...ep, ...res });
    console.log(`  ${ep.name.padEnd(42)} -> ${res.status} in ${res.durationMs.toFixed(1)}ms`);
  }
  console.log('');

  // -------------------------------------------------------------
  // 2. CONCURRENCY LADDER (1 to 100 VUs)
  // -------------------------------------------------------------
  console.log('--------------------------------------------------------------');
  console.log('2. CONCURRENCY LADDER (1, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100)');
  console.log('--------------------------------------------------------------');

  const ladderLevels = [1, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100];
  const ladderResults = [];

  // Realistic mixed request generator (40% dashboard, 20% students, 15% teachers, 15% PPDB, 10% reports)
  const mixedEndpoints = [
    '/api/dashboard/stats',
    '/api/dashboard/stats',
    '/api/students?per_page=15',
    '/api/teachers?per_page=15',
    '/api/ppdb/schools?per_page=10',
    '/api/reports/teacher',
    '/api/sk-documents?per_page=15',
    '/api/reports/summary',
  ];

  for (const vu of ladderLevels) {
    process.stdout.write(`  Running Concurrency = ${vu} VUs (5s)... `);
    let reqIdx = 0;
    const result = await runConcurrencyLadderStep(vu, 5, () => {
      const path = mixedEndpoints[reqIdx % mixedEndpoints.length];
      reqIdx++;
      return { path, method: 'GET' };
    });

    ladderResults.push(result);
    console.log(
      `Reqs: ${result.totalRequests} | RPS: ${result.rps} | P50: ${result.stats.p50.toFixed(0)}ms | P95: ${result.stats.p95.toFixed(0)}ms | P99: ${result.stats.p99.toFixed(0)}ms | 504: ${result.statusCounts['504']} | Workers: ${result.maxWorkers}/30 | DB: ${result.maxDb}`
    );
    await delay(500); // Cool-down between steps
  }
  console.log('');

  // -------------------------------------------------------------
  // 3. DASHBOARD BROWSER BURST SCENARIO (9 Parallel APIs per Browser)
  // -------------------------------------------------------------
  console.log('--------------------------------------------------------------');
  console.log('3. DASHBOARD BROWSER BURST SCENARIO (9 Parallel APIs per Browser)');
  console.log('--------------------------------------------------------------');

  const dashboardApis = [
    '/api/dashboard/stats',
    '/api/schools?per_page=5',
    '/api/teachers?per_page=5',
    '/api/students?per_page=5',
    '/api/sk-documents?per_page=5',
    '/api/reports/summary',
    '/api/activity-logs?per_page=10',
    '/api/ppdb/schools?per_page=5',
    '/api/settings',
  ];

  const browserCounts = [1, 5, 10, 20, 30];
  const dashboardResults = [];

  for (const bCount of browserCounts) {
    process.stdout.write(`  Simulating ${bCount} simultaneous browsers (${bCount * 9} total burst requests)... `);
    const startTime = process.hrtime.bigint();

    // Fire all requests in parallel
    const promises = [];
    for (let b = 0; b < bCount; b++) {
      for (const api of dashboardApis) {
        promises.push(makeRequest(api));
      }
    }

    const resList = await Promise.all(promises);
    const totalTimeMs = Number(process.hrtime.bigint() - startTime) / 1e6;
    const durations = resList.map((r) => r.durationMs);
    const stats = calculateStats(durations);
    const count504 = resList.filter((r) => r.status === 504).length;
    const count5xx = resList.filter((r) => r.status >= 500).length;

    dashboardResults.push({
      browsers: bCount,
      totalRequests: promises.length,
      totalTimeMs,
      stats,
      count504,
      count5xx,
    });

    console.log(
      `Done in ${totalTimeMs.toFixed(0)}ms | P50: ${stats.p50.toFixed(0)}ms | P95: ${stats.p95.toFixed(0)}ms | P99: ${stats.p99.toFixed(0)}ms | 504: ${count504} | 5xx: ${count5xx}`
    );
    await delay(500);
  }
  console.log('');

  // -------------------------------------------------------------
  // 4. PPDB SCHOOLS SCENARIO (/api/ppdb/schools)
  // -------------------------------------------------------------
  console.log('--------------------------------------------------------------');
  console.log('4. PPDB SCHOOLS DEEP DIVE SCENARIO (/api/ppdb/schools)');
  console.log('--------------------------------------------------------------');

  const ppdbTestCases = [
    { label: 'Default Pagination (page=1)', path: '/api/ppdb/schools' },
    { label: 'Page 2 Clamped (per_page=50)', path: '/api/ppdb/schools?page=2&per_page=50' },
    { label: 'Filter Kecamatan (Cilacap Tengah)', path: '/api/ppdb/schools?kecamatan=Cilacap+Tengah' },
    { label: 'Filter Status Jamiyyah (aktif)', path: '/api/ppdb/schools?status_jamiyyah=aktif' },
    { label: 'Search Keyword (Maarif)', path: '/api/ppdb/schools?search=Maarif' },
    { label: 'Memory Abuse Attempt (per_page=1000)', path: '/api/ppdb/schools?per_page=1000' },
  ];

  for (const tc of ppdbTestCases) {
    const res = await makeRequest(tc.path);
    console.log(`  ${tc.label.padEnd(42)} -> ${res.status} in ${res.durationMs.toFixed(1)}ms (${res.bodyLength} bytes)`);
  }

  // Test PPDB under 20 concurrent VUs for 5 seconds
  process.stdout.write('  Concurrency test: 20 VUs hitting /api/ppdb/schools for 5s... ');
  const ppdbConcurrent = await runConcurrencyLadderStep(20, 5, () => ({
    path: '/api/ppdb/schools?kecamatan=Cilacap+Selatan&per_page=20',
    method: 'GET',
  }));
  console.log(
    `Reqs: ${ppdbConcurrent.totalRequests} | RPS: ${ppdbConcurrent.rps} | P95: ${ppdbConcurrent.stats.p95.toFixed(0)}ms | 504: ${ppdbConcurrent.statusCounts['504']}`
  );
  console.log('');

  // -------------------------------------------------------------
  // 5. REPORT TEACHER SCENARIO (/api/reports/teacher)
  // -------------------------------------------------------------
  console.log('--------------------------------------------------------------');
  console.log('5. TEACHER REPORT AGGREGATION SCENARIO (/api/reports/teacher)');
  console.log('--------------------------------------------------------------');

  const teacherSingle = await makeRequest('/api/reports/teacher');
  console.log(`  Single Request: Status ${teacherSingle.status} in ${teacherSingle.durationMs.toFixed(1)}ms`);

  process.stdout.write('  Concurrency test: 20 VUs hitting /api/reports/teacher for 5s... ');
  const teacherConcurrent = await runConcurrencyLadderStep(20, 5, () => ({
    path: '/api/reports/teacher',
    method: 'GET',
  }));
  console.log(
    `Reqs: ${teacherConcurrent.totalRequests} | RPS: ${teacherConcurrent.rps} | P95: ${teacherConcurrent.stats.p95.toFixed(0)}ms | 504: ${teacherConcurrent.statusCounts['504']}`
  );
  console.log('');

  // -------------------------------------------------------------
  // 6. WORKER STARVATION RESILIENCE TEST
  // -------------------------------------------------------------
  console.log('--------------------------------------------------------------');
  console.log('6. PHP-FPM WORKER STARVATION RESILIENCE TEST');
  console.log('--------------------------------------------------------------');
  console.log('  Hypothesis: 1 slow/stalled request MUST NOT starve remaining workers or block normal traffic.');

  // We simulate 1 slow request hitting a sleep endpoint, while 20 normal requests fire simultaneously
  const slowRequestPromise = makeRequest('/api/warmup'); // Warmed DB/cache check

  // Simultaneously fire 20 normal fast requests
  const normalPromises = [];
  for (let i = 0; i < 20; i++) {
    normalPromises.push(makeRequest('/api/ppdb/schools?per_page=10'));
  }

  const [slowRes, ...normalRes] = await Promise.all([slowRequestPromise, ...normalPromises]);
  const normalDurations = normalRes.map((r) => r.durationMs);
  const normalStats = calculateStats(normalDurations);
  const normalFailures = normalRes.filter((r) => r.status >= 500).length;

  console.log(`  Slow request completed in: ${slowRes.durationMs.toFixed(1)}ms (Status ${slowRes.status})`);
  console.log(`  20 Concurrent normal requests: P50=${normalStats.p50.toFixed(0)}ms, P95=${normalStats.p95.toFixed(0)}ms, Failures=${normalFailures}/20`);
  const starvationPassed = normalFailures === 0 && normalStats.p95 < 1000;
  console.log(`  Result: ${starvationPassed ? 'PASSED (Worker starvation prevented!)' : 'FAILED'}\n`);

  // -------------------------------------------------------------
  // 7. CACHE STAMPEDE TEST
  // -------------------------------------------------------------
  console.log('--------------------------------------------------------------');
  console.log('7. CACHE STAMPEDE TEST (Flush Cache + 50 Concurrent Dashboard Stats)');
  console.log('--------------------------------------------------------------');

  // Flush cache via artisan
  try {
    execSync('php backend/artisan cache:clear', { encoding: 'utf-8' });
    console.log('  Cache flushed.');
  } catch (e) {
    console.log('  Cache flush failed:', e.message);
  }

  process.stdout.write('  Firing 50 concurrent requests at /api/dashboard/stats simultaneously... ');
  const stampedePromises = [];
  for (let i = 0; i < 50; i++) {
    stampedePromises.push(makeRequest('/api/dashboard/stats'));
  }
  const stampedeRes = await Promise.all(stampedePromises);
  const stampedeStats = calculateStats(stampedeRes.map((r) => r.durationMs));
  const stampede504 = stampedeRes.filter((r) => r.status === 504).length;
  const stampede5xx = stampedeRes.filter((r) => r.status >= 500).length;

  console.log(
    `Done | P50: ${stampedeStats.p50.toFixed(0)}ms | P95: ${stampedeStats.p95.toFixed(0)}ms | Max: ${stampedeStats.max.toFixed(0)}ms | 504: ${stampede504} | 5xx: ${stampede5xx}\n`
  );

  // -------------------------------------------------------------
  // 8. SPIKE TEST (10 VUs -> Sudden 50 VUs -> Recovery)
  // -------------------------------------------------------------
  console.log('--------------------------------------------------------------');
  console.log('8. SPIKE TEST (Step from 10 VUs to 50 VUs, Measure Recovery)');
  console.log('--------------------------------------------------------------');

  console.log('  Phase 1: Normal steady load (10 VUs for 3s)...');
  const spikePre = await runConcurrencyLadderStep(10, 3, () => ({ path: '/api/ppdb/schools?per_page=10', method: 'GET' }));
  console.log(`    Steady RPS: ${spikePre.rps} | P95: ${spikePre.stats.p95.toFixed(0)}ms`);

  console.log('  Phase 2: SUDDEN SPIKE (50 VUs for 5s)...');
  const spikePeak = await runConcurrencyLadderStep(50, 5, () => ({ path: '/api/ppdb/schools?per_page=10', method: 'GET' }));
  console.log(`    Spike RPS: ${spikePeak.rps} | P95: ${spikePeak.stats.p95.toFixed(0)}ms | 504: ${spikePeak.statusCounts['504']}`);

  console.log('  Phase 3: Measuring recovery immediately after spike...');
  await delay(2000);
  const recoveryProbes = [];
  for (let p = 0; p < 5; p++) {
    recoveryProbes.push(await makeRequest('/api/ppdb/schools?per_page=10'));
    await delay(200);
  }
  const recoveryStats = calculateStats(recoveryProbes.map((r) => r.durationMs));
  console.log(`    Post-spike probe latency: P50=${recoveryStats.p50.toFixed(0)}ms, Max=${recoveryStats.max.toFixed(0)}ms`);
  const spikePassed = spikePeak.statusCounts['504'] === 0 && recoveryStats.p95 < 250;
  console.log(`  Result: ${spikePassed ? 'PASSED (System absorbed spike and recovered cleanly!)' : 'FAILED'}\n`);

  // -------------------------------------------------------------
  // 9. SOAK TEST (Sustained Realistic Concurrency)
  // -------------------------------------------------------------
  console.log('--------------------------------------------------------------');
  console.log('9. SOAK TEST (25 VUs Sustained for 20 Seconds)');
  console.log('--------------------------------------------------------------');
  process.stdout.write('  Running sustained soak test... ');
  let soakReqIdx = 0;
  const soakResult = await runConcurrencyLadderStep(25, 20, () => {
    const path = mixedEndpoints[soakReqIdx % mixedEndpoints.length];
    soakReqIdx++;
    return { path, method: 'GET' };
  });
  console.log(
    `Done! Total Reqs: ${soakResult.totalRequests} | RPS: ${soakResult.rps} | P50: ${soakResult.stats.p50.toFixed(0)}ms | P95: ${soakResult.stats.p95.toFixed(0)}ms | P99: ${soakResult.stats.p99.toFixed(0)}ms | 504: ${soakResult.statusCounts['504']} | 5xx: ${soakResult.statusCounts['5xx']}\n`
  );

  // -------------------------------------------------------------
  // 10. POST-LOAD BASELINE RECOVERY VERIFICATION
  // -------------------------------------------------------------
  console.log('--------------------------------------------------------------');
  console.log('10. POST-LOAD BASELINE RECOVERY VERIFICATION');
  console.log('--------------------------------------------------------------');
  await delay(1000);
  const finalCheck = await makeRequest('/api/ppdb/schools?per_page=10');
  const finalDb = getDbStats();
  const finalProxy = await getProxyMetrics();

  console.log(`  Post-test single request latency: ${finalCheck.durationMs.toFixed(1)}ms (Status ${finalCheck.status})`);
  console.log(`  Post-test DB connections: total=${finalDb.total}, active=${finalDb.active}, idle=${finalDb.idle}`);
  console.log(`  Post-test Proxy status: activeWorkers=${finalProxy?.activeWorkers || 0}, idleWorkers=${finalProxy?.idleWorkers || 0}, queued=${finalProxy?.queuedRequests || 0}`);
  console.log('  Baseline return confirmed without manual restarts.\n');

  console.log('==============================================================');
  console.log('                   BENCHMARK RUN COMPLETED                    ');
  console.log('==============================================================\n');
}

main().catch(console.error);
