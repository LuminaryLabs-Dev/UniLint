import fs from 'node:fs';
import path from 'node:path';
import {readBuildSettings} from '../unity/build-settings.mjs';

// An independently reproducible source-level contract check. It does not
// execute Unity, imply shader compatibility, or manufacture Oracle evidence.
export function auditSceneContract(root,{unity=null,scenes=[],prefabs=[]}={}) {
  const project=path.resolve(root),findings=[];
  const add=(code,relativePath,detail)=>findings.push({code,file:relativePath,detail});
  const vfile=path.join(project,'ProjectSettings/ProjectVersion.txt');
  const version=fs.existsSync(vfile)?/^m_EditorVersion:\s*(\S+)/m.exec(fs.readFileSync(vfile,'utf8'))?.[1]:null;
  if (!version) add('MISSING_EDITOR_VERSION','ProjectSettings/ProjectVersion.txt','');
  if (unity && version!==unity) add('EXACT_UNITY_MISMATCH','ProjectSettings/ProjectVersion.txt',`${version} != ${unity}`);
  const build=readBuildSettings(project);
  for(const err of build.errors)add('INVALID_BUILD_SETTINGS',build.file,err);
  for(const item of build.entries)for(const err of item.errors)add('INVALID_BUILD_SCENE',item.path,err);
  const selected=build.entries.filter(s=>s.enabled);
  const seen=new Set();
  for(const scene of scenes){
    if(!/^[A-Za-z0-9_]+$/.test(scene))throw Error('INVALID_SCENE_NAME');
    if(seen.has(scene))throw Error('DUPLICATE_REQUIRED_SCENE');
    seen.add(scene);
    if(!selected.some(s=>s.path===`Assets/Scenes/${scene}.unity`))add('REQUIRED_SCENE_NOT_ENABLED',scene,'Expected enabled scene at Assets/Scenes/'+scene+'.unity');
  }
  // The build list is a progression contract, not merely a set of names.
  for(let i=0;i<scenes.length;i++) {
    const expected=`Assets/Scenes/${scenes[i]}.unity`;
    if(selected[i]?.path!==expected) add('REQUIRED_SCENE_ORDER',build.file,`Enabled index ${i} expected ${expected}, found ${selected[i]?.path??'(none)'}`);
  }
  const guidIndex=new Map(),serial=[];
  function walk(dir) {
    if (!fs.existsSync(dir))return;
    for(const d of fs.readdirSync(dir,{withFileTypes:true})){
      if (d.isSymbolicLink()) {add('SYMLINK_UNCHECKED',path.relative(project,path.join(dir,d.name)),'');continue;}
      const absolute=path.join(dir,d.name);
      if(d.isDirectory())walk(absolute);
      else if(d.isFile() && d.name.endsWith('.meta')) {
        const text=fs.readFileSync(absolute,'utf8');
        const guid=/^guid:\s*([a-f0-9]{32})\s*$/im.exec(text)?.[1]?.toLowerCase();
        const relative=path.relative(project,absolute).split(path.sep).join('/');
        if(!guid){add('INVALID_META',relative,'');continue;}
        if(guidIndex.has(guid))add('DUPLICATE_GUID',relative,guidIndex.get(guid));
        else guidIndex.set(guid,relative.replace(/\.meta$/,''));
      } else if(d.isFile() && d.name.endsWith('.prefab')) serial.push(absolute);
    }
  }
  walk(path.join(project,'Assets'));
  const checkedPrefabs=[];
  for(const name of prefabs){
    if(!/^Assets\/[a-zA-Z0-9_/-]+\.prefab$/.test(name))throw Error('INVALID_PREFAB_PATH');
    const full=path.join(project,name);
    if(!fs.existsSync(full))add('REQUIRED_PREFAB_MISSING',name,'');
    else if(!fs.existsSync(full+'.meta'))add('REQUIRED_PREFAB_META_MISSING',name,'');
    else checkedPrefabs.push(name);
  }
  const graph=new Map();
  for(const abs of serial){
    const rel=path.relative(project,abs).split(path.sep).join('/');
    const body=fs.readFileSync(abs,'utf8');
    const source=/m_SourcePrefab:\s*\{fileID:\s*-?\d+,\s*guid:\s*([a-f0-9]{32})/im.exec(body)?.[1]?.toLowerCase();
    if(source){
      const dep=guidIndex.get(source);
      if(!dep)add('PREFAB_SOURCE_UNRESOLVED',rel,source);
      else graph.set(rel,dep);
    }
  }
  for(const origin of graph.keys()){
    const visited=new Set();let next=origin;
    while(next && graph.has(next)){
      if(visited.has(next)){add('PREFAB_INHERITANCE_CYCLE',origin,next);break;}
      visited.add(next);next=graph.get(next);
    }
  }
  return {schema:'unilint-scene-contract/v1',status:findings.length?'failed_static':'passed_static',project,requestedUnity:unity,sourceUnity:version,enabledScenes:selected.map(s=>s.path),requiredScenes:scenes,checkedPrefabs,prefabRelations:[...graph].map(([variant,source])=>({variant,source})),guidCount:guidIndex.size,findings,scope:'Read-only Unity source contract; native import, compilation, graphics and player runtime unverified'};
}
