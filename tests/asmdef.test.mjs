import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadAsmdefs, evaluateAssembly } from '../src/unity/asmdef.mjs';

test('asmdef GUID references resolve to assembly names', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'unilint-asmdef-'));
  const a = path.join(root, 'A.asmdef');
  const b = path.join(root, 'B.asmdef');
  fs.writeFileSync(a, JSON.stringify({ name: 'A', references: ['GUID:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'] }));
  fs.writeFileSync(`${a}.meta`, 'guid: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n');
  fs.writeFileSync(b, JSON.stringify({ name: 'B', references: [] }));
  fs.writeFileSync(`${b}.meta`, 'guid: bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\n');
  const loaded = loadAsmdefs(root, [a, b], []);
  assert.deepEqual(loaded.definitions.find((item) => item.name === 'A').references, ['B']);
});

test('Editor includePlatform does not match a Windows player target', () => {
  const definition = { includePlatforms: ['Editor'], excludePlatforms: [], defineConstraints: [], versionDefines: [] };
  const player = evaluateAssembly(definition, { platform: 'windows', editor: false, defines: [], unityVersion: '6000.3' }, {});
  const editor = evaluateAssembly(definition, { platform: 'windows', editor: true, defines: ['UNITY_EDITOR'], unityVersion: '6000.3' }, {});
  assert.equal(player.included, false);
  assert.equal(editor.included, true);
});
