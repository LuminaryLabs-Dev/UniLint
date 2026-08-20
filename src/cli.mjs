#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { indexUnityProject } from './core/indexer.mjs';
import { evaluateCompatibility } from './compat/compat.mjs';
import { runAudit } from './rules/audit.mjs';
import { compatibilityText, auditText } from './report/text.mjs';
import { listOracleVersions } from './oracle/oracle.mjs';
import { searchVersions } from './compat/version-search.mjs';

function usage(exitCode = 0) {
  const text = `UniLint 0.1 — offline Unity compatibility auditor\n\nUsage:\n  unilint index <project> [--format json]\n  unilint compat <project> --unity <version> [--platform windows|android|ios|webgl|linux|macos] [--backend mono|il2cpp] [--reference-pack <dir>] [--format text|json]\n  unilint versions <project> [--format text|json]\n  unilint audit <project> [--format text|json]\n  unilint oracles\n`;
  (exitCode ? process.stderr : process.stdout).write(text);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const [command, projectArg, ...rest] = argv;
  const options = {};
  for (let i = 0; i < rest.length; i++) {
    const item = rest[i];
    if (!item.startsWith('--')) continue;
    const key = item.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const next = rest[i + 1];
    if (!next || next.startsWith('--')) options[key] = true;
    else { options[key] = next; i++; }
  }
  return { command, projectArg, options };
}

function write(value, format, textFormatter = null) {
  if (format === 'json' || !textFormatter) process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
  else process.stdout.write(`${textFormatter(value)}\n`);
}

const { command, projectArg, options } = parseArgs(process.argv.slice(2));
if (!command || command === 'help' || command === '--help' || command === '-h') usage(0);

if (command === 'oracles') {
  write({ versions: listOracleVersions() }, options.format ?? 'json');
  process.exit(0);
}

if (!projectArg) usage(2);
const project = path.resolve(projectArg);
if (!fs.existsSync(project)) {
  console.error(`Project path does not exist: ${project}`);
  process.exit(2);
}

try {
  const ir = indexUnityProject(project);
  const format = options.format ?? (command === 'index' ? 'json' : 'text');
  if (command === 'index') {
    write(ir, format);
  } else if (command === 'audit') {
    write(runAudit(ir), format, auditText);
  } else if (command === 'compat') {
    if (!options.unity) throw new Error('--unity is required for compat.');
    const report = evaluateCompatibility(ir, {
      unity: options.unity,
      platform: options.platform,
      backend: options.backend,
      architecture: options.arch,
      graphics: options.graphics,
      referencePack: options.referencePack,
      editor: options.player ? false : true,
    });
    write(report, format, compatibilityText);
    if (report.compatibility.predicted === 'blocked') process.exitCode = 1;
  } else if (command === 'versions') {
    const search = searchVersions(ir, {
      platform: options.platform,
      backend: options.backend,
      architecture: options.arch,
      graphics: options.graphics,
      referencePack: options.referencePack,
    });
    if (format === 'json') write(search, 'json');
    else {
      const lines = [`UNILINT VERSION SEARCH — ${ir.identity.name}`, '================================'];
      for (const result of search.results) lines.push(`${result.target.unityLine.padEnd(10)} ${result.compatibility.predicted.padEnd(18)} ${result.compatibility.level.code}`);
      lines.push('');
      lines.push(`Recommended: ${search.recommended ?? 'none'}`);
      lines.push(`Minimum predicted compatible: ${search.minimumPredictedCompatible ?? 'none'}`);
      process.stdout.write(`${lines.join('\n')}\n`);
    }
    if (search.results.every((item) => item.compatibility.predicted === 'blocked')) process.exitCode = 1;
  } else {
    usage(2);
  }
} catch (error) {
  console.error(`UniLint failed: ${error.stack ?? error.message}`);
  process.exit(2);
}
