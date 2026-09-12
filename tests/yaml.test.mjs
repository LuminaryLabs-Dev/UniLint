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

import { parseUnityDocuments } from '../src/unity/yaml.mjs';
import { extractCSharp } from '../src/signal-graph/extract/csharp.mjs';

test('detailed Unity parsing preserves large IDs, scalar spelling and multiline references', () => {
  const [doc] = parseUnityDocuments(`--- !u!114 &9223372036854775806 stripped\nMonoBehaviour:\n  m_Name: On\n  m_Enabled: 0\n  ref: {fileID: 9223372036854775805,\n    guid: abcdefabcdefabcdefabcdefabcdefab, type: 3}\n`);
  assert.equal(doc.fileId,'9223372036854775806');assert.equal(doc.data.m_Name,'On');assert.equal(doc.data.m_Enabled,'0');
  assert.equal(doc.references[0].fileId,'9223372036854775805');assert.equal(doc.stripped,true);
});
test('duplicate YAML fields remain an explicit parser error', () => {
  const [doc]=parseUnityDocuments('--- !u!1 &1\nGameObject:\n  m_Name: A\n  m_Name: B\n');assert.ok(doc.error);assert.equal(doc.data,null);
});
test('lexical signals retain candidates, waits and literal loads without reading commented calls', () => {
  const src=`using UnityEngine; public class Door { public CharacterController player; void Start() {\n // SceneManager.LoadScene("Wrong");\n var note = "SceneManager.LoadScene(ignored)";\n if (ready) { SceneManager.LoadScene("Exit"); }\n StartCoroutine(Run());\n } IEnumerator Run() { yield return new WaitForSeconds(0.25f); Changed += OnChange; } }`;
  const result=extractCSharp(src);assert.equal(result.fields[0].type,'CharacterController');
  assert.deepEqual(result.signals.filter(x=>x.kind==='loads').map(x=>x.literal),['Exit']);
  assert.equal(result.signals.find(x=>x.kind==='waits').numeric,'0.25f');
  assert.ok(result.signals.some(x=>x.kind==='subscribes'));
  assert.ok(result.signals.every(x=>x.status==='syntax-candidate'));
});
