import fs from 'node:fs';
import path from 'node:path';
import { extractCSharp } from '../extract/csharp.mjs';
import { fileNodeId, stableId } from '../graph.mjs';
export function routeScript(g,file) {
  const info=g.source(file);if(!info.sha256) return;
  const data=extractCSharp(fs.readFileSync(path.resolve(g.root,file),'utf8'));g.scripts.set(file,data);info.status='syntax-indexed';
  for(const m of data.methods) {
    const id=`method:${file}:${m.line}:${m.name}`;g.node({id,kind:'method',label:m.name,file,line:m.line});
    g.edge(fileNodeId(file),id,'declares',{file,sha256:info.sha256,line:m.line,method:'csharp-lexical'});
  }
  for(const s of data.signals) {
    const from=`method:${file}:${s.methodLine}:${s.method}`;
    const matching=data.methods.filter(m=>m.name===s.callee);
    const to=matching.length===1?`method:${file}:${matching[0].line}:${matching[0].name}`:s.literal&&['loads','unloads'].includes(s.kind)?`scene-target:${s.literal}`:stableId('candidate',[file,s.callee,s.kind]);
    if(!g.nodes.has(to)) g.node({id:to,kind:s.literal&&['loads','unloads'].includes(s.kind)?'scene-target':'call-target',label:s.literal??s.callee,file:s.literal?undefined:file});
    g.edge(from,to,s.kind,{file,sha256:info.sha256,line:s.line,method:'csharp-lexical'},{...s});
  }
  // Field declarations are facts; their binding to Unity native types is separately qualified.
  g.nodes.get(fileNodeId(file)).fields=data.fields;
  g.nodes.get(fileNodeId(file)).scriptCoverage=data.coverage;
}
