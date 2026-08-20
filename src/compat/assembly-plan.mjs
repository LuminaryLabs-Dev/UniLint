import path from 'node:path';
import { evaluateAssembly } from '../unity/asmdef.mjs';

function groupScripts(ir) {
  const groups = new Map();
  for (const script of ir.scripts) {
    if (!groups.has(script.assembly)) groups.set(script.assembly, []);
    groups.get(script.assembly).push(script.path);
  }
  return groups;
}

function projectDefinesForEnvironment(ir, environment) {
  const candidates = [];
  const map = ir.settings.scriptingDefines ?? {};
  for (const [key, values] of Object.entries(map)) {
    const lower = key.toLowerCase();
    if (lower.includes(environment.platform) || lower === 'standalone') candidates.push(...values);
  }
  return [...new Set(candidates)];
}

export function buildAssemblyPlan(ir, environment) {
  const packageVersions = Object.fromEntries(ir.packages.map((item) => [item.name, item.resolvedVersion ?? item.requested]));
  const customDefines = projectDefinesForEnvironment(ir, environment);
  const effectiveEnvironment = {
    ...environment,
    defines: [...new Set([...environment.defines, ...customDefines])].sort(),
  };
  const scriptsByAssembly = groupScripts(ir);
  const definitionByName = new Map(ir.assemblies.definitions.map((item) => [item.name, item]));
  const assemblies = [];

  for (const definition of ir.assemblies.definitions) {
    const evaluation = evaluateAssembly(definition, effectiveEnvironment, packageVersions);
    assemblies.push({
      name: definition.name,
      included: evaluation.included,
      sources: scriptsByAssembly.get(definition.name) ?? [],
      references: definition.references.map((value) => value.startsWith('GUID:') ? value : value),
      precompiledReferences: definition.precompiledReferences,
      defines: evaluation.defines,
      noEngineReferences: definition.noEngineReferences,
      overrideReferences: definition.overrideReferences,
      allowUnsafeCode: definition.allowUnsafeCode,
      origin: definition.path,
      evaluation: evaluation.reasons,
    });
  }

  const autoReferencedCustom = ir.assemblies.definitions.filter((item) => item.autoReferenced).map((item) => item.name);
  const predefined = [
    { name: 'Assembly-CSharp-firstpass', editorOnly: false, phaseReferences: [] },
    { name: 'Assembly-CSharp-Editor-firstpass', editorOnly: true, phaseReferences: ['Assembly-CSharp-firstpass'] },
    { name: 'Assembly-CSharp', editorOnly: false, phaseReferences: ['Assembly-CSharp-firstpass'] },
    { name: 'Assembly-CSharp-Editor', editorOnly: true, phaseReferences: ['Assembly-CSharp-firstpass', 'Assembly-CSharp-Editor-firstpass', 'Assembly-CSharp'] },
  ];
  for (const predefinedAssembly of predefined) {
    const sources = scriptsByAssembly.get(predefinedAssembly.name) ?? [];
    if (!sources.length) continue;
    assemblies.push({
      name: predefinedAssembly.name,
      included: !predefinedAssembly.editorOnly || effectiveEnvironment.editor,
      sources,
      references: [...new Set([...predefinedAssembly.phaseReferences, ...autoReferencedCustom])],
      precompiledReferences: [],
      defines: effectiveEnvironment.defines,
      noEngineReferences: false,
      overrideReferences: false,
      allowUnsafeCode: false,
      origin: 'implicit',
      evaluation: { implicit: true },
    });
  }

  for (const [name, sources] of scriptsByAssembly) {
    if (definitionByName.has(name) || name === 'Assembly-CSharp' || name === 'Assembly-CSharp-Editor') continue;
    assemblies.push({
      name,
      included: false,
      sources,
      references: [],
      precompiledReferences: [],
      defines: effectiveEnvironment.defines,
      noEngineReferences: false,
      overrideReferences: false,
      allowUnsafeCode: false,
      origin: 'unresolved-asmref',
      evaluation: { unresolved: true },
    });
  }

  return {
    target: effectiveEnvironment,
    assemblies,
  };
}
