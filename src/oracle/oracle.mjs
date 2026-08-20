import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson } from '../core/fs.mjs';
import { assertOracleProvenance } from '../policy/evidence-policy.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ORACLE_DIR = path.join(ROOT, 'oracle', 'versions');

function compareUnityLines(left, right) {
  const a = left.split('.').map((value) => Number.parseInt(value, 10) || 0);
  const b = right.split('.').map((value) => Number.parseInt(value, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const delta = (a[i] ?? 0) - (b[i] ?? 0);
    if (delta !== 0) return delta;
  }
  return left.localeCompare(right);
}

export function listOracleVersions() {
  if (!fs.existsSync(ORACLE_DIR)) return [];
  return fs.readdirSync(ORACLE_DIR)
    .filter((name) => /^\d+(?:\.\d+)+\.json$/.test(name))
    .map((name) => name.slice(0, -5))
    .sort(compareUnityLines);
}

export function loadOracle(unityLine) {
  if (!listOracleVersions().includes(unityLine)) return null;
  const oracle = readJson(path.join(ORACLE_DIR, `${unityLine}.json`));
  if (oracle.schemaVersion !== '0.2') throw new Error(`Oracle ${unityLine} must use schemaVersion 0.2.`);
  if (oracle.unity !== unityLine) throw new Error(`Oracle ${unityLine} identity mismatch.`);
  assertOracleProvenance(oracle, `Oracle ${unityLine}`);
  return oracle;
}
