import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lookupPackageCompatibility } from '../src/oracle/packages.mjs';
import { evaluatePackages } from '../src/compat/packages.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = path.join(root, 'fixtures/good/basic-project');

test('exact evidence-backed package record resolves', () => {
  const result = lookupPackageCompatibility({
    unityLine: '6000.3',
    name: 'com.unity.inputsystem',
    version: '1.20.0'
  });
  assert.equal(result.status, 'compatible');
  assert.ok(result.evidence.some((item) => item.kind === 'official-unity-package-release'));
});

test('nearby package version remains unknown', () => {
  const result = lookupPackageCompatibility({
    unityLine: '6000.3',
    name: 'com.unity.timeline',
    version: '1.8.12'
  });
  assert.equal(result.status, 'unknown');
  assert.match(result.reason, /No exact compatibility record/);
});

test('external package without exact evidence stays unknown', () => {
  const evaluated = evaluatePackages({
    projectRoot: fixture,
    packages: [{
      name: 'com.example.unknown',
      requested: '9.9.9',
      resolvedVersion: '9.9.9',
      source: 'registry'
    }]
  }, '6000.3');

  assert.equal(evaluated.results[0].status, 'unknown');
  assert.ok(evaluated.findings.some((item) => item.rule === 'unity/packages/external-version-unverified'));
});
