import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {auditSceneContract} from '../src/rules/scene-contract.mjs';
const script='Assets/Scenes/';
function fixture(t) {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'unilint-contract-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const write=(file,value)=>{const dest=path.join(root,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,value)};
 write('ProjectSettings/ProjectVersion.txt','m_EditorVersion: 6000.3.28f1\n');
 let settings='--- !u!1045 &1\nEditorBuildSettings:\n  m_Scenes:\n';
 for(const [i,name] of ['Bootstrap','Level01_Cottage'].entries()){
  const id=String(i+1).repeat(32);write(script+name+'.unity','%YAML 1.1\n--- !u!1 &1001\nGameObject:\n  m_Name: '+name+'\n');write(script+name+'.unity.meta','guid: '+id+'\n');
  settings+=`  - enabled: 1\n    path: Assets/Scenes/${name}.unity\n    guid: ${id}\n`;
 }
 write('ProjectSettings/EditorBuildSettings.asset',settings);
 const source='a'.repeat(32);write('Assets/Resources/Base.prefab','--- !u!1 &1\nGameObject:\n  m_Name: Base\n');write('Assets/Resources/Base.prefab.meta','guid: '+source+'\n');
 write('Assets/Resources/Variant.prefab',`--- !u!1001 &1\nPrefabInstance:\n  m_SourcePrefab: {fileID: 100100000, guid: ${source}, type: 3}\n`);write('Assets/Resources/Variant.prefab.meta','guid: '+'b'.repeat(32)+'\n');
 return{root,write};
}
test('exact Unity patch, enabled scenes and prefab lineage pass independently',t=>{
 const {root}=fixture(t);const r=auditSceneContract(root,{unity:'6000.3.28f1',scenes:['Bootstrap','Level01_Cottage'],prefabs:['Assets/Resources/Variant.prefab']});assert.equal(r.status,'passed_static');assert.equal(r.prefabRelations.length,1);
});
test('wrong patch, missing scene and broken variant are rejected',t=>{
 const {root,write}=fixture(t);write('Assets/Resources/Variant.prefab','m_SourcePrefab: {fileID: 100100000, guid: '+'f'.repeat(32)+', type: 3}\n');const r=auditSceneContract(root,{unity:'6000.3.23f1',scenes:['Bootstrap','Level01_Cottage','Level02_Basement']});assert.equal(r.status,'failed_static');assert.ok(r.findings.some(x=>x.code==='EXACT_UNITY_MISMATCH'));assert.ok(r.findings.some(x=>x.code==='REQUIRED_SCENE_NOT_ENABLED'));assert.ok(r.findings.some(x=>x.code==='PREFAB_SOURCE_UNRESOLVED'));
});
