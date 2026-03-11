#!/usr/bin/env node
/**
 * Load Test — Token API + Room Join Simulation
 *
 * Simulates N viewers all requesting tokens simultaneously, then checks
 * the room participant count via /api/rooms to confirm LiveKit accepted them.
 *
 * Usage:
 *   node test-api.js [viewers] [room] [ramp-ms]
 *
 * Examples:
 *   node test-api.js 50 my-stream 100    # 50 viewers, 100ms between each
 *   node test-api.js 200 my-stream 50    # 200 viewers, 50ms between each
 *   node test-api.js 10                  # 10 viewers, defaults
 */

import 'dotenv/config';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const NUM_VIEWERS  = parseInt(process.argv[2] || '20');
const ROOM_NAME    = process.argv[3] || 'load-test-room';
const RAMP_DELAY   = parseInt(process.argv[4] || '100'); // ms between spawning each viewer

const results = {
  success: 0,
  failure: 0,
  latencies: [],
  errors: [],
};

async function fetchToken(viewerIndex) {
  const start = Date.now();
  try {
    const res = await fetch(`${BACKEND_URL}/api/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomName: ROOM_NAME,
        participantName: `viewer-${viewerIndex}`,
        isHost: false,
      }),
    });

    const latency = Date.now() - start;

    if (!res.ok) {
      const text = await res.text();
      results.failure++;
      results.errors.push(`viewer-${viewerIndex}: HTTP ${res.status} — ${text}`);
      return;
    }

    const data = await res.json();
    if (!data.token) {
      results.failure++;
      results.errors.push(`viewer-${viewerIndex}: no token in response`);
      return;
    }

    results.success++;
    results.latencies.push(latency);
    process.stdout.write(`\r  Tokens received: ${results.success + results.failure}/${NUM_VIEWERS}`);
  } catch (err) {
    results.failure++;
    results.errors.push(`viewer-${viewerIndex}: ${err.message}`);
  }
}

async function checkRoomParticipants() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/rooms`);
    const data = await res.json();
    const room = (data.rooms || []).find((r) => r.name === ROOM_NAME);
    return room ? room.numParticipants : 0;
  } catch {
    return -1;
  }
}

// ---------- main ----------
console.log(`\n${'='.repeat(55)}`);
console.log(`  Live Streaming — Load Test`);
console.log(`${'='.repeat(55)}`);
console.log(`  Backend:   ${BACKEND_URL}`);
console.log(`  Room:      ${ROOM_NAME}`);
console.log(`  Viewers:   ${NUM_VIEWERS}`);
console.log(`  Ramp:      ${RAMP_DELAY}ms between each viewer`);
console.log(`${'='.repeat(55)}\n`);

// Verify backend is reachable
try {
  const health = await fetch(`${BACKEND_URL}/health`);
  const hdata = await health.json();
  if (hdata.status !== 'ok') throw new Error('unexpected health response');
  console.log('  ✓ Backend reachable\n');
} catch (err) {
  console.error(`  ✗ Cannot reach backend: ${err.message}`);
  console.error(`    Make sure the backend is running: cd backend && npm start`);
  process.exit(1);
}

// --- Phase 1: Ramp up token requests ---
console.log(`  [1/2] Requesting ${NUM_VIEWERS} viewer tokens (ramp ${RAMP_DELAY}ms)...`);
const rampStart = Date.now();

const promises = [];
for (let i = 1; i <= NUM_VIEWERS; i++) {
  promises.push(fetchToken(i));
  if (RAMP_DELAY > 0 && i < NUM_VIEWERS) {
    await new Promise((r) => setTimeout(r, RAMP_DELAY));
  }
}
await Promise.all(promises);
const rampDuration = ((Date.now() - rampStart) / 1000).toFixed(1);

// --- Phase 2: Check room participants ---
console.log(`\n\n  [2/2] Checking room participant count on LiveKit...`);
await new Promise((r) => setTimeout(r, 1000));
const participants = await checkRoomParticipants();

// --- Results ---
const lat = results.latencies;
const avg = lat.length ? Math.round(lat.reduce((a, b) => a + b, 0) / lat.length) : 0;
const min = lat.length ? Math.min(...lat) : 0;
const max = lat.length ? Math.max(...lat) : 0;
const p95 = lat.length
  ? [...lat].sort((a, b) => a - b)[Math.floor(lat.length * 0.95)]
  : 0;

console.log(`\n${'='.repeat(55)}`);
console.log(`  RESULTS`);
console.log(`${'='.repeat(55)}`);
console.log(`  Token requests:    ${NUM_VIEWERS}`);
console.log(`  ✓ Successes:       ${results.success}`);
console.log(`  ✗ Failures:        ${results.failure}`);
console.log(`  Total ramp time:   ${rampDuration}s`);
console.log(`\n  Token latency (ms):`);
console.log(`    Min:  ${min}ms`);
console.log(`    Avg:  ${avg}ms`);
console.log(`    p95:  ${p95}ms`);
console.log(`    Max:  ${max}ms`);

if (participants >= 0) {
  console.log(`\n  LiveKit room participants: ${participants}`);
  if (participants === 0) {
    console.log(`  (Note: room may be empty — tokens were generated but no`);
    console.log(`   actual WebRTC connections were established by this test)`);
  }
}

if (results.errors.length > 0) {
  console.log(`\n  Errors (first 5):`);
  results.errors.slice(0, 5).forEach((e) => console.log(`    - ${e}`));
}

console.log(`${'='.repeat(55)}\n`);

const successRate = ((results.success / NUM_VIEWERS) * 100).toFixed(1);
if (results.failure === 0) {
  console.log(`  ✅ PASS — ${successRate}% success rate`);
} else {
  console.log(`  ⚠️  ${successRate}% success rate — check errors above`);
}
console.log();
