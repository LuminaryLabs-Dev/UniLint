# Validation

## Locally executable without Unity

- Node unit/fixture tests
- project indexing
- GUID graph integrity
- Unity YAML document/reference parsing
- `.asmdef`/`.asmref` parsing
- target define reconstruction
- version-defined symbol evaluation
- package minimum-version checks when local `package.json` evidence exists
- Oracle Pack discovery and provenance validation
- reference-pack manifest generation from explicitly supplied local files
- evidence-boundary regression checks
- Python worker smoke test
- CLI/report contract
- repository invariant validator

## Evidence-boundary checks

The repository validator rejects:

- outbound network-ingestion dependencies or `fetch()` use inside Oracle/reference-pack source;
- Oracle Packs that do not declare `automatedIngestion=false`, `unityProcessInvoked=false`, and `networkRequired=false`;
- U3 reference packs without local-files provenance;
- Unity Editor/CLI `-batchmode` process automation or direct `PackageManager.Client` / `CompilationPipeline` integration inside UniLint runtime code.

These are engineering guardrails, not a legal compliance certification.

## Requires .NET + user-supplied target reference pack

- Roslyn worker restore/build
- actual U3 semantic compilation

The reference pack must use schema 0.2, carry local-files provenance, explicitly classify target framework/engine/auto-referenced assemblies, and have `complete=true`.

## Requires real Unity to calibrate oracle truth

- exact Unity compilation parity
- AssetDatabase/import behavior
- serialized asset migration behavior
- shader/compiler behavior
- platform build behavior
- runtime behavior

Those Unity-based truth checks are external calibration activities; UniLint core does not automate Unity to perform them.

The highest static level in v0.1 is U3. No v0.1 code path is allowed to emit U4 or U5.
