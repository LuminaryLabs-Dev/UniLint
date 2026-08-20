import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson } from '../core/fs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function listOracleVersions() {
  return ['6000.0', '6000.3'];
}

export function loadOracle(unityLine) {
  if (!listOracleVersions().includes(unityLine)) return null;
  return readJson(path.join(ROOT, 'oracle', 'versions', `${unityLine}.json`));
}
