export function queryGraph(graph,options={}) {
  const limit=Number(options.limit??30),offset=Number(options.offset??0),depth=Number(options.depth??1);
  if(!Number.isInteger(limit)||limit<1||limit>200||!Number.isInteger(offset)||offset<0||!Number.isInteger(depth)||depth<1||depth>5) throw new Error('Query limits: limit 1..200, offset >=0, depth 1..5.');
  const scene=options.scene?graph.scenes.find(s=>[s.guid,s.path].includes(options.scene)):null;
  if(options.scene&&!scene) throw new Error('Scene is not in this graph scope.');
  const scope=scene?new Set(scene.files):null;const view=options.view??'findings';
  let results;
  if(options.node) {
    if(!graph.nodes.some(n=>n.id===options.node)) throw new Error('Unknown node ID.');
    const direction=options.direction??'outgoing';if(!['incoming','outgoing'].includes(direction)) throw new Error('Direction must be incoming or outgoing.');
    const visited=new Set([options.node]),edges=new Map();let frontier=new Set([options.node]);
    for(let i=0;i<depth;i++) {const next=new Set();for(const e of graph.edges) {
      if(scope&&!scope.has(e.evidence.file)) continue;
      if(frontier.has(direction==='incoming'?e.to:e.from)) {edges.set(e.id,e);const id=direction==='incoming'?e.from:e.to;if(!visited.has(id)){visited.add(id);next.add(id);}}
    }frontier=next;}
    results=[...edges.values()];
  } else if(view==='findings') results=graph.findings.filter(f=>!scene||scene.findingIds.includes(f.id)||scene.globalFindingIds.includes(f.id));
  else if(view==='nodes') results=graph.nodes.filter(n=>!scope||scope.has(n.file));
  else if(view==='edges') results=graph.edges.filter(e=>!scope||scope.has(e.evidence.file));
  else if(view==='scenes') results=scene?[scene]:graph.scenes;
  else if(view==='files') results=graph.files.filter(f=>!scope||scope.has(f.path));
  else throw new Error('Unknown query view.');
  if(options.status) results=results.filter(x=>x.status===options.status||x.resolution===options.status);
  if(options.kind) results=results.filter(x=>x.kind===options.kind||x.category===options.kind);
  if(options.search) {const q=options.search.toLowerCase();results=results.filter(x=>JSON.stringify(x).toLowerCase().includes(q));}
  const total=results.length;return {schemaVersion:'unilint.query.v1',scope:scene?.guid??'graph',view,offset,limit,total,nextOffset:offset+limit<total?offset+limit:null,results:results.slice(offset,offset+limit),coverage:scene?.coverage??{runtime:'unverified',semantics:'static and lexical evidence only'}};
}
