import { diagnostic, Severity, Certainty } from '../core/diagnostics.mjs';
import { loadOracle } from '../oracle/oracle.mjs';
import { buildTargetEnvironment } from '../oracle/defines.mjs';
import { buildAssemblyPlan } from './assembly-plan.mjs';
import { evaluatePackages } from './packages.mjs';
import { runRoslynCompatibility } from './roslyn.mjs';

function compatibilityLevel({ structuralPass, oraclePass, roslyn }) {
  if (!structuralPass) return { code: 'U0', label: 'UNKNOWN / STRUCTURALLY BLOCKED' };
  if (!oraclePass) return { code: 'U1', label: 'STRUCTURALLY VALID' };
  if (roslyn.performed && roslyn.success) return { code: 'U3', label: 'COMPILE-PROVEN' };
  return { code: 'U2', label: 'VERSION RESOLVED' };
}

export function evaluateCompatibility(ir, options) {
  const targetUnity = options.unity;
  const environment = buildTargetEnvironment({
    unity: targetUnity,
    platform: options.platform ?? 'windows',
    editor: options.editor !== false,
    backend: options.backend ?? null,
    architecture: options.architecture ?? null,
    graphics: options.graphics ?? null,
    customDefines: options.defines ?? [],
  });
  const oracle = loadOracle(environment.unityLine);
  const findings = [...ir.findings];

  if (!oracle) findings.push(diagnostic({
    rule: 'unilint/oracle/missing-version-pack',
    severity: Severity.error,
    certainty: Certainty.certain,
    category: 'version',
    message: `UniLint does not have an oracle pack for Unity ${environment.unityLine}.`,
  }));

  const packageEvaluation = evaluatePackages(ir, targetUnity);
  findings.push(...packageEvaluation.findings);
  const assemblyPlan = buildAssemblyPlan(ir, environment);

  for (const assembly of assemblyPlan.assemblies) {
    if (assembly.origin === 'unresolved-asmref') findings.push(diagnostic({
      rule: 'unity/assemblies/unresolved-asmref',
      severity: Severity.error,
      certainty: Certainty.certain,
      category: 'assemblies',
      message: `Scripts resolve to unknown assembly '${assembly.name}'.`,
      evidence: [{ kind: 'sources', paths: assembly.sources }],
    }));
  }

  if (ir.serializedAssets.length > 0) findings.push(diagnostic({
    rule: 'unilint/serialization/unverified-migration',
    severity: Severity.info,
    certainty: Certainty.certain,
    category: 'serialization',
    message: `${ir.serializedAssets.length} serialized Unity asset(s) were structurally parsed, but target-version migration/import behavior is not proven in v0.1.`,
    blocking: false,
  }));
  if (ir.shaders.length > 0) findings.push(diagnostic({
    rule: 'unilint/shaders/unverified-target-compile',
    severity: Severity.info,
    certainty: Certainty.certain,
    category: 'shaders',
    message: `${ir.shaders.length} shader asset(s) are inventoried but not target-compiled in v0.1.`,
    blocking: false,
  }));
  if (ir.nativePlugins.length > 0) findings.push(diagnostic({
    rule: 'unilint/native/unverified-runtime',
    severity: Severity.info,
    certainty: Certainty.certain,
    category: 'native',
    message: `${ir.nativePlugins.length} native/plugin binary asset(s) require ABI/runtime validation beyond v0.1 static compilation.`,
    blocking: false,
  }));

  const roslyn = runRoslynCompatibility(ir, assemblyPlan, options.referencePack ?? null);
  if (!roslyn.performed) findings.push(diagnostic({
    rule: 'unilint/compile/not-performed',
    severity: Severity.info,
    certainty: Certainty.certain,
    category: 'compile',
    message: roslyn.reason,
    blocking: false,
    recommendation: 'Supply --reference-pack pointing to target Unity reference assemblies and install .NET 8+ to reach U3 compile-proven status.',
  }));
  if (roslyn.performed && !roslyn.success) findings.push(diagnostic({
    rule: 'unilint/compile/failed',
    severity: Severity.error,
    certainty: Certainty.certain,
    category: 'compile',
    message: 'Offline Roslyn target compilation produced errors.',
    evidence: [{ kind: 'roslyn', diagnostics: roslyn.diagnostics ?? roslyn.assemblies ?? [] }],
  }));

  const blocking = findings.filter((item) => item.blocking);
  const structuralBlocking = ir.findings.filter((item) => item.blocking);
  const level = compatibilityLevel({
    structuralPass: structuralBlocking.length === 0,
    oraclePass: Boolean(oracle) && blocking.filter((item) => item.category !== 'compile').length === 0,
    roslyn,
  });

  return {
    schemaVersion: '0.1',
    project: {
      name: ir.identity.name,
      sourceUnity: ir.identity.sourceUnityVersion?.raw ?? null,
      renderPipeline: ir.identity.renderPipeline,
    },
    target: environment,
    oracle: oracle ? {
      unity: oracle.unity,
      trust: oracle.trust,
      compiler: oracle.compiler,
      coverage: oracle.coverage,
      provenance: oracle.provenance,
    } : null,
    compatibility: {
      level,
      predicted: blocking.length === 0 ? (findings.some((item) => item.rule.includes('unverified') || item.rule.includes('not-performed') || item.rule.includes('unresolved-guid')) ? 'pass-with-unknowns' : 'pass') : 'blocked',
      blocking: blocking.length,
      warnings: findings.filter((item) => item.severity === 'warning').length,
      unknowns: findings.filter((item) => item.rule.includes('unverified') || item.rule.includes('not-performed') || item.rule.includes('unresolved-guid')).length,
      runtimeVerified: false,
    },
    packages: packageEvaluation.results,
    assemblyPlan,
    roslyn,
    findings,
  };
}
