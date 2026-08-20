# UniLint — Offline Unity Compatibility Auditor

UniLint is a read-only static analysis and compatibility engine for Unity projects. Its first release focuses on one question:

> **Can this project be structurally and compile-compatibly resolved for a target Unity version before that target Unity Editor ever opens it?**

UniLint does not control Unity. It reads developer-supplied project files, reconstructs Unity-facing project structure, evaluates a provenance-backed target-version Oracle Pack, and can optionally invoke an offline Roslyn worker against a developer-supplied local reference pack.

## Architecture boundary

```text
                     UNILINT
                        │
                        │ NO UNITY CONTROL
                        │ NO UNITY API CALLS
                        │ NO DOC CRAWLER
                        │ NO UNITY BINARY REDISTRIBUTION
                        │
                        ▼
                 PROJECT FILES
                        │
       ┌────────────────┼────────────────┐
       ▼                ▼                ▼
      C#             Packages          Assets
       │                │                │
       └────────────────┼────────────────┘
                        ▼
                 Canonical Project IR
                        │
                        ▼
                  Oracle Registry
                        │
             ┌──────────┼──────────┐
             ▼          ▼          ▼
          curated    project     local
           facts      facts     evidence
             │          │          │
             └──────────┼──────────┘
                        ▼
                Compatibility Proof
```

Automated crawling/ingestion of Unity Documentation, Unity APIs, the Asset Store, or Package Manager is intentionally outside UniLint core. Unity Editor/CLI automation is also outside the current boundary. See [`docs/compliance-boundary.md`](docs/compliance-boundary.md).

## v0.1 scope

```text
UNITY PROJECT
     │
     ▼
Project Index
     │
     ├─ ProjectVersion.txt
     ├─ Packages manifest / lock
     ├─ .meta GUID graph
     ├─ Unity YAML references
     ├─ .asmdef / .asmref graph
     └─ C# source inventory
     │
     ▼
Canonical Project IR
     │
     ▼
Target Environment
     │
     ├─ dynamically loaded local Oracle Pack
     ├─ platform/backend defines
     ├─ asmdef defineConstraints
     └─ versionDefines
     │
     ▼
Assembly Plan
     │
     ├──────────── optional ────────────┐
     ▼                                  ▼
U2 VERSION RESOLVED              Roslyn Worker
                                      │
                              local reference pack
                                      │
                                      ▼
                               U3 COMPILE-PROVEN
```

### Compatibility levels implemented

- **U0 — Unknown / structurally blocked:** project structure contains blocking integrity failures.
- **U1 — Structurally valid:** project structure is coherent but no target oracle can resolve it.
- **U2 — Version resolved:** target oracle, assembly graph, defines and package evidence resolve without a blocking result.
- **U3 — Compile-proven:** U2 plus the Roslyn worker successfully compiles the reconstructed included assemblies against a supplied target-Unity reference pack.

**UniLint v0.1 does not claim U4 build prediction or U5 runtime verification.** Shaders, custom importers, opaque native binaries, actual Unity asset migration, IL2CPP and runtime behavior remain outside this release gate.

## CLI

Requires Node.js 20+; the core has no npm runtime dependencies.

```bash
npm ci
npm test
npm run validate
```

Index a project:

```bash
node src/cli.mjs index /path/to/UnityProject
```

Resolve compatibility:

```bash
node src/cli.mjs compat /path/to/UnityProject \
  --unity 6000.3 \
  --platform windows
```

Evaluate every locally installed Oracle Pack:

```bash
node src/cli.mjs versions /path/to/UnityProject
```

Run the first static project/performance audit rules:

```bash
node src/cli.mjs audit /path/to/UnityProject
```

Machine-readable output:

```bash
node src/cli.mjs compat /path/to/UnityProject --unity 6000.3 --format json
```

List loadable Oracle Packs:

```bash
node src/cli.mjs oracles
```

## Oracle provenance

Oracle Packs are independently structured metadata, not replicated Unity documentation. Every pack carries one explicit provenance class:

```text
A — local-verified evidence
B — human-curated factual metadata
C — project/package metadata
D — inference / heuristic
```

Committed packs must declare that automated ingestion, Unity process invocation, and network access were not used to generate the pack. The loader rejects a pack that does not satisfy that contract.

Initial Unity `6000.0` and `6000.3` packs are **B-derived / human-curated** and intentionally incomplete at the API-surface level. A real local target reference pack is required for U3.

## U3 offline compilation

U3 deliberately requires real target API evidence instead of a guessed API database.

1. Install .NET 8+.
2. Identify a local directory containing reference assemblies for the target Unity environment that you are entitled to use.
3. Create the local manifest without invoking Unity:

```bash
node src/cli.mjs reference-pack /path/to/reference-assemblies \
  --unity 6000.3 \
  --framework mscorlib,netstandard \
  --engine UnityEngine.CoreModule,UnityEngine.PhysicsModule,UnityEditor.CoreModule \
  --auto Unity.InputSystem \
  --complete
```

4. Run compatibility:

```bash
node src/cli.mjs compat /path/to/UnityProject \
  --unity 6000.3 \
  --reference-pack /path/to/reference-assemblies
```

The manifest helper only checks files already in the explicitly supplied directory and writes `unilint-reference-pack.json`. It does not launch Unity, call Unity APIs, query Package Manager, access Unity Documentation, download DLLs, or use the network.

`--complete` is an explicit assertion by the developer that the pack models the target compilation environment. Without it, U3 is refused.

The Roslyn worker is pinned to `Microsoft.CodeAnalysis.CSharp` 5.6.0 and parses project source as C# 9. It compiles assemblies in dependency order and refuses U3 when compilation is not actually performed or errors remain.

UniLint does **not** redistribute Unity DLLs.

## Current project analysis

The indexer currently builds:

```text
ProjectIR
├── identity / source Unity version
├── packages + lock information
├── assembly definitions/references
├── scripts + owning assembly
├── asset inventory
├── asset GUID map
├── serialized GUID reference graph
├── parsed Unity-YAML document headers
├── native plugin inventory
├── shader inventory
├── scripting-define evidence
└── normalized findings
```

Integrity rules currently detect missing project roots/version declarations, invalid package JSON, missing or malformed `.meta` GUIDs, duplicate GUIDs, unresolved serialized GUID references, malformed assembly definitions and unresolved assembly references.

Because references to package or Unity built-in assets can appear outside `Assets/`, unresolved GUID findings explicitly preserve that ambiguity rather than pretending every unmatched GUID is certainly a deleted asset.

## Local service

A thin loopback service wraps the same engine:

```bash
node apps/service/server.mjs
```

Endpoints:

```text
GET  /health
GET  /v1/oracles
POST /v1/index
POST /v1/audit
POST /v1/compatibility
POST /v1/version-search
```

It listens on `127.0.0.1:17450` by default. The service analyzes supplied project paths; it is not a Unity Editor integration.

## Workers

```text
workers/
├── roslyn/   semantic C# compilation worker
└── python/   stdlib-only asset fact worker
```

The Python worker currently extracts deterministic file-size facts, PNG dimensions, WAV metadata and basic PE/ELF/Mach-O identification. It is intentionally separate from the compatibility certificate until those asset facts have version-specific rules.

## Validation philosophy

UniLint optimizes against **false-compatible** results:

- unknown evidence stays unknown;
- U3 requires a successful Roslyn run;
- arbitrary DLL directories are not accepted as reference packs;
- Oracle Packs require explicit provenance;
- Oracle/reference-pack code is statically guarded against outbound ingestion dependencies;
- Unity process/API automation is outside the validated core contract.

See `docs/compatibility-model.md`, `docs/oracle-packs.md`, `docs/reference-packs.md`, `docs/compliance-boundary.md`, and `docs/validation.md`.

## Contributing

Contributions are welcome under the MIT License. By submitting a contribution, you represent that you have the right to submit it and agree that it may be distributed under the MIT License. See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

UniLint is distributed under the [MIT License](LICENSE).

Copyright in individual contributions remains with the applicable authors. See [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) for third-party dependency information.

## Unity

UniLint is an independent open-source project and is not affiliated with, endorsed by, or sponsored by Unity Technologies.

Unity and related marks belong to their respective trademark owners. UniLint does not distribute Unity binaries, Unity source code, copied Unity documentation, or Unity artwork. Developer-supplied local reference packs are not part of this repository or the UniLint MIT license grant.
