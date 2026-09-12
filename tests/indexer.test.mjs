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

import { readBuildSettings, selectScenes } from '../src/unity/build-settings.mjs';
import { buildSignalGraph, checkFreshness, writeGraph, loadGraph } from '../src/signal-graph/index.mjs';
import { queryGraph } from '../src/signal-graph/query.mjs';
import { sceneReport, reportHtml } from '../src/report/scene-review.mjs';

function sceneFixture(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'unilint-graph-test-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const put=(name,text)=>{const dest=path.join(root,name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,text);};
  put('ProjectSettings/ProjectVersion.txt','m_EditorVersion: 2020.3.26f1\n');put('Packages/manifest.json','{"dependencies":{}}');put('Packages/packages-lock.json','{"dependencies":{}}');
  put('ProjectSettings/EditorBuildSettings.asset',`--- !u!1045 &1\nEditorBuildSettings:\n  m_Scenes:\n  - enabled: 1\n    path: Assets/A.unity\n    guid: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n  - enabled: 0\n    path: Assets/B.unity\n    guid: bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\n`);
  put('Assets/A.unity',`--- !u!1 &1\nGameObject:\n  m_Name: Player\n  m_IsActive: 1\n  m_Component:\n  - component: {fileID: 2}\n  - component: {fileID: 3}\n--- !u!114 &2\nMonoBehaviour:\n  m_GameObject: {fileID: 1}\n  m_Script: {fileID: 11500000, guid: cccccccccccccccccccccccccccccccc, type: 3}\n  m_Enabled: 1\n  player: {fileID: 3}\n  missing: {fileID: 99}\n  onClick:\n    m_PersistentCalls:\n      m_Calls:\n      - m_Target: {fileID: 2}\n        m_MethodName: Run\n        m_CallState: 2\n--- !u!136 &3\nCapsuleCollider:\n  m_GameObject: {fileID: 1}\n--- !u!1001 &4\nPrefabInstance:\n  m_SourcePrefab: {fileID: 100100000, guid: dddddddddddddddddddddddddddddddd, type: 3}\n  m_Modification:\n    m_Modifications:\n    - target: {fileID: 7, guid: dddddddddddddddddddddddddddddddd, type: 3}\n      propertyPath: m_IsActive\n      value: 0\n      objectReference: {fileID: 0}\n--- !u!1001 &5\nPrefabInstance:\n  m_SourcePrefab: {fileID: 100100000, guid: dddddddddddddddddddddddddddddddd, type: 3}\n`);
  put('Assets/B.unity','--- !u!1 &1\nGameObject:\n  m_Name: End\n');
  put('Assets/P.prefab',`--- !u!1001 &100100000\nPrefab:\n  m_RootGameObject: {fileID: 7}\n--- !u!1 &7\nGameObject:\n  m_Name: Shared\n  self: {fileID: 7, guid: dddddddddddddddddddddddddddddddd, type: 3}\n`);
  put('Assets/Driver.cs','using UnityEngine; public class Driver { public CharacterController player; void Start() { Run(); } void Run() { SceneManager.LoadScene("B"); } }');
  for(const [file,guid] of [['A.unity','a'],['B.unity','b'],['Driver.cs','c'],['P.prefab','d']])put(`Assets/${file}.meta`,`guid: ${guid.repeat(32)}\n`);
  return {root,put};
}
test('BOM input and partial assembly errors retain usable definitions and block compatibility',t=>{
  const {root,put}=sceneFixture(t);put('Assets/Good.asmdef','\ufeff{"name":"Good"}');put('Assets/Bad.asmdef','{bad');
  const ir=indexUnityProject(root);assert.equal(ir.assemblies.definitions.length,1);assert.equal(ir.assemblies.complete,false);
  assert.ok(ir.findings.some(f=>f.file==='Assets/Bad.asmdef'&&f.blocking));assert.equal(ir.scripts[0].assemblyResolution,'partial');
});
test('package resolution picks the locked cache version and registers its script GUID',t=>{
  const {root,put}=sceneFixture(t);put('Packages/manifest.json','{"dependencies":{"com.example.input":"1.0.0"}}');put('Packages/packages-lock.json','{"dependencies":{"com.example.input":{"version":"1.0.0","source":"registry"}}}');
  for(const v of ['1.0.0','2.0.0']){put(`Library/PackageCache/com.example.input@${v}/package.json`,JSON.stringify({name:'com.example.input',version:v}));put(`Library/PackageCache/com.example.input@${v}/Input.cs`,'class Input {}');put(`Library/PackageCache/com.example.input@${v}/Input.cs.meta`,`guid: ${v[0].repeat(32)}\n`);}
  const ir=indexUnityProject(root);assert.ok(ir.scripts.some(s=>s.path.includes('@1.0.0/')));assert.ok(!ir.scripts.some(s=>s.path.includes('@2.0.0/')));assert.deepEqual(ir.guidGraph.guidToAssets['1'.repeat(32)],['Library/PackageCache/com.example.input@1.0.0/Input.cs']);
});
test('built-in GUIDs do not produce missing-project-asset findings',t=>{
  const {root,put}=sceneFixture(t);put('Assets/B.unity','--- !u!1 &1\nGameObject:\n  icon: {fileID: 1, guid: 0000000000000000e000000000000000, type: 0}\n');
  assert.ok(!indexUnityProject(root).findings.some(f=>f.rule==='unity/references/unresolved-guid'&&f.file==='Assets/B.unity'));
});
test('build scopes include disabled entries and reject unlisted selectors',t=>{
  const {root}=sceneFixture(t),b=readBuildSettings(root);assert.equal(b.entries.length,2);assert.equal(b.entries[1].enabledBuildIndex,null);assert.equal(selectScenes(b,{scope:'enabled'}).length,1);assert.throws(()=>selectScenes(b,{scope:'selected',scenes:['absent']}));
});
test('static graph preserves instances, override facts, cyclic refs and bounded signal evidence',t=>{
  const {root}=sceneFixture(t),g=buildSignalGraph(root);assert.equal(g.scenes.length,2);
  assert.equal(g.nodes.filter(n=>n.file==='Assets/A.unity'&&n.kind==='prefab-instance').length,2);
  assert.ok(g.edges.some(e=>e.kind==='overrides'&&e.value==='0'));
  assert.ok(g.edges.some(e=>e.kind==='invokes-event'&&e.method==='Run'));
  assert.ok(g.findings.some(f=>f.rule==='unity/reference/missing-file-id'&&f.target.endsWith('#99')));
  assert.ok(g.findings.some(f=>f.rule==='unity/binding/native-type-mismatch'));
  assert.ok(g.edges.some(e=>e.kind==='loads'&&e.status==='syntax-candidate'));
  const all=new Set(g.nodes.map(n=>n.id));assert.ok(g.edges.every(e=>all.has(e.from)&&all.has(e.to)));
  const page=queryGraph(g,{scene:'a'.repeat(32),view:'nodes',limit:2});assert.equal(page.results.length,2);assert.equal(page.nextOffset,2);assert.ok(page.total>2);
  assert.throws(()=>queryGraph(g,{limit:100000}));
  const again=buildSignalGraph(root);assert.deepEqual(g.edges,again.edges);assert.deepEqual(g.findings,again.findings);
  assert.equal(sceneReport(g).scenes.length,2);assert.ok(reportHtml(sceneReport(g),g).includes('gzip-base64'));
});
test('cache refuses overwrite, recognizes content changes and requires explicit historical queries',t=>{
  const {root,put}=sceneFixture(t),g=buildSignalGraph(root),dir=path.join(root,'audit');writeGraph(g,dir);assert.equal(loadGraph(dir).freshness.fresh,true);assert.throws(()=>writeGraph(g,dir));
  put('Assets/Driver.cs','class Changed {}');assert.equal(checkFreshness(g).fresh,false);assert.throws(()=>loadGraph(dir));assert.equal(loadGraph(dir,{allowStale:true}).freshness.fresh,false);
});

test('excluded package sample metadata does not become imported duplicate GUID evidence',t=>{
  const {root,put}=sceneFixture(t);put('Packages/embedded/package.json','{"name":"embedded","version":"1.0.0"}');
  for(const dir of ['Samples~/A','Samples~/B']){put(`Packages/embedded/${dir}/Hidden.cs`,'class Hidden {}');put(`Packages/embedded/${dir}/Hidden.cs.meta`,'guid: '+'e'.repeat(32));}
  const ir=indexUnityProject(root);assert.ok(!ir.scripts.some(s=>s.path.includes('Samples~')));assert.ok(!ir.findings.some(f=>f.rule==='unity/meta/duplicate-guid'));
});
test('modern prefab asset handles and override provenance do not masquerade as missing live components',t=>{
  const {root,put}=sceneFixture(t);put('Assets/P.prefab','--- !u!1 &7\nGameObject:\n  m_Name: Shared\n');
  const g=buildSignalGraph(root);assert.ok(g.edges.some(e=>e.resolution==='prefab-asset-handle'));assert.ok(!g.findings.some(f=>f.target?.endsWith('#100100000')));
  assert.ok(g.edges.some(e=>e.from.includes(':Start')&&e.to.includes(':Run')&&e.status==='syntax-candidate'));
});
test('graph output cannot write through a symlink into source folders',t=>{
  const {root}=sceneFixture(t);fs.symlinkSync(path.join(root,'Assets'),path.join(root,'alias'),'dir');const g=buildSignalGraph(root);
  assert.throws(()=>writeGraph(g,path.join(root,'alias','generated')),/outside Unity/);
});

test('orphan Timeline keys remain provenance when no playable asset is assigned',t=>{
  const {root,put}=sceneFixture(t);put('Assets/B.unity','--- !u!320 &1\nPlayableDirector:\n  m_PlayableAsset: {fileID: 0}\n  m_SceneBindings:\n  - key: {fileID: 999}\n    value: {fileID: 0}\n');
  const g=buildSignalGraph(root),f=g.findings.find(f=>f.evidence.file==='Assets/B.unity'&&f.target?.endsWith('#999'));assert.equal(f.category,'provenance');assert.equal(f.severity,'info');
});
