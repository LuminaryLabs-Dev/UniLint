#!/usr/bin/env node
import http from 'node:http';
import { indexUnityProject } from '../../src/core/indexer.mjs';
import { evaluateCompatibility } from '../../src/compat/compat.mjs';
import { runAudit } from '../../src/rules/audit.mjs';
import { listOracleVersions } from '../../src/oracle/oracle.mjs';
import { searchVersions } from '../../src/compat/version-search.mjs';

const host = '127.0.0.1';
const port = Number(process.env.UNILINT_PORT ?? 17450);

function send(res, status, body) {
  const data = JSON.stringify(body, null, 2);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(data) });
  res.end(data);
}

async function readJson(req) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 2 * 1024 * 1024) throw new Error('Request body exceeds 2 MB.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/health') return send(res, 200, { status: 'ok', service: 'UniLint', version: '0.1.0' });
    if (req.method === 'GET' && req.url === '/v1/oracles') return send(res, 200, { versions: listOracleVersions() });
    if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });
    const body = await readJson(req);
    if (!body.project) return send(res, 400, { error: 'project is required' });
    const ir = indexUnityProject(body.project);
    if (req.url === '/v1/index') return send(res, 200, ir);
    if (req.url === '/v1/audit') return send(res, 200, runAudit(ir));
    if (req.url === '/v1/compatibility') {
      if (!body.unity) return send(res, 400, { error: 'unity is required' });
      return send(res, 200, evaluateCompatibility(ir, body));
    }
    if (req.url === '/v1/version-search') {
      return send(res, 200, searchVersions(ir, body));
    }
    return send(res, 404, { error: 'not_found' });
  } catch (error) {
    return send(res, 500, { error: error.message });
  }
});

server.listen(port, host, () => console.log(`UniLint service listening at http://${host}:${port}`));
