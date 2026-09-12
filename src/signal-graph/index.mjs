import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { indexUnityProject } from '../core/indexer.mjs';
import { readJson, walk, outputPathOutsideSource } from '../core/fs.mjs';
import { sha256 } from '../unity/build-settings.mjs';
import { GraphBuilder, GRAPH_SCHEMA, fileNodeId, stableId } from './graph.mjs';
import { routeGame } from './routes/game.mjs';
import { routeScene } from './routes/scene.mjs';
import { routePrefab } from './routes/prefab.mjs';
import { routeScript } from './routes/script.mjs';
import { inspectBindings } from './bindings.mjs';
import { runAudit } from '../rules/audit.mjs';

const toolRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const textual=/\.(?:meta|cs|json|asmdef|asmref|unity|prefab|asset|mat|anim|controller|overridecontroller|playable|shader|mjs)$/i;
export function analyzerIdentity() {
  const files=walk(path.join(toolRoot,'src')).filter(x=>x.type==='file').map(x=>x.path).sort();
  files.push(path.join(toolRoot,'package.json'),path.join(toolRoot,'package-lock.json'));
  return {version:readJson(path.join(toolRoot,'package.json')).version,sha256:sha256(files.map(p=>`${path.relative(toolRoot,p)}:${sha256(fs.readFileSync(p))}`).join('\n'))};
}
function gitInfo(root) {
  try { return {commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim(),branch:execFileSync('git',['branch','--show-current'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim()}; }
  catch { return {commit:null,branch:null}; }
}
export function projectFingerprint(root, packages=[]) {
  const roots=['Assets','Packages','ProjectSettings',...packages.filter(p=>p.status==='resolved').map(p=>p.path)].map(p=>path.resolve(root,p));
  const map=new Map();
  for(const r of roots) for(const e of walk(r)) if(e.type==='file') {
    const rel=path.relative(root,e.path).split(path.sep).join('/');
    if(map.has(rel)) continue;
    const stat=fs.statSync(e.path);map.set(rel,textual.test(rel)?sha256(fs.readFileSync(e.path)):`binary-unverified:${stat.size}:${stat.mtimeMs}`);
  }
  return sha256(JSON.stringify([...map].sort((a,b)=>a[0].localeCompare(b[0]))));
}
function closure(g,scene) {
  const result=new Set(),stack=[scene];
  while(stack.length) {const file=stack.pop();if(result.has(file)) continue;result.add(file);for(const d of g.dependencies.get(file)??[]) if(path.extname(d)!=='.unity') stack.push(d);}
  return result;
}
export function buildSignalGraph(project,options={}) {
  const root=path.resolve(project),start=performance.now(),initialSource=projectFingerprint(root);
  const ir=indexUnityProject(root),identity=analyzerIdentity();
  if(initialSource!==projectFingerprint(root)) throw new Error('Project changed during indexing; rerun against stable sources.');
  const routed=routeGame(root,options),g=new GraphBuilder(root,ir);
  const before=projectFingerprint(root,ir.packageResolution);
  for(const scene of routed.scenes) {
    if(scene.exists) g.enqueue(scene.path);
    for(const error of scene.errors) g.finding('unity/build-list/invalid-entry','structural',error,{file:routed.settings.file,sha256:routed.settings.sha256,line:1},{severity:'error',certainty:'certain',target:scene.path});
  }
  while(g.queue.length) {
    const file=g.queue.shift();
    if(path.extname(file)==='.cs') routeScript(g,file);
    else if(path.extname(file)==='.unity') routeScene(g,file);
    else routePrefab(g,file);
  }
  g.finishReferences();inspectBindings(g);
  for(const item of runAudit({...ir,scripts:ir.scripts.filter(s=>g.scripts.has(s.path))}).findings) {
    if(item.file && !g.files.has(item.file) && !['assemblies','coverage','packages'].includes(item.category)) continue;
    // Detailed references supersede the inventory's GUID-only duplicate notices.
    if(item.rule==='unity/references/unresolved-guid') continue;
    const sourceFile=item.file??item.evidence?.find(e=>e.kind==='guid-paths')?.paths?.[0]??'Packages/manifest.json';
    const evidence={file:sourceFile,sha256:item.file&&fs.existsSync(path.resolve(root,item.file))?sha256(fs.readFileSync(path.resolve(root,item.file))):null,line:item.line??1,method:'static-rule'};
    g.finding(item.rule,item.category,item.message,evidence,{severity:item.severity,certainty:item.certainty,origin:item.category==='coverage'?'analyzer':'project',global:!item.file||['assemblies','coverage','packages'].includes(item.category),details:item.evidence??[],nextAction:item.recommendation??'Inspect the source evidence and configuration before changing the project.'});
  }
  const sceneTargets=routed.settings.entries;
  for(const node of g.nodes.values()) if(node.kind==='scene-target') {
    const candidates=sceneTargets.filter(s=>s.path===node.label||s.path.replace(/\.unity$/,'')===node.label||path.basename(s.path,'.unity')===node.label);
    node.matches=candidates.map(s=>({path:s.path,guid:s.guid,enabled:s.enabled}));
    node.resolution=candidates.length===1?'build-list-match':candidates.length?'ambiguous-name':'outside-build-list';
    for(const s of candidates) {g.source(s.path);g.edge(node.id,fileNodeId(s.path),'names-scene',{file:routed.settings.file,sha256:routed.settings.sha256,line:1,method:'build-list'},{enabled:s.enabled,status:'literal-name-match'});}
  }
  const findings=[...g.findings.values()].sort((a,b)=>a.id.localeCompare(b.id));
  const globalIds=findings.filter(f=>f.global).map(f=>f.id);
  const scenes=routed.scenes.map(s=>{
    const files=closure(g,s.path), own=g.documents.get(s.path);
    const ids=findings.filter(f=>files.has(f.evidence.file)||f.target===s.path).map(f=>f.id);
    const errors=[...files].filter(f=>['partial','unavailable','import-unverified'].includes(g.files.get(f)?.status));
    const nodes=[...g.nodes.values()].filter(n=>n.file===s.path);
    const typeCounts={};for(const n of nodes) if(n.classId) typeCounts[n.type]=(typeCounts[n.type]??0)+1;
    const outgoing=[...g.edges.values()].filter(e=>['loads','unloads'].includes(e.kind)&&files.has(e.evidence.file)).map(e=>e.id);
    return {...s,name:path.basename(s.path,'.unity'),nodeId:fileNodeId(s.path),files:[...files].sort(),documentCount:own?.size??0,typeCounts,findingIds:ids,globalFindingIds:globalIds,outgoing,
      coverage:{identity:s.errors.length?'findings':'checked',hierarchy:own?'source-indexed':'unavailable',prefabs:'definitions-and-overrides-indexed; imported effective instances unverified',references:'checked-with-explicit-resolution-states',scripts:'lexical-source; package availability recorded',events:'serialized-bindings; method compatibility and dispatch unverified',ownership:'saved GameObject/component and transform references; effective instances unverified',activation:'saved active/enabled scalars and lexical SetActive candidates; runtime state unverified',animation:'controller/clip references and explicit animation events; Timeline dispatch and blended timing unverified',physics:'saved colliders, bodies, layers and trigger scalars indexed; interaction matrix and runtime contacts not evaluated',rendering:'saved camera, listener and renderer settings indexed; effective ownership and rendered output not evaluated',runtimeCreation:'lexical Instantiate candidates; dynamic targets and lifetime unresolved',persistence:'lexical PlayerPrefs call candidates; data lifecycle and runtime effects unverified',configuration:'saved scalar/reference fields; nested values retained in source',sceneLinks:'literal-candidates-only',performance:'static-heuristics-only',unsupportedFiles:errors,runtime:'unverified',semanticInference:'not-performed'},
      nextAction:ids.length?'Review the highest-confidence finding, its saved binding and relevant overrides.':'Review unsupported/runtime-dependent paths before treating this scene as gameplay-verified.'};
  });
  const after=projectFingerprint(root,ir.packageResolution);
  if(before!==after) throw new Error('Project changed during extraction. No consistent snapshot produced; rerun against a stable source state.');
  const graph={schemaVersion:GRAPH_SCHEMA,run:{collectedAt:new Date().toISOString(),seconds:(performance.now()-start)/1000,projectRoot:root,project:ir.identity,git:gitInfo(root),analyzer:identity,sourceFingerprint:after,fingerprintPolicy:'All inventoried text content plus binary size/mtime; imported binary internals unverified.',scope:options.scope??'build-list',selectors:options.scenes??[]},buildSettings:routed.settings,packageResolution:ir.packageResolution,assemblyCoverage:{complete:ir.assemblies.complete,definitions:ir.assemblies.definitions.length,references:ir.assemblies.references.length,errors:ir.assemblies.errors??[]},files:[...g.files.values()].sort((a,b)=>a.path.localeCompare(b.path)),nodes:[...g.nodes.values()].sort((a,b)=>a.id.localeCompare(b.id)),edges:[...g.edges.values()].sort((a,b)=>a.id.localeCompare(b.id)),findings,scenes};
  return graph;
}
export function checkFreshness(graph,{checkAnalyzer=true}={}) {
  if(graph.schemaVersion!==GRAPH_SCHEMA) return {fresh:false,reason:'schema-mismatch'};
  if(checkAnalyzer&&analyzerIdentity().sha256!==graph.run.analyzer.sha256) return {fresh:false,reason:'analyzer-changed'};
  if(projectFingerprint(graph.run.projectRoot,graph.packageResolution)!==graph.run.sourceFingerprint) return {fresh:false,reason:'project-changed'};
  return {fresh:true,reason:'matched-source-and-analyzer'};
}
export function writeGraph(graph,directory) {
  const out=outputPathOutsideSource(graph.run.projectRoot,directory);
  fs.mkdirSync(path.dirname(out),{recursive:true});fs.mkdirSync(out); // Refuse overwriting any existing directory.
  fs.writeFileSync(path.join(out,'graph.json'),JSON.stringify(graph));
  const owner={schemaVersion:'unilint.run.v1',id:stableId('run',[out,graph.run.collectedAt]),createdBy:'unilint',files:['graph.json','run.json'],status:'complete',projectRoot:graph.run.projectRoot,analyzer:graph.run.analyzer,collectedAt:graph.run.collectedAt};
  fs.writeFileSync(path.join(out,'run.json'),JSON.stringify(owner,null,2)+'\n');return out;
}
export function loadGraph(directory,{allowStale=false}={}) {
  const graph=readJson(path.join(directory,'graph.json'));const freshness=checkFreshness(graph);
  if(!freshness.fresh&&!allowStale) throw new Error(`Cached graph is stale: ${freshness.reason}. Rebuild or use --allow-stale for explicitly historical queries.`);
  return {graph,freshness};
}
