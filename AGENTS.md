# UniLint contributor rules

UniLint is a read-only, offline-first Unity project analysis tool. Preserve these invariants:

1. Never claim runtime verification from static evidence.
2. Never award U3 unless the Roslyn worker actually ran and every included reconstructed assembly compiled successfully.
3. Unknown evidence must remain unknown; do not silently turn missing package, serialization, shader, importer or binary evidence into PASS.
4. Do not redistribute Unity binaries. Reference packs are assembled from files the user is entitled to use locally.
5. Do not add automated Unity Documentation/API/Asset Store crawling or ingestion to build Oracle Packs.
6. Do not launch, control, query or automate the Unity Editor/CLI/Package Manager from UniLint core.
7. Oracle Packs must be independently structured metadata with explicit A/B/C/D provenance and `automatedIngestion=false`.
8. Project and package metadata should come from the analyzed repository whenever possible.
9. Local reference-pack tooling may inspect only paths explicitly supplied by the user; it must not invoke Unity or require network access.
10. Keep compatibility and performance findings separate.
11. Every finding must include a stable rule ID and a certainty level.
12. Tests should prioritize preventing false-compatible results and preventing evidence-boundary regressions.

If a future Unity integration, plugin, automated caller, or network ingestion feature is desired, treat it as a separate authorization/terms review rather than silently expanding UniLint core.
