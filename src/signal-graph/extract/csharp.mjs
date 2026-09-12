// A bounded lexical extractor, not a C# compiler. Never asserts dynamic dispatch or reachability.
export function maskCSharp(text, strings=true) {
  const pattern=/\/\*[\s\S]*?\*\/|\/\/[^\n]*|@"(?:""|[^"])*"|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g;
  return text.replace(pattern, s => !strings && !s.startsWith('/') ? s : s.replace(/[^\n]/g,' '));
}
function closing(code,start,open='{',close='}') {
  let level=0;
  for(let i=start;i<code.length;i++) {if(code[i]===open) level++; else if(code[i]===close && --level===0) return i;}
  return code.length-1;
}
export function extractCSharp(text) {
  const code=maskCSharp(text), commentsRemoved=maskCSharp(text,false);
  const lineAt=i=>(text.slice(0,i).match(/\n/g)??[]).length+1;
  const methods=[], fields=[], signals=[];
  const pattern=/\b(?:public|private|protected|internal|static|virtual|override|sealed|async|new|partial|extern|unsafe|\s)*\b([\w.<>\[\]?]+)\s+(\w+)\s*\([^;{}]*\)\s*(?:where[^{}]+)?\{/g;
  for(const m of code.matchAll(pattern)) {
    if(['if','for','foreach','while','switch','catch','using','lock','return','new'].includes(m[1]) || ['if','for','while'].includes(m[2])) continue;
    const start=m.index+m[0].lastIndexOf('{'),end=closing(code,start);
    methods.push({name:m[2],returnType:m[1],line:lineAt(m.index+m[0].indexOf(m[1])),start,end});
  }
  const classNames=[...code.matchAll(/\b(?:class|struct|interface)\s+(\w+)/g)].map(m=>m[1]);
  for(const m of code.matchAll(/\b(public|private|protected|internal)\s+(?:(?:static|readonly|new|const)\s+)*([\w.<>\[\]?]+)\s+(\w+)\s*(?=[;=,])/g)) {
    if(methods.some(x=>m.index>x.start&&m.index<x.end)) continue;
    fields.push({name:m[3],type:m[2],line:lineAt(m.index),nativeTypeSyntax:(m[2].startsWith('UnityEngine.') || /\busing\s+UnityEngine\s*;/.test(code)) && !new RegExp(`\\busing\\s+${m[2]}\\s*=`).test(code) && !classNames.includes(m[2])});
  }
  for(const method of methods) {
    const body=code.slice(method.start+1,method.end);
    for(const m of body.matchAll(/\b([\w]+(?:\s*\.\s*\w+)*)\s*\(/g)) {
      const callee=m[1].replace(/\s/g,'');if(['if','for','foreach','while','switch','catch','using','lock','nameof','typeof','sizeof'].includes(callee)) continue;
      const position=method.start+1+m.index,paren=code.indexOf('(',position),end=closing(code,paren,'(',')');
      const expression=commentsRemoved.slice(paren+1,end).trim();
      const kind=/\b(?:LoadScene(?:Async)?|LoadLevel(?:Async)?)$/.test(callee)?'loads':/\bUnloadScene(?:Async)?$/.test(callee)?'unloads':/\bInstantiate$/.test(callee)?'spawns':/\bSetActive$/.test(callee)?(expression==='false'?'deactivates':'activates'):/\bWaitForSeconds(?:Realtime)?$/.test(callee)?'waits':/\b(?:PlayerPrefs\.)Set\w+$/.test(callee)?'saves':/\b(?:PlayerPrefs\.)Get\w+$/.test(callee)?'reads-state':'calls';
      const literal=expression.match(/^"([^"\\]*)"(?:\s*,|$)/)?.[1]??null;
      const numeric=/^-?\d+(?:\.\d+)?f?$/.test(expression)?expression:null;
      // Retain surrounding source as evidence, never invent a Boolean path predicate.
      signals.push({method:method.name,methodLine:method.line,kind,callee,line:lineAt(position),expression:expression.slice(0,500),expressionTruncated:expression.length>500,literal,numeric,conditions:'Reachability, compilation symbols and enclosing conditions require source review.',status:'syntax-candidate'});
    }
    for(const m of body.matchAll(/\b([\w.]+)\s*([+-])=\s*([^;]+);/g)) signals.push({method:method.name,methodLine:method.line,kind:m[2]==='+'?'subscribes':'unsubscribes',callee:m[1],line:lineAt(method.start+1+m.index),expression:commentsRemoved.slice(method.start+1+m.index,method.start+1+m.index+m[0].length),status:'syntax-candidate',conditions:'Delegate identity and reachability unverified.'});
  }
  return {classNames,fields,methods:methods.map(({start,end,...m})=>m),signals,coverage:{parser:'lexical',semanticResolution:'not-performed',expressionBodiedMethods:'unsupported',reflection:'unresolved',dynamicReceivers:'unresolved',conditionalCompilation:'not-evaluated'}};
}
