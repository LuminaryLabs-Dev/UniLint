import fs from 'node:fs';
import path from 'node:path';
import { readJson, relative } from '../core/fs.mjs';
import { readMetaGuid } from './meta.mjs';
import { satisfiesVersionExpression } from './semver.mjs';

export function loadAsmdefs(projectRoot, asmdefFiles, asmrefFiles) {
  const definitions = [];
  const guidToName = new Map();

  for (const file of asmdefFiles) {
    const json = readJson(file);
    if (!json.name || typeof json.name !== 'string') throw new Error(`Invalid asmdef without name: ${relative(projectRoot, file)}`);
    const guid = readMetaGuid(`${file}.meta`);
    const item = {
      path: relative(projectRoot, file),
      directory: relative(projectRoot, path.dirname(file)),
      guid,
      name: json.name,
      references: Array.isArray(json.references) ? json.references : [],
      includePlatforms: Array.isArray(json.includePlatforms) ? json.includePlatforms : [],
      excludePlatforms: Array.isArray(json.excludePlatforms) ? json.excludePlatforms : [],
      defineConstraints: Array.isArray(json.defineConstraints) ? json.defineConstraints : [],
      versionDefines: Array.isArray(json.versionDefines) ? json.versionDefines : [],
      precompiledReferences: Array.isArray(json.precompiledReferences) ? json.precompiledReferences : [],
      overrideReferences: Boolean(json.overrideReferences),
      autoReferenced: json.autoReferenced !== false,
      noEngineReferences: Boolean(json.noEngineReferences),
      allowUnsafeCode: Boolean(json.allowUnsafeCode),
    };
    definitions.push(item);
    if (guid) guidToName.set(guid, json.name);
  }

  for (const definition of definitions) {
    definition.references = definition.references.map((reference) => {
      const value = String(reference);
      return value.startsWith('GUID:') ? (guidToName.get(value.slice(5).toLowerCase()) ?? value) : value;
    });
  }

  const references = asmrefFiles.map((file) => {
    const json = readJson(file);
    let reference = String(json.reference ?? '');
    if (reference.startsWith('GUID:')) reference = guidToName.get(reference.slice(5).toLowerCase()) ?? reference;
    return {
      path: relative(projectRoot, file),
      directory: relative(projectRoot, path.dirname(file)),
      reference,
    };
  });

  return { definitions, references };
}

function platformMatches(platform, expected) {
  const normalized = String(platform ?? '').toLowerCase();
  const value = String(expected ?? '').toLowerCase();
  const aliases = {
    windows: ['windowsstandalone32', 'windowsstandalone64', 'standalone'],
    android: ['android'],
    ios: ['ios'],
    webgl: ['webgl'],
    linux: ['linuxstandalone64', 'standalone'],
    macos: ['osxstandalone', 'standalone'],
  };
  return value === normalized || (aliases[normalized] ?? []).includes(value);
}

function constraintsPass(constraints, defines) {
  for (const raw of constraints) {
    const value = String(raw).trim();
    if (!value) continue;
    const negated = value.startsWith('!');
    const symbol = negated ? value.slice(1) : value;
    const has = defines.has(symbol);
    if (negated ? has : !has) return false;
  }
  return true;
}

export function evaluateAssembly(definition, environment, packageVersions) {
  const defines = new Set(environment.defines);
  for (const item of definition.versionDefines) {
    if (!item || !item.name || !item.expression || !item.define) continue;
    const version = item.name === 'Unity'
      ? environment.unityVersion
      : packageVersions[item.name];
    if (version && satisfiesVersionExpression(version, item.expression)) defines.add(item.define);
  }

  const includeOk = definition.includePlatforms.length === 0
    || definition.includePlatforms.some((value) => platformMatches(environment.platform, value) || (environment.editor && String(value).toLowerCase() === 'editor'));
  const excludeHit = definition.excludePlatforms.some((value) => platformMatches(environment.platform, value) || (environment.editor && String(value).toLowerCase() === 'editor'));
  const constraintsOk = constraintsPass(definition.defineConstraints, defines);

  return {
    included: includeOk && !excludeHit && constraintsOk,
    defines: [...defines].sort(),
    reasons: {
      includePlatforms: includeOk,
      excludedPlatform: excludeHit,
      defineConstraints: constraintsOk,
    },
  };
}
