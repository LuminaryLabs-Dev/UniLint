import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
  'oracle/versions/6000.0.json',
  'oracle/versions/6000.3.json',
  'workers/roslyn/UniLint.Roslyn.csproj',
  'workers/roslyn/Program.cs',
  'workers/python/unilint_worker.py',
  '.github/workflows/validate.yml',
  'protocol/openapi.yaml',
  'protocol/compatibility-report.schema.json',
  'docs/reference-packs.md',
];
for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing required file: ${file}`);
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (pkg.version !== '0.1.0') throw new Error('package.json version must be 0.1.0');
if (!pkg.bin?.unilint) throw new Error('package.json must expose unilint CLI');

for (const version of ['6000.0', '6000.3']) {
  const oracle = JSON.parse(fs.readFileSync(path.join(root, 'oracle/versions', `${version}.json`), 'utf8'));
  if (oracle.unity !== version) throw new Error(`Oracle ${version} identity mismatch`);
  if (!String(oracle.trust).startsWith('B-')) throw new Error(`Oracle ${version} must explicitly carry derived trust status`);
  if (!String(oracle.coverage?.apiSurface).includes('reference pack')) throw new Error(`Oracle ${version} must not imply bundled Unity API completeness`);
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
if (!roslynRunner.includes('assemblies?.framework') || !roslynRunner.includes('assemblies?.engine') || !roslynRunner.includes('assemblies?.autoReferenced')) throw new Error('Reference-pack gate must require explicit engine and auto-referenced assembly lists');

const compat = fs.readFileSync(path.join(root, 'src/compat/compat.mjs'), 'utf8');
if (!compat.includes("code: 'U3'")) throw new Error('Compatibility levels must include U3');
if (!compat.includes('roslyn.performed && roslyn.success')) throw new Error('U3 must require a successful Roslyn run');
if (/U4/.test(compat)) throw new Error('v0.1 must not claim U4 build prediction yet');

const indexer = fs.readFileSync(path.join(root, 'src/core/indexer.mjs'), 'utf8');
for (const marker of ['duplicate-guid', 'unresolved-guid', 'ProjectVersion.txt', '.asmdef']) {
  if (!indexer.includes(marker)) throw new Error(`Indexer is missing contract marker: ${marker}`);
}

console.log('UniLint repository contract passed.');
