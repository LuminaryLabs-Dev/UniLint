#!/usr/bin/env node
import fs from 'node:fs';
import { buildSignalGraph, writeGraph, loadGraph } from './signal-graph/index.mjs';
import { queryGraph } from './signal-graph/query.mjs';
import { writeReport } from './report/scene-review.mjs';
import path from 'node:path';
import { indexUnityProject } from './core/indexer.mjs';
import { evaluateCompatibility } from './compat/compat.mjs';
import { runAudit } from './rules/audit.mjs';
import { compatibilityText, auditText } from './report/text.mjs';
import { listOracleVersions } from './oracle/oracle.mjs';
import { searchVersions } from './compat/version-search.mjs';
import { writeReferencePackManifest } from './reference-pack/manifest.mjs';

function usage(exitCode = 0) {
  const text = `UniLint 0.2 — offline Unity compatibility auditor\n\nUsage:\n  unilint index <project> [--format json]\n  unilint compat <project> --unity <version> [--platform windows|android|ios|webgl|linux|macos] [--backend mono|il2cpp] [--reference-pack <dir>] [--format text|json]\n  unilint versions <project> [--format text|json]\n  unilint audit <project> [--format text|json]\n  unilint graph <project> --scope build-list|enabled|selected [--scene GUID] [--scenes GUID,path] --out <new-directory>\n  unilint query <graph-directory> [--scene GUID] [--view findings|nodes|edges|scenes|files] [--node ID --direction incoming|outgoing --depth 1] [--limit 30 --offset 0] [--allow-stale]\n  unilint report <graph-directory> --format json|markdown|html [--out new-file] [--allow-stale]\n  unilint oracles\n  unilint reference-pack <dir> --unity <version-line> --framework <assembly,...> --engine <assembly,...> [--auto <assembly,...>] [--complete]\n`;
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

function csv(value) {
  if (!value || value === true) return [];
  return String(value).split(',').map((item) => item.trim()).filter(Boolean);
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
  if (command === 'reference-pack') {
    if (!options.unity) throw new Error('--unity is required for reference-pack.');
    const result = writeReferencePackManifest(project, {
      unityLine: options.unity,
      framework: csv(options.framework),
      engine: csv(options.engine),
      autoReferenced: csv(options.auto),
      complete: options.complete === true,
    });
    write(result, options.format ?? 'json');
    process.exit(0);
  }

  if (command === 'graph') {
    if (!options.out) throw new Error('--out requires a new, owned output directory.');
    const graph = buildSignalGraph(project, { scope: options.scope ?? (options.scene || options.scenes ? 'selected' : 'build-list'), scenes: [...csv(options.scene), ...csv(options.scenes)] });
    const directory = writeGraph(graph, options.out);
    write({ directory, schemaVersion: graph.schemaVersion, scenes: graph.scenes.length, nodes: graph.nodes.length, edges: graph.edges.length, findings: graph.findings.length, seconds: graph.run.seconds, runtime: 'unverified' }, 'json');
    process.exit(0);
  }
  if (command === 'query' || command === 'report') {
    const { graph, freshness } = loadGraph(project, { allowStale: options.allowStale === true });
    if (command === 'query') write({ ...queryGraph(graph, options), freshness }, 'json');
    else {
      const { text, report } = writeReport(graph, options.out, options.format ?? 'markdown');
      if (options.out) write({ output: path.resolve(options.out), scenes: report.counts.scenes, freshness }, 'json');
      else { if (!freshness.fresh) process.stderr.write(`Historical report: ${freshness.reason}\n`); process.stdout.write(text); }
    }
    process.exit(0);
  }
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
