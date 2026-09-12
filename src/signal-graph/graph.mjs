import fs from 'node:fs';
import path from 'node:path';
import { sha256 } from '../unity/build-settings.mjs';
import { isBuiltinGuid } from '../unity/meta.mjs';

export const GRAPH_SCHEMA = 'unilint.signal-graph.v1';
export const fileNodeId = file => `asset:${file}`;
export const objectNodeId = (file, id) => `${fileNodeId(file)}#${id}`;
export const stableId = (kind, parts) => `${kind}:${sha256(JSON.stringify(parts)).slice(0,24)}`;
export const serializedExtensions = new Set(['.unity','.prefab','.asset','.mat','.controller','.anim','.overridecontroller','.playable']);
export class GraphBuilder {
  constructor(root, ir) {
    this.root=root; this.ir=ir; this.nodes=new Map(); this.edges=new Map(); this.findings=new Map();
    this.files=new Map(); this.documents=new Map(); this.dependencies=new Map(); this.scripts=new Map(); this.queue=[]; this.queued=new Set();
  }
  node(node) { const old=this.nodes.get(node.id); if (old) Object.assign(old,node); else this.nodes.set(node.id,node); return node.id; }
  edge(from,to,kind,evidence,detail={}) {
    const id=stableId('edge',[from,to,kind,evidence,detail]);
    this.edges.set(id,{id,from,to,kind,status:'source-confirmed',evidence,...detail}); return id;
  }
  finding(rule,category,message,evidence,details={}) {
    const id=stableId('finding',[rule,evidence,details.field??null,details.target??null]);
    this.findings.set(id,{id,rule,category,message,severity:'warning',certainty:'high',evidence,origin:'project',...details});return id;
  }
  source(file) {
    if (this.files.has(file)) return this.files.get(file);
    const absolute=path.resolve(this.root,file); let info;
    try { const bytes=fs.readFileSync(absolute); info={path:file,sha256:sha256(bytes),bytes:bytes.length,status:'inventoried'}; }
    catch(error) { info={path:file,sha256:null,status:'unavailable',error:error.message}; }
    this.files.set(file,info); this.node({id:fileNodeId(file),kind:path.extname(file)==='.unity'?'scene':'asset',label:path.basename(file),file});return info;
  }
  evidence(file,record,field=null) { const info=this.source(file);return {file,sha256:info.sha256,line:record?.line??1,fileId:record?.fileId??null,field,method:'serialized-source'}; }
  addDependency(from,to) { if (!this.dependencies.has(from)) this.dependencies.set(from,new Set()); this.dependencies.get(from).add(to); }
  enqueue(file) { if (!this.queued.has(file)) { this.queued.add(file);this.queue.push(file); } }
  reference(file,ref) {
    if (ref.fileId==='0') return {status:'unassigned',target:null};
    if (ref.guid && isBuiltinGuid(ref.guid)) {
      const target=`builtin:${ref.guid}#${ref.fileId}`;this.node({id:target,kind:'builtin',label:`Built-in ${ref.fileId}`});return {status:'builtin',target};
    }
    if (!ref.guid || /^0{32}$/.test(ref.guid)) return {status:'local-pending',target:objectNodeId(file,ref.fileId),file,fileId:ref.fileId};
    const paths=this.ir.guidGraph.guidToAssets[ref.guid]??[];
    if (paths.length!==1) {
      const target=`unresolved:${ref.guid}#${ref.fileId}`;this.node({id:target,kind:'unresolved',label:ref.guid,paths});
      return {status:paths.length?'ambiguous-guid':'unresolved-guid',target};
    }
    const targetFile=paths[0];this.source(targetFile);this.addDependency(file,targetFile);
    // Cross-scene references are boundaries, never an implicit scope expansion.
    if (path.extname(targetFile)!=='.unity') this.enqueue(targetFile);
    const ext=path.extname(targetFile);
    const target=ext==='.cs'?fileNodeId(targetFile):(serializedExtensions.has(ext)?objectNodeId(targetFile,ref.fileId):`imported:${targetFile}#${ref.fileId}`);
    if (!serializedExtensions.has(ext) && ext!=='.cs') this.node({id:target,kind:'imported-object',label:`${path.basename(targetFile)} #${ref.fileId}`,file:targetFile,validation:'import-unverified'});
    return {status:ext==='.cs'?'script-asset':serializedExtensions.has(ext)?'external-pending':'imported-unverified',target,file:targetFile,fileId:ref.fileId};
  }
  finishReferences() {
    for (const e of this.edges.values()) {
      if (!['local-pending','external-pending'].includes(e.resolution)) continue;
      const docs=this.documents.get(e.targetFile);
      if (docs?.has(e.targetFileId)) e.resolution=e.targetFile===e.evidence.file?'resolved-local':'resolved-external';
      else if (e.targetFile?.endsWith('.prefab') && e.targetFileId === '100100000') {
        e.resolution='prefab-asset-handle';this.node({id:e.to,kind:'prefab-definition',label:e.targetFile,file:e.targetFile,validation:'asset handle; imported object unverified'});
      } else if (!docs || this.files.get(e.targetFile)?.status!=='parsed') {
        e.resolution='unverified-target';this.node({id:e.to,kind:'unresolved',label:e.to,file:e.targetFile});
      } else if (e.targetFile !== e.evidence.file && [...docs.values()].some(d=>d.classId===1001)) {
        e.resolution='unverified-prefab-target';this.node({id:e.to,kind:'unresolved',label:e.to,file:e.targetFile,validation:'Nested prefab target may be supplied by import; effective instance unverified'});
      } else {
        e.resolution='missing-file-id';this.node({id:e.to,kind:'unresolved',label:e.to,file:e.targetFile});
        const provenance=/m_CorrespondingSourceObject|m_PrefabParentObject|m_PrefabInternal|m_Modifications\[\d+\](?:\.target)?$/.test(e.evidence.field??'');
        this.finding('unity/reference/missing-file-id',provenance?'provenance':'structural',`Saved reference target ${e.targetFileId} is absent from ${e.targetFile}.`,e.evidence,{target:e.to,certainty:'certain',severity:provenance?'info':'warning',nextAction:'Inspect the saved binding and relevant prefab/import context; runtime failure is not established.'});
      }
    }
  }
}
