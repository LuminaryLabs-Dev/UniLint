import { objectNodeId } from './graph.mjs';
const nativeClasses={CharacterController:[143],CapsuleCollider:[136],BoxCollider:[65],SphereCollider:[135],MeshCollider:[64],Rigidbody:[54],Camera:[20],AudioListener:[81],AudioSource:[82],Animator:[95],Animation:[111],Transform:[4,224],RectTransform:[224],LineRenderer:[120],ParticleSystem:[198]};

export function inspectBindings(g) {
  // No exact type assertion for aliases, custom type shadows, base classes or imported binaries.
  const declaredClasses=new Set([...g.scripts.values()].flatMap(s=>s.classNames));
  function fieldFor(file,doc,property) {
    const ref=doc?.data?.m_Script; if(!ref?.guid) return null;
    const paths=g.ir.guidGraph.guidToAssets[ref.guid]??[];if(paths.length!==1) return null;
    const data=g.scripts.get(paths[0]);
    if(data?.classNames.length!==1) return null; // Multi-class source requires semantic ownership resolution.
    const field=data.fields.find(f=>f.name===property);
    if(!field?.nativeTypeSyntax || declaredClasses.has(field.type.replace(/^UnityEngine\./,''))) return null;
    return {...field,script:paths[0],expected:nativeClasses[field.type.replace(/^UnityEngine\./,'')]};
  }
  function check(field,reference,evidence,context) {
    if(!field?.expected || !reference || String(reference.fileID)==='0') return;
    const paths=reference.guid?g.ir.guidGraph.guidToAssets[reference.guid]:[evidence.file];
    if(paths?.length!==1) return;
    const target=g.documents.get(paths[0])?.get(String(reference.fileID));if(!target || target.stripped || target.error) return;
    if(!field.expected.includes(target.classId)) g.finding('unity/binding/native-type-mismatch','configuration',`Field ${field.name} is declared ${field.type}, but the saved target is ${target.type} (class ${target.classId}).`,evidence,{certainty:'high',field:field.name,target:objectNodeId(paths[0],target.fileId),declaration:{file:field.script,line:field.line},context,limitation:'Source type syntax is checked; Unity import and runtime assignment are unverified.',nextAction:'Inspect this field and its effective prefab overrides in Unity before changing the binding.'});
  }
  for(const [file,docs] of g.documents) for(const doc of docs.values()) {
    for(const ref of doc.references) if(!ref.field.includes('.')&&!ref.field.includes('[')) check(fieldFor(file,doc,ref.field),{fileID:ref.fileId,guid:ref.guid},g.evidence(file,doc,ref.field),'direct saved field');
    for(const [i,m] of (doc.data?.m_Modification?.m_Modifications??[]).entries()) {
      const paths=g.ir.guidGraph.guidToAssets[m.target?.guid]??[];if(paths.length!==1) continue;
      const target=g.documents.get(paths[0])?.get(String(m.target.fileID));
      check(fieldFor(paths[0],target,m.propertyPath),m.objectReference,g.evidence(file,doc,`m_Modification.m_Modifications[${i}]`),'prefab instance override; outer overrides may supersede');
    }
  }
}
