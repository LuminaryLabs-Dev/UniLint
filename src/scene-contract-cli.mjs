#!/usr/bin/env node
import {auditSceneContract} from './rules/scene-contract.mjs';
const [project,...args]=process.argv.slice(2);
const arg=k=>{const i=args.indexOf(k);return i===-1?null:args[i+1]};
if(!project){process.stderr.write('Usage: node src/scene-contract-cli.mjs <UnityProject> --unity 6000.3.28f1 --scenes Bootstrap,Level01_Cottage,... [--prefabs Assets/Resources/Base.prefab,...]\n');process.exitCode=2;}
else try{
 const result=auditSceneContract(project,{unity:arg('--unity'),scenes:(arg('--scenes')||'').split(',').filter(Boolean),prefabs:(arg('--prefabs')||'').split(',').filter(Boolean)});
 process.stdout.write(JSON.stringify(result,null,2)+'\n');
 if(result.status!=='passed_static')process.exitCode=1;
}catch(error){process.stderr.write(JSON.stringify({status:'failed',message:error.message})+'\n');process.exitCode=2}
