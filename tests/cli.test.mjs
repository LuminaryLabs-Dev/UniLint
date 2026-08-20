import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'src/cli.mjs');
const good = path.join(root, 'fixtures/good/basic-project');

test('CLI compatibility JSON is machine-readable', () => {
  const result = spawnSync(process.execPath, [cli, 'compat', good, '--unity', '6000.3', '--format', 'json'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.compatibility.level.code, 'U2');
});

test('CLI version search evaluates both initial oracle lines', () => {
  const result = spawnSync(process.execPath, [cli, 'versions', good, '--format', 'json'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.deepEqual(parsed.results.map((item) => item.target.unityLine), ['6000.0', '6000.3']);
  assert.equal(parsed.recommended, '6000.3');
  assert.equal(parsed.minimumPredictedCompatible, '6000.0');
});
