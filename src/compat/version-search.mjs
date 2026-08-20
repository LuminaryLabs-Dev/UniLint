import { listOracleVersions } from '../oracle/oracle.mjs';
import { evaluateCompatibility } from './compat.mjs';
import { compareUnityVersions } from '../unity/version.mjs';

const LEVEL_WEIGHT = { U0: 0, U1: 1, U2: 2, U3: 3, U4: 4, U5: 5 };

export function searchVersions(ir, options = {}) {
  const results = listOracleVersions().map((unity) => evaluateCompatibility(ir, { ...options, unity }));
  const viable = results.filter((item) => item.compatibility.predicted !== 'blocked');
  const ranked = [...viable].sort((a, b) => {
    const levelDelta = LEVEL_WEIGHT[b.compatibility.level.code] - LEVEL_WEIGHT[a.compatibility.level.code];
    if (levelDelta) return levelDelta;
    const blockingDelta = a.compatibility.blocking - b.compatibility.blocking;
    if (blockingDelta) return blockingDelta;
    const unknownDelta = a.compatibility.unknowns - b.compatibility.unknowns;
    if (unknownDelta) return unknownDelta;
    return compareUnityVersions(b.target.unityVersion, a.target.unityVersion);
  });
  const chronological = [...viable].sort((a, b) => compareUnityVersions(a.target.unityVersion, b.target.unityVersion));
  return {
    project: ir.identity.name,
    sourceUnity: ir.identity.sourceUnityVersion?.raw ?? null,
    recommended: ranked[0]?.target.unityLine ?? null,
    minimumPredictedCompatible: chronological[0]?.target.unityLine ?? null,
    results,
  };
}
