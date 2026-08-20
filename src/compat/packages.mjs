import fs from 'node:fs';
import path from 'node:path';
import { diagnostic, Severity, Certainty } from '../core/diagnostics.mjs';
import { unityAtLeast } from '../unity/version.mjs';

function localPackagePath(ir, requested) {
  const raw = String(requested ?? '');
  if (!raw.startsWith('file:')) return null;
  const rel = raw.slice(5);
  return path.resolve(ir.projectRoot, 'Packages', rel);
}

export function evaluatePackages(ir, targetUnity) {
  const findings = [];
  const results = [];
  for (const pkg of ir.packages) {
    const result = { ...pkg, status: 'unknown', evidence: [] };
    if (pkg.source === 'local') {
      const packageRoot = localPackagePath(ir, pkg.requested);
      const manifestFile = packageRoot ? path.join(packageRoot, 'package.json') : null;
      if (manifestFile && fs.existsSync(manifestFile)) {
        const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
        if (manifest.unity) {
          const compatible = unityAtLeast(targetUnity, manifest.unity);
          result.status = compatible ? 'pass' : 'block';
          result.evidence.push({ kind: 'package-manifest-unity', minimum: manifest.unity });
          if (!compatible) findings.push(diagnostic({
            rule: 'unity/packages/minimum-unity-version',
            severity: Severity.error,
            certainty: Certainty.certain,
            category: 'packages',
            message: `${pkg.name} requires Unity ${manifest.unity} or newer, but target is ${targetUnity}.`,
            file: path.relative(ir.projectRoot, manifestFile).split(path.sep).join('/'),
          }));
        } else {
          result.status = 'pass-without-version-claim';
          result.evidence.push({ kind: 'package-manifest', note: 'No unity minimum declared.' });
        }
      }
    } else {
      result.evidence.push({ kind: 'package-lock', version: pkg.resolvedVersion, source: pkg.source });
      findings.push(diagnostic({
        rule: 'unity/packages/external-version-unverified',
        severity: Severity.info,
        certainty: Certainty.certain,
        category: 'packages',
        message: `${pkg.name}@${pkg.resolvedVersion ?? pkg.requested} is external; its exact Unity-version package manifest is not available in this offline project snapshot.`,
        file: 'Packages/manifest.json',
        blocking: false,
      }));
    }
    results.push(result);
  }
  return { results, findings };
}
