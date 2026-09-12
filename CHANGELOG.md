# Changelog

## 0.2.0 — Scoped static scene graph

- Added build-list/selected-scene graph extraction, bounded queries and a local navigable review.
- Preserved exact Unity document IDs, prefab instances, overrides, events and source-backed lexical candidates.
- Added conservative native binding checks, explicit coverage states, stable evidence IDs and stale-cache rejection.
- Fixed JSON BOM handling and retained valid assemblies after individual malformed definitions.
- Resolved exact local package sources and excluded ignored package sample folders from imported metadata.
- Extended existing regression suites for scope, references, partial evidence, freshness and safe output ownership.
- Added the pinned YAML dependency; no Unity process or network behavior was added to the analyzer.

## 0.1.1 — Offline evidence boundary

- Made Oracle Pack discovery dynamic instead of hard-coding supported version filenames in the loader.
- Added enforced A/B/C/D Oracle provenance metadata and offline evidence flags.
- Added repository validation that rejects outbound Oracle/reference-pack ingestion code and Unity process/API automation patterns.
- Added a local-files-only `reference-pack` manifest command that never invokes Unity or the network.
- Upgraded reference-pack manifests to schema 0.2 and require local provenance before U3 can run.
- Documented the Unity access/compliance boundary and kept automated documentation crawling outside UniLint core.
- Added the MIT license grant and package license metadata.
- Added contributor licensing guidance and third-party dependency notices for public open-source distribution.

## 0.1.0 — Version Oracle foundation

- Added Unity project discovery and canonical project IR.
- Added ProjectVersion, package manifest/lock, `.meta` GUID and Unity YAML reference indexing.
- Added `.asmdef` / `.asmref` parsing, platform constraints, define constraints and version-defined symbols.
- Added Unity 6000.0 and 6000.3 derived oracle packs.
- Added conservative U0–U3 compatibility levels.
- Added optional Roslyn C# 9 semantic compilation worker using Microsoft.CodeAnalysis.CSharp 5.6.0.
- Added stdlib-only Python asset fact worker.
- Added CLI, version search, JSON/text reports, local HTTP service, fixtures and validation CI.
