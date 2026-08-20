import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function runRoslynCompatibility(ir, assemblyPlan, referencePack) {
  if (!referencePack) return { performed: false, success: null, reason: 'No target Unity reference pack supplied.' };
  const references = path.resolve(referencePack);
  if (!fs.existsSync(references)) return { performed: false, success: null, reason: `Reference pack does not exist: ${references}` };
  const manifestFile = path.join(references, 'unilint-reference-pack.json');
  if (!fs.existsSync(manifestFile)) return { performed: false, success: null, reason: 'Reference pack is missing unilint-reference-pack.json; refusing to treat an unverified DLL directory as target proof.' };
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8')); } catch { return { performed: false, success: null, reason: 'Reference pack manifest is invalid JSON.' }; }
  if (manifest.schemaVersion !== '0.1' || manifest.complete !== true) return { performed: false, success: null, reason: 'Reference pack manifest must declare schemaVersion 0.1 and complete=true.' };
  if (manifest.unityLine !== assemblyPlan.target.unityLine) return { performed: false, success: null, reason: `Reference pack targets Unity ${manifest.unityLine ?? 'unknown'}, not ${assemblyPlan.target.unityLine}.` };
  const frameworkAssemblies = manifest.assemblies?.framework;
  const engineAssemblies = manifest.assemblies?.engine;
  const autoReferencedAssemblies = manifest.assemblies?.autoReferenced;
  if (!Array.isArray(frameworkAssemblies) || frameworkAssemblies.length === 0 || !frameworkAssemblies.every((name) => typeof name === 'string' && name.trim())) {
    return { performed: false, success: null, reason: 'Reference pack manifest must explicitly list assemblies.framework so Roslyn uses the target Unity framework surface instead of the host .NET runtime.' };
  }
  if (!Array.isArray(engineAssemblies) || engineAssemblies.length === 0 || !engineAssemblies.every((name) => typeof name === 'string' && name.trim())) {
    return { performed: false, success: null, reason: 'Reference pack manifest must explicitly list assemblies.engine so U3 does not infer engine references from arbitrary DLLs.' };
  }
  if (!Array.isArray(autoReferencedAssemblies) || !autoReferencedAssemblies.every((name) => typeof name === 'string' && name.trim())) {
    return { performed: false, success: null, reason: 'Reference pack manifest must explicitly list assemblies.autoReferenced (an empty array is allowed).' };
  }
  const dllCount = fs.readdirSync(references, { recursive: true }).filter((name) => String(name).toLowerCase().endsWith('.dll')).length;
  if (dllCount === 0) return { performed: false, success: null, reason: 'Reference pack contains no DLL reference assemblies.' };

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'unilint-'));
  const planFile = path.join(tempDir, 'plan.json');
  fs.writeFileSync(planFile, JSON.stringify({
    projectRoot: ir.projectRoot,
    target: assemblyPlan.target,
    referencePack: {
      frameworkAssemblies: frameworkAssemblies.map((name) => name.trim()),
      engineAssemblies: engineAssemblies.map((name) => name.trim()),
      autoReferencedAssemblies: autoReferencedAssemblies.map((name) => name.trim()),
    },
    assemblies: assemblyPlan.assemblies,
  }, null, 2));

  const result = spawnSync('dotnet', [
    'run', '--project', path.join(ROOT, 'workers', 'roslyn', 'UniLint.Roslyn.csproj'), '--configuration', 'Release', '--',
    '--plan', planFile,
    '--references', references,
  ], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });

  if (result.error?.code === 'ENOENT') return { performed: false, success: null, reason: 'dotnet SDK is not installed.' };
  const stdout = String(result.stdout ?? '').trim();
  let parsed = null;
  const jsonStart = stdout.split(/\r?\n/).findIndex((line) => line.trim() === '{');
  const jsonText = jsonStart >= 0 ? stdout.split(/\r?\n/).slice(jsonStart).join('\n') : stdout;
  try { parsed = jsonText ? JSON.parse(jsonText) : null; } catch { /* handled below */ }
  if (!parsed) return {
    performed: true,
    success: false,
    reason: `Roslyn worker failed (${result.status ?? 'unknown'}).`,
    stderr: String(result.stderr ?? '').trim(),
  };
  return { performed: true, ...parsed };
}
