import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { indexUnityProject } from '../src/core/indexer.mjs';
import { evaluateCompatibility } from '../src/compat/compat.mjs';
import { buildTargetEnvironment } from '../src/oracle/defines.mjs';
import { satisfiesVersionExpression } from '../src/unity/semver.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const good = path.join(root, 'fixtures/good/basic-project');

test('Unity 6000.3 target defines include Unity 6 line and platform symbols', () => {
  const env = buildTargetEnvironment({ unity: '6000.3.0f1', platform: 'android', backend: 'il2cpp' });
  assert.ok(env.defines.includes('UNITY_6000_0_OR_NEWER'));
  assert.ok(env.defines.includes('UNITY_6000_3_OR_NEWER'));
  assert.ok(env.defines.includes('UNITY_ANDROID'));
  assert.ok(env.defines.includes('ENABLE_IL2CPP'));
});

test('version expression evaluator handles Unity asmdef-style ranges', () => {
  assert.equal(satisfiesVersionExpression('6000.3.0', '[6000.0,)'), true);
  assert.equal(satisfiesVersionExpression('1.7.0', '[1.7,2.4.1]'), true);
  assert.equal(satisfiesVersionExpression('2.5.0', '[1.7,2.4.1]'), false);
});

test('healthy fixture reaches U2 without pretending Roslyn was executed', () => {
  const ir = indexUnityProject(good);
  const report = evaluateCompatibility(ir, { unity: '6000.3', platform: 'windows' });
  assert.equal(report.compatibility.level.code, 'U2');
  assert.equal(report.compatibility.predicted, 'pass-with-unknowns');
  assert.equal(report.roslyn.performed, false);
  const assembly = report.assemblyPlan.assemblies.find((item) => item.name === 'Fixture.Gameplay');
  assert.ok(assembly.defines.includes('FIXTURE_UNITY_6'));
});

test('missing oracle version is blocking', () => {
  const ir = indexUnityProject(good);
  const report = evaluateCompatibility(ir, { unity: '2022.3' });
  assert.equal(report.compatibility.predicted, 'blocked');
  assert.ok(report.findings.some((item) => item.rule === 'unilint/oracle/missing-version-pack'));
});

test('project-specific Standalone define is included in the assembly plan', () => {
  const ir = indexUnityProject(good);
  const report = evaluateCompatibility(ir, { unity: '6000.3', platform: 'windows' });
  const assembly = report.assemblyPlan.assemblies.find((item) => item.name === 'Fixture.Gameplay');
  assert.ok(assembly.defines.includes('FIXTURE_STANDALONE'));
});

test('U3 reference packs require explicit target framework classification', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const { runRoslynCompatibility } = await import('../src/compat/roslyn.mjs');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'unilint-refpack-test-'));
  fs.writeFileSync(path.join(temp, 'unilint-reference-pack.json'), JSON.stringify({
    schemaVersion: '0.2',
    unityLine: '6000.3',
    complete: true,
    generatedLocally: true,
    provenance: { sourceMode: 'local-installed-files', unityProcessInvoked: false, networkAccess: false },
  }));
  fs.writeFileSync(path.join(temp, 'placeholder.dll'), 'not actually reached');
  const result = runRoslynCompatibility({ projectRoot: good }, { target: { unityLine: '6000.3' }, assemblies: [] }, temp);
  assert.equal(result.performed, false);
  assert.match(result.reason, /assemblies\.framework/);
});

test('U3 rejects legacy reference packs without local provenance', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const { runRoslynCompatibility } = await import('../src/compat/roslyn.mjs');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'unilint-refpack-legacy-'));
  fs.writeFileSync(path.join(temp, 'unilint-reference-pack.json'), JSON.stringify({
    schemaVersion: '0.1',
    unityLine: '6000.3',
    complete: true,
    assemblies: { framework: ['mscorlib'], engine: ['UnityEngine.CoreModule'], autoReferenced: [] },
  }));
  fs.writeFileSync(path.join(temp, 'mscorlib.dll'), 'fixture');
  fs.writeFileSync(path.join(temp, 'UnityEngine.CoreModule.dll'), 'fixture');
  const result = runRoslynCompatibility({ projectRoot: good }, { target: { unityLine: '6000.3' }, assemblies: [] }, temp);
  assert.equal(result.performed, false);
  assert.match(result.reason, /schemaVersion 0\.2/);
});
