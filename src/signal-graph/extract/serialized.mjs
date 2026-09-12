import fs from 'node:fs';
import path from 'node:path';
import { parseUnityDocuments } from '../../unity/yaml.mjs';
import { fileNodeId, objectNodeId, serializedExtensions } from '../graph.mjs';

function fields(data) {
  const result={};
  for(const [key,v] of Object.entries(data??{})) {
    if (['m_ObjectHideFlags','m_EditorHideFlags','serializedVersion'].includes(key)) continue;
    if (v===null || typeof v!=='object') result[key]=typeof v==='string'&&v.length>512?{length:v.length,omitted:'large scalar; read source'}:v;
    else if (!Array.isArray(v) && Object.values(v).every(x=>x===null || typeof x!=='object')) result[key]=v;
  }
  return result;
}
function visit(value, fn, field='') {
  if (!value || typeof value!=='object') return;
  fn(value,field);
  for(const [k,v] of Object.entries(value)) visit(v,fn,Array.isArray(value)?`${field}[${k}]`:(field?`${field}.${k}`:k));
}
export function extractSerialized(g,file) {
  const info=g.source(file), ext=path.extname(file);
  if (!serializedExtensions.has(ext) || !info.sha256) return;
  const text=fs.readFileSync(path.resolve(g.root,file),'utf8');
  if (!/^%YAML|^--- !u!/m.test(text)) {info.status='import-unverified';return;}
  const docs=parseUnityDocuments(text), map=new Map();g.documents.set(file,map);info.status='parsed';info.documentCount=docs.length;
  if(!docs.length) {info.status='partial';g.finding('unilint/serialization/unsupported','coverage','No supported Unity document headers in serialized input.',g.evidence(file),{origin:'analyzer',certainty:'certain'});}
  for(const d of docs) {
    if(map.has(d.fileId)) g.finding('unity/serialization/duplicate-file-id','structural',`Duplicate document ID ${d.fileId}.`,g.evidence(file,d),{severity:'error',certainty:'certain'});
    map.set(d.fileId,d);
    const kind=d.classId===1?'object':d.classId===1001?'prefab-instance':d.data?.m_GameObject?'component':'serialized-asset';
    g.node({id:objectNodeId(file,d.fileId),kind,label:d.data?.m_Name||`${d.type} #${d.fileId}`,file,fileId:d.fileId,classId:d.classId,type:d.type,stripped:d.stripped,line:d.line,settings:fields(d.data)});
    g.edge(fileNodeId(file),objectNodeId(file,d.fileId),'contains',g.evidence(file,d));
    if(d.error) {info.status='partial';g.finding('unilint/serialization/unsupported','coverage',d.error,g.evidence(file,d),{origin:'analyzer',certainty:'certain'});}
  }
  for(const d of docs) {
    const id=objectNodeId(file,d.fileId), data=d.data??{};
    for(const ref of d.references) {
      const r=g.reference(file,ref);if(!r.target) continue;
      let kind='references';
      if (ref.field==='m_GameObject') kind='owned-by';
      else if (/^m_Component\[\d+\]\.component$/.test(ref.field)) kind='contains-component';
      else if(ref.field==='m_Father') kind='parent';
      else if(ref.field.startsWith('m_Children[')) kind='child';
      else if(['m_SourcePrefab','m_ParentPrefab'].includes(ref.field) && d.classId===1001) kind='instantiates';
      else if(ref.field==='m_Script') kind='script-binding';
      else if(ref.field.includes('m_RemovedComponents')) kind='removes-component';
      else if(ref.field.includes('m_AddedComponents')) kind='adds-component';
      const evidence=g.evidence(file,d,ref.field);
      g.edge(id,r.target,kind,evidence,{resolution:r.status,targetFile:r.file,targetFileId:r.fileId});
      if(['unresolved-guid','ambiguous-guid'].includes(r.status)) g.finding(`unity/reference/${r.status}`,'references',`Reference ${ref.guid} cannot be uniquely resolved in the selected project/package metadata.`,evidence,{target:r.target,certainty:'medium',nextAction:'Check package, imported-asset and prefab provenance before treating this as a missing game object.'});
    }
    for (const [i,m] of (data.m_Modification?.m_Modifications??[]).entries()) {
      if (!m.target) continue;
      const r=g.reference(file,{fileId:String(m.target.fileID),guid:m.target.guid});
      if(r.target) g.edge(id,r.target,'overrides',g.evidence(file,d,`m_Modification.m_Modifications[${i}].target`),{propertyPath:m.propertyPath,value:m.value,objectReference:m.objectReference??null,resolution:r.status,targetFile:r.file,targetFileId:r.fileId,status:'serialized-override'});
    }
    visit(data,(v,field)=>{
      if(v.m_MethodName && v.m_Target) {
        const r=g.reference(file,{fileId:String(v.m_Target.fileID),guid:v.m_Target.guid});
        if(r.target) g.edge(id,r.target,'invokes-event',g.evidence(file,d,field),{method:v.m_MethodName,callState:v.m_CallState??null,arguments:v.m_Arguments??null,resolution:r.status,targetFile:r.file,targetFileId:r.fileId,status:'serialized-binding',runtime:'unverified'});
      }
      if (v.functionName) {
        const target=`animation-event:${file}:${field}`;g.node({id:target,kind:'unresolved-method',label:v.functionName,file});
        g.edge(id,target,'animation-event',g.evidence(file,d,field),{method:v.functionName,time:v.time??null,status:'receiver-unresolved'});
      }
    });
  }
}
