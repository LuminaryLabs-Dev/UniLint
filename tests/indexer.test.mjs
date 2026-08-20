import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { indexUnityProject } from '../src/core/indexer.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const good = path.join(root, 'fixtures/good/basic-project');
const broken = path.join(root, 'fixtures/broken/broken-project');

test('indexes a structurally healthy Unity fixture', () => {
  const ir = indexUnityProject(good);
  assert.equal(ir.identity.sourceUnityVersion.raw, '2022.3.48f1');
  assert.equal(ir.scripts.length, 1);
  assert.equal(ir.assemblies.definitions[0].name, 'Fixture.Gameplay');
  assert.equal(ir.serializedAssets.length, 1);
  assert.equal(ir.findings.filter((item) => item.blocking).length, 0);
});

test('detects duplicate GUID and unresolved serialized reference', () => {
  const ir = indexUnityProject(broken);
  assert.ok(ir.findings.some((item) => item.rule === 'unity/meta/duplicate-guid'));
  assert.ok(ir.findings.some((item) => item.rule === 'unity/references/unresolved-guid'));
});

test('Unity predefined compilation phases are modeled for Plugins and Editor folders', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'unilint-phases-'));
  fs.mkdirSync(path.join(temp, 'Assets/Plugins/Editor'), { recursive: true });
  fs.mkdirSync(path.join(temp, 'Assets/Game/Editor'), { recursive: true });
  fs.mkdirSync(path.join(temp, 'Packages'), { recursive: true });
  fs.mkdirSync(path.join(temp, 'ProjectSettings'), { recursive: true });
  fs.writeFileSync(path.join(temp, 'Packages/manifest.json'), '{"dependencies":{}}');
  fs.writeFileSync(path.join(temp, 'Packages/packages-lock.json'), '{"dependencies":{}}');
  fs.writeFileSync(path.join(temp, 'ProjectSettings/ProjectVersion.txt'), 'm_EditorVersion: 6000.3.0f1\n');
  const files = [
    ['Assets/Plugins/Runtime.cs', 'Assembly-CSharp-firstpass', '11111111111111111111111111111111'],
    ['Assets/Plugins/Editor/Tool.cs', 'Assembly-CSharp-Editor-firstpass', '22222222222222222222222222222222'],
    ['Assets/Game/Runtime.cs', 'Assembly-CSharp', '33333333333333333333333333333333'],
    ['Assets/Game/Editor/Tool.cs', 'Assembly-CSharp-Editor', '44444444444444444444444444444444'],
  ];
  for (const [rel,, guid] of files) {
    const full = path.join(temp, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, 'public class Fixture {}');
    fs.writeFileSync(`${full}.meta`, `guid: ${guid}\n`);
  }
  for (const dir of ['Assets/Plugins', 'Assets/Plugins/Editor', 'Assets/Game', 'Assets/Game/Editor']) {
    fs.writeFileSync(path.join(temp, `${dir}.meta`), `guid: ${Math.random().toString(16).slice(2).padEnd(32, '0').slice(0,32)}\n`);
  }
  const ir = indexUnityProject(temp);
  for (const [rel, expected] of files) assert.equal(ir.scripts.find((item) => item.path === rel).assembly, expected);
});
