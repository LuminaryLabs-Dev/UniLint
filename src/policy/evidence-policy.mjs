export const ORACLE_PROVENANCE_LEVELS = Object.freeze({
  A: 'local-verified',
  B: 'human-curated',
  C: 'project-metadata',
  D: 'inferred',
});

const ORACLE_SOURCE_MODES = Object.freeze({
  A: 'local-verified-evidence',
  B: 'human-curated-facts',
  C: 'project-package-metadata',
  D: 'heuristic',
});

export function assertOracleProvenance(pack, source = 'Oracle pack') {
  const provenance = pack?.provenance;
  if (!provenance || Array.isArray(provenance) || typeof provenance !== 'object') {
    throw new Error(`${source} must contain structured provenance metadata.`);
  }
  if (!Object.hasOwn(ORACLE_PROVENANCE_LEVELS, provenance.level)) {
    throw new Error(`${source} has unsupported provenance level '${provenance.level ?? 'missing'}'.`);
  }
  if (provenance.sourceMode !== ORACLE_SOURCE_MODES[provenance.level]) {
    throw new Error(`${source} provenance level ${provenance.level} requires sourceMode '${ORACLE_SOURCE_MODES[provenance.level]}'.`);
  }
  if (provenance.automatedIngestion !== false) {
    throw new Error(`${source} must explicitly declare automatedIngestion=false.`);
  }
  if (provenance.unityProcessInvoked !== false) {
    throw new Error(`${source} must explicitly declare unityProcessInvoked=false.`);
  }
  if (provenance.networkRequired !== false) {
    throw new Error(`${source} must explicitly declare networkRequired=false.`);
  }
  if (!Array.isArray(provenance.sources)) {
    throw new Error(`${source} provenance.sources must be an array.`);
  }
  return provenance;
}

export function assertReferencePackProvenance(manifest, source = 'Reference pack manifest') {
  if (manifest?.generatedLocally !== true) {
    throw new Error(`${source} must declare generatedLocally=true.`);
  }
  const provenance = manifest?.provenance;
  if (!provenance || Array.isArray(provenance) || typeof provenance !== 'object') {
    throw new Error(`${source} must contain structured provenance metadata.`);
  }
  if (provenance.sourceMode !== 'local-installed-files') {
    throw new Error(`${source} sourceMode must be 'local-installed-files'.`);
  }
  if (provenance.unityProcessInvoked !== false) {
    throw new Error(`${source} must declare unityProcessInvoked=false.`);
  }
  if (provenance.networkAccess !== false) {
    throw new Error(`${source} must declare networkAccess=false.`);
  }
  return provenance;
}
