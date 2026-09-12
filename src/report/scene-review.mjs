import fs from 'node:fs';
import { gzipSync } from 'node:zlib';
import { outputPathOutsideSource } from '../core/fs.mjs';
const rank={critical:0,error:1,warning:2,info:3};
export function sceneReport(graph) {
  const byId=new Map(graph.findings.map(f=>[f.id,f]));
  return {schemaVersion:'unilint.scene-report.v1',run:graph.run,counts:{scenes:graph.scenes.length,enabled:graph.scenes.filter(s=>s.enabled).length,findings:graph.findings.length,nodes:graph.nodes.length,edges:graph.edges.length},globalFindings:graph.findings.filter(f=>f.global),scenes:graph.scenes.map(s=>({...s,findings:s.findingIds.map(id=>byId.get(id)).filter(Boolean).sort((a,b)=>(rank[a.severity]??9)-(rank[b.severity]??9)||a.id.localeCompare(b.id))})),limits:['Static extraction does not prove imported or runtime behavior.','Prefab definitions and override records are indexed; complete effective runtime instances are unverified.','C# calls, waits and load targets are lexical candidates; conditional compilation and dynamic dispatch are unresolved.']};
}
function md(s){return String(s??'').replace(/\|/g,'\\|').replace(/[\r\n]+/g,' ');}
export function reportMarkdown(report) {
  let out=`# ${md(report.run.project.name)} — static scene audit\n\nCollected: ${report.run.collectedAt}. Analyzer ${report.run.analyzer.version} / ${report.run.analyzer.sha256}.\n\n${report.counts.scenes} scenes (${report.counts.enabled} enabled). Runtime unverified. Counts are source records, not live object counts.\n\n`;
  out+='| Scene | Build state | Findings | Unsupported files |\n|---|---|---:|---:|\n';
  for(const s of report.scenes) out+=`| [${md(s.name)}](#scene-${s.guid}) | ${s.enabled?'Enabled':'Disabled'} | ${s.findings.length} | ${s.coverage.unsupportedFiles.length} |\n`;
  for(const s of report.scenes) {
    out+=`\n<a id="scene-${s.guid}"></a>\n\n## ${md(s.name)}\n\nSource: \`${s.path}\` · SHA-256 \`${s.sha256}\`.\n\n${s.documentCount} scene documents; ${s.files.length} source/dependency files. ${s.enabled?'Enabled':'Disabled'} in Build Settings.\n\n`;
    out+='### Findings\n\n';
    if(!s.findings.length) out+='No findings were produced by the completed checks listed here.\n';
    for(const f of s.findings) out+=`- **${md(f.severity)} / ${md(f.certainty)} — ${md(f.category)}:** ${md(f.message)} Evidence: \`${md(f.evidence.file)}:${f.evidence.line}\`, field \`${md(f.evidence.field)}\`. ${md(f.nextAction??f.limitation??'Runtime consequence unverified.')}\n`;
    out+='\n### Coverage and next action\n\n';
    for(const [k,v] of Object.entries(s.coverage)) out+=`- ${k}: ${md(Array.isArray(v)?v.join(', '):v)}\n`;
    out+=`\nNext: ${s.nextAction}\n`;
  }
  out+='\n## Shared project/analysis findings\n\n';for(const f of report.globalFindings) out+=`- ${md(f.message)} (${f.rule})\n`;
  return out;
}
export function writeReport(graph,out,format='markdown') {
  if(!['markdown','json','html'].includes(format)) throw new Error('Report format must be markdown, json or html.');
  const report=sceneReport(graph),text=format==='json'?JSON.stringify(report,null,2):format==='html'?reportHtml(report,graph):reportMarkdown(report);
  if(out) {const dest=outputPathOutsideSource(graph.run.projectRoot,out);fs.writeFileSync(dest,text,{flag:'wx'});}
  return {report,text};
}

async function browserReview() {
  const encoded=document.getElementById('audit-data').textContent;
  const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
  const data=JSON.parse(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text()),report=data.report;
  const byFinding=new Map(data.findings.map(f=>[f.id,f]));
  for(const s of report.scenes)s.findings=s.findingIds.map(id=>byFinding.get(id)).filter(Boolean);
  const nodes=new Map(data.nodes.map(n=>[n.id,n]));
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(cls)n.className=cls;return n;};
  const sourceLink=(file,line)=>{const a=el('a','Open source'+(line?' · line '+line:''));a.href='file://'+(report.run.projectRoot+'/'+file).split('/').map(encodeURIComponent).join('/');a.target='_blank';a.rel='noopener';return a;};
  let current=null,offset=0,focus=null,direction='outgoing',onlyConfirmed=false,shownFindings=30;
  const meta=report.counts.scenes+' scenes · '+report.counts.enabled+' enabled · '+report.counts.findings+' finding records · Runtime unverified';
  document.getElementById('meta').textContent=meta;
  function focusNode(id){const scene=report.scenes.find(s=>s.nodeId===id);if(scene){choose(scene);return;}focus=id;offset=0;render();}
  function choose(s){current=s;focus=null;offset=0;shownFindings=30;render();list();}
  function list(){const q=document.getElementById('search').value.toLowerCase(),root=document.getElementById('scenes');root.replaceChildren();const overview=el('button','All scenes / shared systems');overview.onclick=()=>choose(null);root.append(overview);for(const s of report.scenes.filter(s=>s.name.toLowerCase().includes(q))){const b=el('button',s.name+' — '+(s.enabled?'enabled':'disabled')+' · '+s.findings.length);b.setAttribute('aria-current',s.guid===current?.guid);b.onclick=()=>choose(s);root.append(b);}}
  function details(title,value){const d=el('details');d.append(el('summary',title),el('pre',JSON.stringify(value,null,2)));return d;}
  function destinations(scene){const outgoing=new Set(scene.outgoing),targets=new Set(data.edges.filter(e=>outgoing.has(e.id)).map(e=>e.to));return data.edges.filter(e=>e.kind==='names-scene'&&targets.has(e.from));}
  function destinationControls(scene,root){const links=destinations(scene);if(!links.length)return;root.append(el('h3','Known scene destinations'),el('p','Literal source matches; runtime transitions remain unverified.','note'));for(const link of links){const target=report.scenes.find(s=>s.nodeId===link.to);if(target){const b=el('button','Open destination: '+target.name);b.onclick=()=>choose(target);root.append(b);}else root.append(el('p',(nodes.get(link.to)?.label??link.to)+' — outside this extraction scope'));}}
  function overview(root){root.append(el('h2','All build-list scenes'),el('p','Select a scene to inspect saved objects, findings and source connections. Disabled scenes are included. Shared findings are stored once and linked to their consumers.'),el('p',report.run.collectedAt+' · UniLint '+report.run.analyzer.version),details('Source revision and evidence limits',{run:report.run,limits:report.limits}));
    root.append(el('h3','Known scene links'));for(const source of report.scenes)for(const link of destinations(source)){const target=report.scenes.find(s=>s.nodeId===link.to);const row=el('p'),b=el('button',source.name);b.onclick=()=>choose(source);row.append(b,document.createTextNode(' → '+(target?.name??link.to)+' · source candidate'));root.append(row);}
    const table=el('table'),head=el('tr');for(const h of ['Scene','Build','Structure','Configuration','Provenance','Other records'])head.append(el('th',h));table.append(head);
    for(const s of report.scenes){const row=el('tr'),cell=el('td'),b=el('button',s.name);b.onclick=()=>choose(s);cell.append(b);row.append(cell,el('td',s.enabled?'Enabled':'Disabled'));for(const c of ['structural','configuration','provenance'])row.append(el('td',s.findings.filter(f=>f.category===c).length));row.append(el('td',s.findings.filter(f=>!['structural','configuration','provenance'].includes(f.category)).length));table.append(row);}root.append(table);
    const usage=new Map();for(const s of report.scenes)for(const file of s.files)if(file!==s.path){if(!usage.has(file))usage.set(file,[]);usage.get(file).push(s);}
    root.append(el('h3','Shared dependencies'));for(const [file,scenes]of[...usage].filter(x=>x[1].length>1).sort((a,b)=>b[1].length-a[1].length||a[0].localeCompare(b[0])).slice(0,20)){const d=el('details');d.append(el('summary',file+' · '+scenes.length+' scenes'));for(const s of scenes){const b=el('button',s.name);b.onclick=()=>choose(s);d.append(b);}root.append(d);}
    root.append(details('Shared project and analyzer findings',report.globalFindings),el('p','Shared dependencies above are the 20 most reused source files. They are not inferred gameplay systems.','note'));
  }
  function graphView(edges,root){
    const selected=focus??edges[0]?.from;if(!selected)return;
    const neighbors=[...new Set(edges.filter(e=>e.from===selected||e.to===selected).map(e=>e.from===selected?e.to:e.from))].slice(0,8);
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 900 360');svg.setAttribute('role','img');svg.setAttribute('aria-label','Bounded source connection graph');svg.classList.add('graph');
    function sn(tag,attrs){const n=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);svg.append(n);return n;}
    function box(id,x,y){const rect=sn('rect',{x,y,width:230,height:42,fill:id===selected?'#16364c':'#e5eef5',stroke:'#8da2b3',tabindex:0,role:'button'}),label=nodes.get(id)?.label??id;rect.setAttribute('aria-label',label);rect.onclick=()=>focusNode(id);rect.onkeydown=e=>{if(e.key==='Enter')rect.onclick();};const text=sn('text',{x:x+10,y:y+26,fill:id===selected?'white':'#18232f','font-size':13,'pointer-events':'none'});text.textContent=label.length>30?label.slice(0,29)+'…':label;const title=document.createElementNS(ns,'title');title.textContent=label;rect.append(title);}
    neighbors.forEach((id,i)=>{const left=i%2===0,x=left?10:660,y=15+Math.floor(i/2)*85;sn('line',{x1:left?240:660,y1:y+21,x2:left?335:565,y2:180,stroke:'#8da2b3','stroke-width':2});box(id,x,y);});box(selected,335,159);root.append(svg,el('p','Showing up to 8 neighbors. The connection list below gives direction, evidence and further pages.','note'));
  }
  function render(){const root=document.getElementById('detail');root.replaceChildren();if(!current){overview(root);return;}
    root.append(el('h2',current.name),el('p',current.enabled?'Enabled in Build Settings':'Disabled in Build Settings','tag'),el('p',current.path,'note'),sourceLink(current.path,1),el('p',current.documentCount+' saved scene documents; '+current.files.length+' dependency files. Source counts are not live object counts.'),el('h3','What needs attention'));
    destinationControls(current,root);
    if(!current.findings.length)root.append(el('p','No findings were produced by the completed checks listed here.'));
    for(const f of current.findings.slice(0,shownFindings)){const row=el('div',undefined,'finding '+f.severity);row.append(el('div',f.severity+' / '+f.certainty+' / '+f.category,'tag'),el('p',f.message),el('p',f.nextAction??'Runtime consequence unverified.'),details('Evidence and limitations',f),sourceLink(f.evidence.file,f.evidence.line));root.append(row);}
    if(shownFindings<current.findings.length){const b=el('button','Show next 30 findings ('+(current.findings.length-shownFindings)+' remaining)');b.onclick=()=>{shownFindings+=30;render();};root.append(b);}
    root.append(details('Coverage and unresolved areas',current.coverage),el('p','Next: '+current.nextAction),el('h3','Explore source connections'));
    const bar=el('div',undefined,'toolbar'),back=el('button','Scene connections');back.onclick=()=>{focus=null;offset=0;render();};const dir=el('select');dir.setAttribute('aria-label','Connection direction');for(const x of ['outgoing','incoming']){const o=el('option',x);o.value=x;dir.append(o);}dir.value=direction;dir.onchange=()=>{direction=dir.value;offset=0;render();};const proof=el('button',onlyConfirmed?'Show candidates too':'Hide syntax candidates');proof.onclick=()=>{onlyConfirmed=!onlyConfirmed;offset=0;render();};bar.append(back,dir,proof);root.append(bar);
    const files=new Set(current.files),loadTargets=new Set(data.edges.filter(e=>current.outgoing.includes(e.id)).map(e=>e.to));let edges=data.edges.filter(e=>(files.has(e.evidence.file)||(e.kind==='names-scene'&&loadTargets.has(e.from)))&&(!onlyConfirmed||e.status!=='syntax-candidate'));if(focus)edges=edges.filter(e=>direction==='outgoing'?e.from===focus:e.to===focus);
    graphView(edges,root);root.append(el('p',(focus?'Node: '+(nodes.get(focus)?.label||focus)+' · ':'')+edges.length+' connections · showing '+Math.min(offset+1,edges.length)+'–'+Math.min(offset+30,edges.length)));
    for(const e of edges.slice(offset,offset+30)){const row=el('div',undefined,'flow');row.append(el('div',e.kind+' · '+e.status,'tag'));for(const id of [e.from,e.to]){const b=el('button',nodes.get(id)?.label||id);b.onclick=()=>focusNode(id);row.append(b,document.createTextNode(id===e.from?' → ':''));}row.append(details('Source connection details',e),sourceLink(e.evidence.file,e.evidence.line));root.append(row);}
    const pages=el('div',undefined,'toolbar');if(offset){const b=el('button','Previous 30');b.onclick=()=>{offset=Math.max(0,offset-30);render();};pages.append(b);}if(offset+30<edges.length){const b=el('button','Next 30');b.onclick=()=>{offset+=30;render();};pages.append(b);}root.append(pages,el('p','Containment and other reference edges remain available through UniLint query. Source evidence links open local files; imported/runtime behavior remains unverified.','note'));
  }
  document.getElementById('search').oninput=list;list();render();
}
export function reportHtml(report,graph) {
  const flowKinds=new Set(['loads','unloads','names-scene','declares','calls','invokes-event','animation-event','instantiates','overrides','script-binding','spawns','waits','subscribes','unsubscribes','activates','deactivates']);
  const edges=graph.edges.filter(e=>flowKinds.has(e.kind));const ids=new Set(edges.flatMap(e=>[e.from,e.to]));
  const data={report:{...report,scenes:report.scenes.map(({findings,...s})=>({...s,findingIds:findings.map(f=>f.id)}))},findings:graph.findings,nodes:graph.nodes.filter(n=>ids.has(n.id)).map(({id,kind,label,file,line})=>({id,kind,label,file,line})),edges};
  const payload=gzipSync(JSON.stringify(data)).toString('base64');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Unity scene audit</title><link rel="icon" href="data:,">
<style>*{box-sizing:border-box}body{margin:0;background:#f4f5f7;color:#18232f;font:16px/1.5 system-ui}header{padding:24px 32px;background:#172736;color:white}h1{margin:0;font-size:28px}main{display:grid;grid-template-columns:310px minmax(0,1fr);gap:24px;padding:24px}nav,article{background:white;border:1px solid #cad2da;padding:20px;min-width:0}nav{align-self:start;position:sticky;top:12px;max-height:85vh;overflow:auto}button,input,select{font:inherit;padding:7px;border:1px solid #9caebb;background:white;color:#172736}button{cursor:pointer}button:hover,button[aria-current=true]{background:#dce8f2}nav button{display:block;width:100%;text-align:left;margin:7px 0;overflow-wrap:anywhere}input{width:100%}h2{font-size:23px;overflow-wrap:anywhere}h3{font-size:18px}.note{color:#4a5b69;overflow-wrap:anywhere}.finding{border-left:4px solid #b87b22;padding:12px;margin:12px 0;background:#faf6ef}.error,.critical{border-color:#b42c32}.tag{font-size:12px;font-weight:700}summary{cursor:pointer;overflow-wrap:anywhere}.flow{border:1px solid #cad2da;padding:12px;margin:8px 0;overflow-wrap:anywhere}.toolbar{display:flex;gap:10px;flex-wrap:wrap}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#eef1f5;padding:12px;font-size:12px}.graph{width:100%;background:#f7fafc;border:1px solid #cad2da}.graph rect{cursor:pointer}table{border-collapse:collapse;width:100%;font-size:13px}th,td{border-bottom:1px solid #cad2da;text-align:left;padding:8px;overflow-wrap:anywhere}td button{font-size:13px}a{color:#165f8f}@media(max-width:800px){main{grid-template-columns:1fr}nav{position:static;max-height:300px}header{padding:18px}main{padding:12px}article{padding:12px}}
</style><header><h1>Unity scene audit</h1><div id="meta">Loading local audit…</div></header><main><nav><label for="search">Find a scene</label><input id="search" placeholder="Scene name"><div id="scenes"></div></nav><article id="detail"></article></main><script id="audit-data" type="application/octet-stream" data-encoding="gzip-base64">${payload}</script><script>(${browserReview.toString()})().catch(error=>{document.getElementById('detail').textContent='Could not load audit: '+error.message;});</script></html>`;
}
