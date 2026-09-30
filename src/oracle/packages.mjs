import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson } from '../core/fs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const REGISTRY_FILE = path.join(ROOT, 'oracle', 'package-compatibility.json');
const EVIDENCE_FILE = path.join(ROOT, 'oracle', 'evidence-index.json');
const ALLOWED = new Set(['compatible', 'incompatible', 'deprecated', 'unknown']);
let cache = null;

function loadRegistry() {
  if (cache) return cache;
  const registry = readJson(REGISTRY_FILE);
  const index = readJson(EVIDENCE_FILE);
  if (registry.schemaVersion !== '0.1') throw new Error('Package compatibility registry must use schemaVersion 0.1.');
  if (index.schemaVersion !== '0.1') throw new Error('Package evidence index must use schemaVersion 0.1.');
  if (!Array.isArray(registry.records)) throw new Error('Package compatibility records must be an array.');
  const evidence = index.evidence ?? {};
  for (const record of registry.records) {
    if (!record.unity || !record.package || !record.version || !ALLOWED.has(record.status)) {
      throw new Error('Invalid package compatibility record.');
    }
    if (!Array.isArray(record.evidence) || record.evidence.length === 0) {
      throw new Error(`Package compatibility record ${record.package}@${record.version} must cite evidence.`);
    }
    for (const id of record.evidence) if (!evidence[id]) throw new Error(`Unknown package evidence id '${id}'.`);
  }
  cache = { registry, evidence };
  return cache;
}

export function listPackageCompatibilityRecords() {
  return loadRegistry().registry.records.map((record) => ({ ...record }));
}

export function lookupPackageCompatibility({ unityLine, name, version }) {
  const { registry, evidence } = loadRegistry();
  if (!unityLine || !name || !version) {
    return { status: 'unknown', scope: 'missing-identity', evidence: [], reason: 'Unity line, package name, and exact package version are required.' };
  }
  const record = registry.records.find((item) =>
    item.unity === unityLine && item.package === name && item.version === version
  );
  if (!record) {
    return {
      status: 'unknown',
      scope: 'no-exact-record',
      evidence: [],
      reason: `No exact compatibility record for ${name}@${version} on Unity ${unityLine}.`
    };
  }
  return {
    ...record,
    evidence: record.evidence.map((id) => ({ id, ...evidence[id] }))
  };
}
