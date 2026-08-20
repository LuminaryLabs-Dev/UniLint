import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assertOracleProvenance, assertReferencePackProvenance } from '../src/policy/evidence-policy.mjs';
import { buildReferencePackManifest } from '../src/reference-pack/manifest.mjs';
import { listOracleVersions, loadOracle } from '../src/oracle/oracle.mjs';

test('oracle registry discovers loadable curated packs and enforces provenance', () => {
  assert.deepEqual(listOracleVersions(), ['6000.0', '6000.3']);
  const oracle = loadOracle('6000.3');
  assert.equal(oracle.provenance.level, 'B');
  assert.equal(oracle.provenance.sourceMode, 'human-curated-facts');
  assert.equal(oracle.provenance.automatedIngestion, false);
  assert.equal(oracle.provenance.unityProcessInvoked, false);
  assert.equal(oracle.provenance.networkRequired, false);
});

test('oracle provenance rejects automated Unity ingestion', () => {
  assert.throws(() => assertOracleProvenance({
    provenance: {
      level: 'B',
      sourceMode: 'human-curated-facts',
      automatedIngestion: true,
      unityProcessInvoked: false,
      networkRequired: false,
      sources: [],
    },
  }), /automatedIngestion=false/);
});

test('local reference-pack manifest is offline and does not invoke Unity', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'unilint-reference-policy-'));
  for (const name of ['mscorlib', 'netstandard', 'UnityEngine.CoreModule', 'UnityEditor.CoreModule']) {
    fs.writeFileSync(path.join(root, `${name}.dll`), 'fixture');
  }
  const manifest = buildReferencePackManifest(root, {
    unityLine: '6000.3',
    framework: ['mscorlib', 'netstandard'],
    engine: ['UnityEngine.CoreModule', 'UnityEditor.CoreModule'],
    autoReferenced: [],
    complete: true,
  });
  assert.equal(manifest.schemaVersion, '0.2');
  assert.equal(manifest.generatedLocally, true);
  assert.equal(manifest.complete, true);
  assert.equal(manifest.provenance.sourceMode, 'local-installed-files');
  assert.equal(manifest.provenance.unityProcessInvoked, false);
  assert.equal(manifest.provenance.networkAccess, false);
  assert.doesNotThrow(() => assertReferencePackProvenance(manifest));
});

test('reference-pack builder refuses declared DLLs that are not locally present', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'unilint-reference-missing-'));
  fs.writeFileSync(path.join(root, 'mscorlib.dll'), 'fixture');
  assert.throws(() => buildReferencePackManifest(root, {
    unityLine: '6000.3',
    framework: ['mscorlib'],
    engine: ['UnityEngine.CoreModule'],
    autoReferenced: [],
  }), /UnityEngine\.CoreModule/);
});
