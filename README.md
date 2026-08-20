# UniLint — Offline Unity Compatibility Auditor

UniLint is a read-only static analysis and compatibility engine for Unity projects. Its first release focuses on one question:

> **Can this project be structurally and compile-compatibly resolved for a target Unity version before that target Unity Editor ever opens it?**

UniLint never controls Unity. It reads project files, reconstructs Unity-facing project structure, evaluates a target-version oracle, and can optionally invoke an offline Roslyn worker against a user-supplied target Unity reference pack.

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
     ├─ Unity 6000.0 oracle
     ├─ Unity 6000.3 oracle
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
                              target reference pack
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

Evaluate the initial oracle matrix:

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

## U3 offline compilation

U3 deliberately requires real target API evidence instead of a guessed API database.

1. Install .NET 8+.
2. Provide a directory containing reference assemblies for the target Unity environment that you are legally entitled to use locally.
3. Run:

```bash
node src/cli.mjs compat /path/to/UnityProject \
  --unity 6000.3 \
  --reference-pack /path/to/reference-assemblies
```

The Roslyn worker is pinned to `Microsoft.CodeAnalysis.CSharp` 5.6.0 and parses project source as C# 9, matching Unity 6's documented C# language level. It compiles assemblies in dependency order and refuses U3 when compilation is not actually performed or errors remain.

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

It listens on `127.0.0.1:17450` by default.

## Workers

```text
workers/
├── roslyn/   semantic C# compilation worker
└── python/   stdlib-only asset fact worker
```

The Python worker currently extracts deterministic file-size facts, PNG dimensions, WAV metadata and basic PE/ELF/Mach-O identification. It is intentionally separate from the compatibility certificate until those asset facts have version-specific rules.

## Oracle trust model

Initial Unity 6000.0 and 6000.3 packs are marked **B-derived**: their compiler/package/assembly behavior is based on documented Unity contracts, but they do not claim a complete bundled Unity API surface. A real local target reference pack is required for U3.

See `docs/compatibility-model.md` and `docs/validation.md`.
