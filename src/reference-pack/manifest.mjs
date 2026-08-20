import fs from 'node:fs';
import path from 'node:path';

const ASSEMBLY_NAME = /^[A-Za-z0-9_.-]+$/;

function normalizeNames(values, label, { required = false } = {}) {
  const names = [...new Set((values ?? []).map((value) => String(value).trim()).filter(Boolean))];
  if (required && names.length === 0) throw new Error(`${label} must contain at least one assembly name.`);
  for (const name of names) {
    if (!ASSEMBLY_NAME.test(name) || name.toLowerCase().endsWith('.dll')) {
      throw new Error(`${label} contains invalid assembly name '${name}'. Use assembly names without paths or .dll suffixes.`);
    }
  }
  return names;
}

function dllBasenames(root) {
  const files = fs.readdirSync(root, { recursive: true });
  return new Set(files
    .map((entry) => path.basename(String(entry)))
    .filter((name) => name.toLowerCase().endsWith('.dll'))
    .map((name) => name.toLowerCase()));
}

export function buildReferencePackManifest(root, options) {
  const absolute = path.resolve(root);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isDirectory()) {
    throw new Error(`Reference-pack directory does not exist: ${absolute}`);
  }
  if (!/^\d+(?:\.\d+)+$/.test(String(options.unityLine ?? ''))) {
    throw new Error('--unity must be a Unity version line such as 6000.3.');
  }

  const framework = normalizeNames(options.framework, 'assemblies.framework', { required: true });
  const engine = normalizeNames(options.engine, 'assemblies.engine', { required: true });
  const autoReferenced = normalizeNames(options.autoReferenced, 'assemblies.autoReferenced');
  const available = dllBasenames(absolute);
  const missing = [...framework, ...engine, ...autoReferenced]
    .filter((name) => !available.has(`${name}.dll`.toLowerCase()));
  if (missing.length) {
    throw new Error(`Declared reference assemblies are missing from the local directory: ${missing.join(', ')}`);
  }

  return {
    schemaVersion: '0.2',
    unityLine: String(options.unityLine),
    complete: options.complete === true,
    generatedLocally: true,
    provenance: {
      sourceMode: 'local-installed-files',
      unityProcessInvoked: false,
      networkAccess: false,
    },
    assemblies: { framework, engine, autoReferenced },
  };
}

export function writeReferencePackManifest(root, options) {
  const absolute = path.resolve(root);
  const manifest = buildReferencePackManifest(absolute, options);
  const target = path.join(absolute, 'unilint-reference-pack.json');
  fs.writeFileSync(target, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return { path: target, manifest };
}
