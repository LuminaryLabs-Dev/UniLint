import test from 'node:test';
import assert from 'node:assert/strict';
import { parseUnityYaml } from '../src/unity/yaml.mjs';

test('parses Unity class/file IDs and GUID references', () => {
  const parsed = parseUnityYaml(`%YAML 1.1\n--- !u!114 &42\nMonoBehaviour:\n  serializedVersion: 3\n  m_Script: {fileID: 11500000, guid: abcdefabcdefabcdefabcdefabcdefab, type: 3}\n`);
  assert.equal(parsed.documents.length, 1);
  assert.equal(parsed.documents[0].classId, 114);
  assert.equal(parsed.documents[0].fileId, '42');
  assert.equal(parsed.documents[0].serializedVersion, 3);
  assert.deepEqual(parsed.guidReferences, ['abcdefabcdefabcdefabcdefabcdefab']);
});
