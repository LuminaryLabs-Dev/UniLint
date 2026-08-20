import fs from 'node:fs';
import path from 'node:path';
import { diagnostic, Severity, Certainty } from './diagnostics.mjs';
import { exists, readJson, readText, relative, walk, normalizePath } from './fs.mjs';
import { loadAsmdefs } from '../unity/asmdef.mjs';
import { readMetaGuid } from '../unity/meta.mjs';
import { parseUnityYaml } from '../unity/yaml.mjs';
import { parseUnityVersion } from '../unity/version.mjs';
import { parseScriptingDefines } from '../unity/settings.mjs';

const SERIALIZED_EXTENSIONS = new Set(['.unity', '.prefab', '.asset', '.mat', '.controller', '.anim', '.overridecontroller', '.playable']);
const NATIVE_EXTENSIONS = new Set(['.dll', '.so', '.dylib', '.bundle', '.a', '.aar', '.jar', '.framework']);
const SHADER_EXTENSIONS = new Set(['.shader', '.compute', '.hlsl', '.cginc', '.shadergraph', '.shadersubgraph']);

function parseProjectVersion(file) {
  if (!exists(file)) return null;
  const text = readText(file);
  const raw = text.match(/^m_EditorVersion:\s*(\S+)/m)?.[1] ?? null;
  return raw ? parseUnityVersion(raw) : null;
}

function loadPackages(projectRoot) {
  const manifestFile = path.join(projectRoot, 'Packages', 'manifest.json');
  const lockFile = path.join(projectRoot, 'Packages', 'packages-lock.json');
  const manifest = exists(manifestFile) ? readJson(manifestFile) : { dependencies: {} };
  const lock = exists(lockFile) ? readJson(lockFile) : { dependencies: {} };
  const dependencies = manifest.dependencies && typeof manifest.dependencies === 'object' ? manifest.dependencies : {};
  const lockDependencies = lock.dependencies && typeof lock.dependencies === 'object' ? lock.dependencies : {};
  const packages = Object.entries(dependencies).map(([name, requested]) => ({
    name,
    requested,
    resolvedVersion: lockDependencies[name]?.version ?? (/^\d/.test(String(requested)) ? requested : null),
    source: lockDependencies[name]?.source ?? inferPackageSource(requested),
    depth: lockDependencies[name]?.depth ?? 0,
    dependencies: lockDependencies[name]?.dependencies ?? {},
  }));
  return { manifest, lock, packages };
}

function inferPackageSource(requested) {
  const value = String(requested ?? '');
  if (value.startsWith('file:')) return 'local';
  if (value.startsWith('git') || value.includes('github.com')) return 'git';
  return 'registry';
}

function inferPipeline(packages) {
  if (packages.some((item) => item.name === 'com.unity.render-pipelines.high-definition')) return 'hdrp';
  if (packages.some((item) => item.name === 'com.unity.render-pipelines.universal')) return 'urp';
  return 'builtin-or-custom';
}

function collectAssetEntries(projectRoot) {
  const assetsRoot = path.join(projectRoot, 'Assets');
  return walk(assetsRoot).filter((entry) => !entry.path.endsWith('.meta'));
}

function collectSourceEntries(projectRoot, packageData) {
  const roots = [path.join(projectRoot, 'Assets')];
  const packagesRoot = path.join(projectRoot, 'Packages');
  if (exists(packagesRoot)) {
    for (const entry of fs.readdirSync(packagesRoot, { withFileTypes: true })) {
      if (entry.isDirectory()) roots.push(path.join(packagesRoot, entry.name));
    }
  }
  for (const pkg of packageData.packages) {
    const requested = String(pkg.requested ?? '');
    if (!requested.startsWith('file:')) continue;
    const candidate = path.resolve(projectRoot, 'Packages', requested.slice(5));
    if (exists(candidate)) roots.push(candidate);
  }
  const seen = new Set();
  const entries = [];
  for (const root of roots) {
    for (const entry of walk(root)) {
      if (entry.type !== 'file' || entry.path.endsWith('.meta')) continue;
      const absolute = path.resolve(entry.path);
      if (seen.has(absolute)) continue;
      seen.add(absolute);
      entries.push(entry);
    }
  }
  return entries;
}

function nearestOwningAssembly(scriptPath, definitions, references) {
  const normalized = normalizePath(scriptPath);
  const directory = normalized.slice(0, normalized.lastIndexOf('/'));
  const candidates = [];
  for (const definition of definitions) {
    if (directory === definition.directory || directory.startsWith(`${definition.directory}/`)) {
      candidates.push({ depth: definition.directory.split('/').length, name: definition.name });
    }
  }
  for (const reference of references) {
    if (directory === reference.directory || directory.startsWith(`${reference.directory}/`)) {
      candidates.push({ depth: reference.directory.split('/').length, name: reference.reference });
    }
  }
  candidates.sort((a, b) => b.depth - a.depth);
  if (candidates.length) return candidates[0].name;

  const parts = normalized.split('/');
  const underAssets = parts[0] === 'Assets';
  const topLevel = underAssets ? parts[1] : null;
  const firstpassFolder = topLevel === 'Plugins' || topLevel === 'Standard Assets' || topLevel === 'Pro Standard Assets';
  const editorScript = parts.includes('Editor');
  if (firstpassFolder && editorScript) return 'Assembly-CSharp-Editor-firstpass';
  if (firstpassFolder) return 'Assembly-CSharp-firstpass';
  if (editorScript) return 'Assembly-CSharp-Editor';
  return 'Assembly-CSharp';
}

export function indexUnityProject(projectPath) {
  const projectRoot = path.resolve(projectPath);
  const findings = [];
  const requiredDirectories = ['Assets', 'Packages', 'ProjectSettings'];
  for (const dir of requiredDirectories) {
    if (!exists(path.join(projectRoot, dir))) {
      findings.push(diagnostic({
        rule: 'unity/project/missing-root-directory',
        severity: Severity.error,
        certainty: Certainty.certain,
        category: 'integrity',
        message: `Required Unity project directory '${dir}' is missing.`,
        file: dir,
      }));
    }
  }

  const sourceUnityVersion = parseProjectVersion(path.join(projectRoot, 'ProjectSettings', 'ProjectVersion.txt'));
  if (!sourceUnityVersion) {
    findings.push(diagnostic({
      rule: 'unity/project/version-unknown',
      severity: Severity.error,
      certainty: Certainty.certain,
      category: 'integrity',
      message: 'ProjectSettings/ProjectVersion.txt does not declare a readable Unity editor version.',
      file: 'ProjectSettings/ProjectVersion.txt',
    }));
  }

  let packageData = { manifest: { dependencies: {} }, lock: { dependencies: {} }, packages: [] };
  try {
    packageData = loadPackages(projectRoot);
  } catch (error) {
    findings.push(diagnostic({
      rule: 'unity/packages/invalid-json',
      severity: Severity.error,
      certainty: Certainty.certain,
      category: 'packages',
      message: `Package manifest/lock parse failed: ${error.message}`,
      file: 'Packages',
    }));
  }

  const assetEntries = exists(path.join(projectRoot, 'Assets')) ? collectAssetEntries(projectRoot) : [];
  const files = assetEntries.filter((entry) => entry.type === 'file');
  const sourceFiles = collectSourceEntries(projectRoot, packageData);
  const directories = assetEntries.filter((entry) => entry.type === 'directory');
  const allAssetPaths = [...files, ...directories].map((entry) => relative(projectRoot, entry.path));

  const metaByAssetPath = {};
  const guidToPaths = new Map();
  for (const assetPath of allAssetPaths) {
    const metaFile = path.join(projectRoot, `${assetPath}.meta`);
    if (!exists(metaFile)) {
      findings.push(diagnostic({
        rule: 'unity/meta/missing',
        severity: Severity.warning,
        certainty: Certainty.high,
        category: 'integrity',
        message: 'Asset or folder is missing its Unity .meta file; Unity may regenerate metadata, which can change references.',
        file: assetPath,
      }));
      continue;
    }
    const guid = readMetaGuid(metaFile);
    if (!guid) {
      findings.push(diagnostic({
        rule: 'unity/meta/guid-missing',
        severity: Severity.warning,
        certainty: Certainty.high,
        category: 'integrity',
        message: 'Unity .meta file does not contain a valid 32-character GUID; Unity may regenerate the metadata.',
        file: `${assetPath}.meta`,
      }));
      continue;
    }
    metaByAssetPath[assetPath] = guid;
    if (!guidToPaths.has(guid)) guidToPaths.set(guid, []);
    guidToPaths.get(guid).push(assetPath);
  }


  if (exists(path.join(projectRoot, 'Assets'))) {
    for (const entry of walk(path.join(projectRoot, 'Assets')).filter((item) => item.type === 'file' && item.path.endsWith('.meta'))) {
      const assetPath = entry.path.slice(0, -5);
      if (!exists(assetPath)) {
        findings.push(diagnostic({
          rule: 'unity/meta/orphan',
          severity: Severity.warning,
          certainty: Certainty.certain,
          category: 'integrity',
          message: 'Unity .meta file has no matching asset or folder.',
          file: relative(projectRoot, entry.path),
          blocking: false,
        }));
      }
    }
  }

  for (const [guid, paths] of guidToPaths) {
    if (paths.length > 1) {
      findings.push(diagnostic({
        rule: 'unity/meta/duplicate-guid',
        severity: Severity.critical,
        certainty: Certainty.certain,
        category: 'integrity',
        message: `GUID ${guid} is assigned to multiple Unity assets.`,
        evidence: [{ kind: 'guid-paths', paths }],
      }));
    }
  }

  const asmdefFiles = sourceFiles.filter((entry) => entry.path.endsWith('.asmdef')).map((entry) => entry.path);
  const asmrefFiles = sourceFiles.filter((entry) => entry.path.endsWith('.asmref')).map((entry) => entry.path);
  let assemblies = { definitions: [], references: [] };
  try {
    assemblies = loadAsmdefs(projectRoot, asmdefFiles, asmrefFiles);
  } catch (error) {
    findings.push(diagnostic({
      rule: 'unity/assemblies/invalid-definition',
      severity: Severity.error,
      certainty: Certainty.certain,
      category: 'assemblies',
      message: error.message,
    }));
  }

  const scripts = sourceFiles.filter((entry) => entry.path.endsWith('.cs')).map((entry) => {
    const rel = relative(projectRoot, entry.path);
    return {
      path: rel,
      assembly: nearestOwningAssembly(rel, assemblies.definitions, assemblies.references),
      bytes: fs.statSync(entry.path).size,
    };
  });

  const serializedAssets = [];
  const guidReferences = [];
  for (const entry of files) {
    const ext = path.extname(entry.path).toLowerCase();
    if (!SERIALIZED_EXTENSIONS.has(ext)) continue;
    let text;
    try {
      text = readText(entry.path);
    } catch {
      continue;
    }
    if (!text.includes('%YAML') && !text.includes('--- !u!')) continue;
    const parsed = parseUnityYaml(text);
    const rel = relative(projectRoot, entry.path);
    serializedAssets.push({ path: rel, extension: ext, documents: parsed.documents });
    for (const guid of parsed.guidReferences) guidReferences.push({ source: rel, guid });
  }

  for (const reference of guidReferences) {
    if (reference.guid === '00000000000000000000000000000000') continue;
    if (!guidToPaths.has(reference.guid)) {
      findings.push(diagnostic({
        rule: 'unity/references/unresolved-guid',
        severity: Severity.warning,
        certainty: Certainty.medium,
        category: 'integrity',
        message: `Serialized Unity asset references GUID ${reference.guid}, which was not found under Assets/.`,
        file: reference.source,
        evidence: [{ kind: 'guid', value: reference.guid }],
        blocking: false,
        recommendation: 'Verify whether the reference belongs to a package/built-in resource or is genuinely missing. Package and built-in references remain a known ambiguity in v0.1.',
      }));
    }
  }

  const nativePlugins = files.filter((entry) => NATIVE_EXTENSIONS.has(path.extname(entry.path).toLowerCase())).map((entry) => ({
    path: relative(projectRoot, entry.path),
    extension: path.extname(entry.path).toLowerCase(),
    bytes: fs.statSync(entry.path).size,
  }));

  const shaders = files.filter((entry) => SHADER_EXTENSIONS.has(path.extname(entry.path).toLowerCase())).map((entry) => ({
    path: relative(projectRoot, entry.path),
    extension: path.extname(entry.path).toLowerCase(),
    bytes: fs.statSync(entry.path).size,
  }));

  const scriptingDefines = parseScriptingDefines(path.join(projectRoot, 'ProjectSettings', 'ProjectSettings.asset'));

  return {
    schemaVersion: '0.1',
    indexedAtUtc: new Date().toISOString(),
    projectRoot,
    identity: {
      name: path.basename(projectRoot),
      sourceUnityVersion,
      renderPipeline: inferPipeline(packageData.packages),
    },
    packages: packageData.packages,
    packageManifest: packageData.manifest,
    packageLock: packageData.lock,
    assemblies,
    scripts,
    assets: files.map((entry) => ({ path: relative(projectRoot, entry.path), bytes: fs.statSync(entry.path).size })),
    guidGraph: {
      assetToGuid: metaByAssetPath,
      guidToAssets: Object.fromEntries([...guidToPaths.entries()]),
      references: guidReferences,
    },
    serializedAssets,
    nativePlugins,
    shaders,
    settings: {
      scriptingDefines,
    },
    findings,
  };
}
