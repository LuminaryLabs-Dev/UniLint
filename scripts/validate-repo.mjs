import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertOracleProvenance } from '../src/policy/evidence-policy.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const required = [
  'README.md',
  'CHANGELOG.md',
  'AGENTS.md',
  'package.json',
  'src/cli.mjs',
  'src/core/indexer.mjs',
  'src/compat/compat.mjs',
  'src/compat/roslyn.mjs',
  'src/oracle/oracle.mjs',
  'src/policy/evidence-policy.mjs',
  'src/reference-pack/manifest.mjs',
  'oracle/versions/6000.0.json',
  'oracle/versions/6000.3.json',
  'workers/roslyn/UniLint.Roslyn.csproj',
  'workers/roslyn/Program.cs',
  'workers/python/unilint_worker.py',
  '.github/workflows/validate.yml',
  'protocol/openapi.yaml',
  'protocol/compatibility-report.schema.json',
  'docs/oracle-packs.md',
  'docs/reference-packs.md',
  'docs/compliance-boundary.md',
];
for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing required file: ${file}`);
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (pkg.version !== '0.1.1') throw new Error('package.json version must be 0.1.1');
if (!pkg.bin?.unilint) throw new Error('package.json must expose unilint CLI');

const oracleFiles = fs.readdirSync(path.join(root, 'oracle', 'versions')).filter((name) => name.endsWith('.json'));
if (oracleFiles.length < 2) throw new Error('At least two curated oracle fixtures are required.');
for (const file of oracleFiles) {
  const version = file.slice(0, -5);
  const oracle = JSON.parse(fs.readFileSync(path.join(root, 'oracle', 'versions', file), 'utf8'));
  if (oracle.schemaVersion !== '0.2') throw new Error(`Oracle ${version} must use schemaVersion 0.2`);
  if (oracle.unity !== version) throw new Error(`Oracle ${version} identity mismatch`);
  if (!String(oracle.trust).startsWith('B-')) throw new Error(`Oracle ${version} must explicitly carry derived trust status`);
  if (!String(oracle.coverage?.apiSurface).includes('reference pack')) throw new Error(`Oracle ${version} must not imply bundled Unity API completeness`);
  assertOracleProvenance(oracle, `Oracle ${version}`);
}

const csproj = fs.readFileSync(path.join(root, 'workers/roslyn/UniLint.Roslyn.csproj'), 'utf8');
if (!csproj.includes('Microsoft.CodeAnalysis.CSharp" Version="5.6.0"')) throw new Error('Roslyn dependency must be pinned to 5.6.0');
const roslyn = fs.readFileSync(path.join(root, 'workers/roslyn/Program.cs'), 'utf8');
if (!roslyn.includes('LanguageVersion.CSharp9')) throw new Error('Roslyn worker must model Unity 6 C# 9 syntax');
if (!roslyn.includes('ReferencePackPlan')) throw new Error('Roslyn worker must consume an explicit reference-pack classification');
if (!roslyn.includes('frameworkAssemblies')) throw new Error('Roslyn worker must use target framework assemblies rather than host runtime references');
if (roslyn.includes('TRUSTED_PLATFORM_ASSEMBLIES')) throw new Error('Roslyn worker must not compile U3 against host .NET runtime references');
if (!roslyn.includes('autoReferencedAssemblies')) throw new Error('Roslyn worker must not infer all non-engine DLLs as auto-referenced');
const roslynRunner = fs.readFileSync(path.join(root, 'src/compat/roslyn.mjs'), 'utf8');
if (!roslynRunner.includes("schemaVersion !== '0.2'")) throw new Error('Reference-pack gate must require schemaVersion 0.2');
if (!roslynRunner.includes('assertReferencePackProvenance')) throw new Error('Reference-pack gate must enforce local provenance');
if (!roslynRunner.includes('assemblies?.framework') || !roslynRunner.includes('assemblies?.engine') || !roslynRunner.includes('assemblies?.autoReferenced')) throw new Error('Reference-pack gate must require explicit reference classifications');

const compat = fs.readFileSync(path.join(root, 'src/compat/compat.mjs'), 'utf8');
if (!compat.includes("code: 'U3'")) throw new Error('Compatibility levels must include U3');
if (!compat.includes('roslyn.performed && roslyn.success')) throw new Error('U3 must require a successful Roslyn run');
if (/U4/.test(compat)) throw new Error('v0.1 must not claim U4 build prediction yet');

const indexer = fs.readFileSync(path.join(root, 'src/core/indexer.mjs'), 'utf8');
for (const marker of ['duplicate-guid', 'unresolved-guid', 'ProjectVersion.txt', '.asmdef']) {
  if (!indexer.includes(marker)) throw new Error(`Indexer is missing contract marker: ${marker}`);
}

function sourceFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const found = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...sourceFiles(absolute));
    else if (/\.(?:mjs|js|cjs|cs|py)$/.test(entry.name)) found.push(absolute);
  }
  return found;
}

for (const directory of [path.join(root, 'src', 'oracle'), path.join(root, 'src', 'reference-pack')]) {
  for (const file of sourceFiles(directory)) {
    const text = fs.readFileSync(file, 'utf8');
    for (const marker of ["node:https", "node:http", "from 'undici'", 'from "undici"', "from 'axios'", 'from "axios"', 'fetch(']) {
      if (text.includes(marker)) throw new Error(`Offline evidence boundary violation in ${path.relative(root, file)}: ${marker}`);
    }
  }
}

const processControlPatterns = [
  /-batchmode\b/i,
  /PackageManager\.Client\b/,
  /CompilationPipeline\b/,
  /spawn(?:Sync)?\(\s*['"`]Unity(?:\.exe)?['"`]/i,
  /exec(?:File|FileSync|Sync)?\([^\n]*['"`]Unity(?:\.exe)?['"`]/i,
];
for (const directory of [path.join(root, 'src'), path.join(root, 'apps'), path.join(root, 'workers')]) {
  for (const file of sourceFiles(directory)) {
    const text = fs.readFileSync(file, 'utf8');
    for (const pattern of processControlPatterns) {
      if (pattern.test(text)) throw new Error(`Unity process/API automation is outside the UniLint core boundary: ${path.relative(root, file)}`);
    }
  }
}

console.log('UniLint repository contract passed.');
