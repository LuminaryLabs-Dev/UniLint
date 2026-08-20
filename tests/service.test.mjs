import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function getJson(port, route) {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: '127.0.0.1', port, path: route }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) }));
    });
    request.on('error', reject);
  });
}

test('local service exposes health and oracle inventory', async (t) => {
  const port = 18450 + Math.floor(Math.random() * 500);
  const child = spawn(process.execPath, [path.join(root, 'apps/service/server.mjs')], { cwd: root, env: { ...process.env, UNILINT_PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => child.kill('SIGTERM'));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('service did not start')), 3000);
    child.stdout.on('data', (data) => { if (String(data).includes('listening')) { clearTimeout(timer); resolve(); } });
    child.on('exit', (code) => { clearTimeout(timer); reject(new Error(`service exited ${code}`)); });
  });
  const health = await getJson(port, '/health');
  assert.equal(health.status, 200);
  assert.equal(health.body.service, 'UniLint');
  const oracles = await getJson(port, '/v1/oracles');
  assert.deepEqual(oracles.body.versions, ['6000.0', '6000.3']);
});
