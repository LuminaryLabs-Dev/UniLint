import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
test('python asset worker returns deterministic JSON facts', () => {
  const result = spawnSync('python3', [path.join(root, 'workers/python/unilint_worker.py'), path.join(root, 'fixtures/good/basic-project')], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.schemaVersion, '0.1');
  assert.ok(parsed.items.some((item) => item.path === 'Assets/Main.unity'));
});
