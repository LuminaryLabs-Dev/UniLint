import fs from 'node:fs';
import path from 'node:path';
import { diagnostic, Severity, Certainty } from '../core/diagnostics.mjs';
import { unityAtLeast, parseUnityVersion } from '../unity/version.mjs';
import { lookupPackageCompatibility } from '../oracle/packages.mjs';

function localPackagePath(ir, requested) {
  const raw = String(requested ?? '');
  if (!raw.startsWith('file:')) return null;
  return path.resolve(ir.projectRoot, 'Packages', raw.slice(5));
}

function exactVersion(pkg) {
  const value = String(pkg.resolvedVersion ?? pkg.requested ?? '');
  return /^\d+(?:\.\d+){1,3}(?:[-+].*)?$/.test(value) ? value : null;
}

export function evaluatePackages(ir, targetUnity) {
  const findings = [];
  const results = [];
  const unityLine = parseUnityVersion(targetUnity)?.line ?? null;

  for (const pkg of ir.packages) {
    const result = { ...pkg, status: 'unknown', evidence: [] };

    if (pkg.source === 'local') {
      const packageRoot = localPackagePath(ir, pkg.requested);
      const manifestFile = packageRoot ? path.join(packageRoot, 'package.json') : null;
      if (manifestFile && fs.existsSync(manifestFile)) {
        const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
        if (manifest.unity) {
          const compatible = unityAtLeast(targetUnity, manifest.unity);
          result.status = compatible ? 'compatible' : 'incompatible';
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
          result.status = 'unknown';
          result.evidence.push({ kind: 'package-manifest', note: 'No unity minimum declared.' });
          findings.push(diagnostic({
            rule: 'unity/packages/local-version-unknown',
            severity: Severity.info,
            certainty: Certainty.certain,
            category: 'packages',
            message: `${pkg.name} is local and declares no minimum Unity version; compatibility remains unknown.`,
            file: path.relative(ir.projectRoot, manifestFile).split(path.sep).join('/'),
            blocking: false,
          }));
        }
      } else {
        findings.push(diagnostic({
          rule: 'unity/packages/local-source-unavailable',
          severity: Severity.info,
          certainty: Certainty.certain,
          category: 'packages',
          message: `${pkg.name} is local but its package.json is unavailable; compatibility remains unknown.`,
          file: 'Packages/manifest.json',
          blocking: false,
        }));
      }
    } else {
      const version = exactVersion(pkg);
      const record = lookupPackageCompatibility({ unityLine, name: pkg.name, version });
      result.status = record.status;
      result.evidence.push(...record.evidence.map((item) => ({ kind: 'oracle-package-compatibility', ...item })));

      if (record.status === 'incompatible') {
        findings.push(diagnostic({
          rule: 'unity/packages/oracle-incompatible',
          severity: Severity.error,
          certainty: Certainty.certain,
          category: 'packages',
          message: `${pkg.name}@${version} is recorded as incompatible with Unity ${unityLine}.`,
          file: 'Packages/manifest.json',
          evidence: record.evidence,
        }));
      } else if (record.status === 'deprecated') {
        findings.push(diagnostic({
          rule: 'unity/packages/oracle-deprecated',
          severity: Severity.warning,
          certainty: Certainty.certain,
          category: 'packages',
          message: `${pkg.name}@${version} is recorded as deprecated for Unity ${unityLine}.`,
          file: 'Packages/manifest.json',
          evidence: record.evidence,
          blocking: false,
        }));
      } else if (record.status === 'unknown') {
        findings.push(diagnostic({
          rule: 'unity/packages/external-version-unverified',
          severity: Severity.info,
          certainty: Certainty.certain,
          category: 'packages',
          message: record.reason,
          file: 'Packages/manifest.json',
          blocking: false,
        }));
      }
    }

    results.push(result);
  }

  return { results, findings };
}
