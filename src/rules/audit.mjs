import fs from 'node:fs';
import path from 'node:path';
import { diagnostic, Severity, Certainty } from '../core/diagnostics.mjs';

export function runAudit(ir) {
  const findings = [...ir.findings];
  for (const script of ir.scripts) {
    const absolute = path.join(ir.projectRoot, script.path);
    const text = fs.readFileSync(absolute, 'utf8');
    const updateBodies = [...text.matchAll(/\b(?:void|async\s+void)\s+(Update|LateUpdate|FixedUpdate)\s*\([^)]*\)\s*\{([\s\S]{0,12000}?)\n\s*\}/g)];
    for (const match of updateBodies) {
      const body = match[2];
      if (/\b(?:GameObject\.)?Find(?:GameObjectWithTag|WithTag)?\s*\(/.test(body)) {
        findings.push(diagnostic({
          rule: 'unity/performance/find-in-frame-loop',
          severity: Severity.warning,
          certainty: Certainty.medium,
          category: 'performance',
          message: `Potential hierarchy Find call inside ${match[1]}().`,
          file: script.path,
          blocking: false,
          recommendation: 'Cache the reference or use an explicit dependency if this call executes every frame.',
        }));
      }
      if (/\.GetComponent\s*</.test(body)) {
        findings.push(diagnostic({
          rule: 'unity/performance/getcomponent-in-frame-loop',
          severity: Severity.info,
          certainty: Certainty.medium,
          category: 'performance',
          message: `Potential repeated GetComponent<T>() inside ${match[1]}().`,
          file: script.path,
          blocking: false,
        }));
      }
    }
  }
  return { schemaVersion: '0.1', project: ir.identity.name, findings };
}
