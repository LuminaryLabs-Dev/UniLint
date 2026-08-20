# UniLint contributor rules

UniLint is a read-only Unity analysis project. Preserve these invariants:

1. Never claim runtime verification from static evidence.
2. Never award U3 unless the Roslyn worker actually ran and every included reconstructed assembly compiled successfully.
3. Unknown evidence must remain unknown; do not silently turn missing package, serialization, shader, importer or binary evidence into PASS.
4. Do not redistribute Unity binaries. Local reference packs are user-supplied.
5. Keep compatibility and performance findings separate.
6. Every finding must include a stable rule ID and a certainty level.
7. Oracle packs must state trust level, coverage and provenance.
8. Tests should prioritize preventing false-compatible results.
