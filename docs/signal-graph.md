# Static scene graph

UniLint 0.2 adds opt-in, offline extraction of the saved build-list scenes and their referenced dependencies. It reads files; it never launches Unity. Existing `index`, `audit` and compatibility commands remain available.

## Run once, query narrowly

Use Node 20 or later. `npm ci` installs the pinned YAML parser. For a disposable runner, replace `<commit>` with a verified full Git commit:

```sh
npx --yes --ignore-scripts --package=https://github.com/LuminaryLabs-Dev/UniLint/archive/<commit>.tar.gz unilint help
```

Using a checked-out runner:

```sh
node src/cli.mjs graph /path/to/project --scope build-list --out /tmp/new-owned-run
node src/cli.mjs query /tmp/new-owned-run --view scenes --limit 10
node src/cli.mjs query /tmp/new-owned-run --scene <scene-guid> --view findings --limit 20
node src/cli.mjs query /tmp/new-owned-run --node '<node-id>' --direction incoming --depth 1 --limit 20
node src/cli.mjs report /tmp/new-owned-run --format html --out /tmp/new-review.html
```

The same arguments follow `unilint` in the pinned npx form. No root install, project npm install, package-cache deletion or Unity process is needed. The initial npx dependency fetch needs network access; the analyzer runs offline.

`build-list` includes disabled entries, in saved list order. `enabled` includes enabled entries only. `selected` requires `--scene GUID/path` or comma-separated `--scenes`. An invalid selector fails rather than widening scope. Referenced prefabs, scripts and serialized assets are dependencies; unselected scene contents are not extracted. Literal scene-load candidates are matched to the authoritative list without claiming those calls execute. Listed order and enabled build index are separate fields.

Output must be new and outside Assets, Packages, ProjectSettings, Library and .git. `graph.json` contains the reusable graph; `run.json` declares the two generated files and ownership. Existing output directories and report files are not overwritten. Preserve useful evidence before removing only generated files owned by the run. Never clean a Unity Library or a shared npm cache as part of this workflow.

## ESM routes

```text
signal-graph/index.mjs       Scope, freshness, dependency queue and result
+-- routes/game.mjs          Saved Build Settings
+-- routes/scene.mjs         Selected scene serialization
+-- routes/prefab.mjs        Referenced asset definitions and override records
+-- routes/script.mjs        Source methods, fields and lexical candidates
+-- extract/serialized.mjs   Detailed YAML and typed reference edges
+-- extract/csharp.mjs       Bounded lexical facts, never semantic dispatch
+-- graph.mjs                Stable identities, references, findings, evidence
+-- bindings.mjs             Conservative native-type binding check
+-- query.mjs                Filtered pagination and cycle-safe neighborhoods
```

ESM callers can import `buildSignalGraph`, `writeGraph`, `loadGraph`, `checkFreshness` from `src/signal-graph/index.mjs`, `queryGraph` from `query.mjs`, and `sceneReport`, `reportHtml` from `src/report/scene-review.mjs`. Synchronous filesystem work is appropriate for the current local CLI; this is not a streamed browser engine.

## Graph contract: unilint.signal-graph.v1

- `run`: UTC collection date, source root/revision, tool version and content hash, source fingerprint, scope, selectors and timing.
- `buildSettings`: ordered entries, enabled indices, paths, GUIDs, metadata identities, hashes and validation errors.
- `packageResolution`: embedded/local/locked-cache evidence or explicit unavailable/invalid/engine-module state.
- `assemblyCoverage`: complete/partial input parsing, retained definitions and individual errors. This is not compilation proof.
- `files`: source hashes, sizes and parsed/partial/syntax-indexed/import-unverified states.
- `nodes`: stable IDs for scene assets, file-scoped Unity document IDs, prefab instance records, methods, imported targets and unresolved destinations. Unity file IDs remain strings.
- `edges`: stable ID, from/to, kind, status, evidence and optional target resolution, field/override value, event arguments, wait expression or literal load target.
- `findings`: stable ID, rule, category, severity, certainty, source evidence, owner, optional target/declaration and next check.
- `scenes`: identity, dependency file set, document/class counts, finding IDs, shared finding IDs, outgoing candidates and explicit coverage.

Evidence points to source path, SHA-256, document start line, file ID and field path; lexical evidence points to a source line. Field lines are not represented as exact when only the document start is known. Full nested settings and long values stay in the original hashed source. The graph is a knowledge index, not a lossless substitute for source files.

`asset:<path>#<file-id>` keeps two scene instances distinct. Their definitions are reused. Override edges retain property paths, scalar values and object references; outer overrides can supersede them. Imported/effective instance flattening is not claimed.

Resolution states distinguish local/external documents, native built-ins, prefab asset handles, imported objects, unverified nested-prefab targets, unassigned values, missing IDs, missing GUIDs and ambiguous GUIDs. Provenance and override-target absences are separated from direct structural references. A missing textual target is not automatically a proven runtime failure.

Queries default to 30 records, cap at 200, and return total/nextOffset. Neighborhood depth is 1–5 with visited-node cycle handling. Views are findings, nodes, edges, scenes and files. Optional `--kind`, `--status` and `--search` filter results. Large individual scene records may contain many dependency pointers; use findings/nodes for focused questions. Querying avoids reparsing YAML/C# but still hashes source text to check freshness.

## Evidence boundaries

- Exact locked package versions are used; nearby cached versions are not substituted. Git cache directories require an explicit matching lock hash. Missing cache sources remain gaps.
- Unity ignores tilde-suffixed package folders such as `Samples~`; they do not become imported GUID or assembly evidence. See [Unity package layout](https://docs.unity3d.com/2022.3/Documentation/Manual/cus-layout.html).
- JSON BOMs are supported. A malformed assembly file preserves other definitions and emits a blocking diagnostic.
- YAML duplicate keys and unsupported legacy quoting remain explicit coverage findings; no last-key-wins loss of data is hidden.
- Local scalar values, explicit UnityEvents, animation-event method strings, prefab references and override records are source facts. Method compatibility, animation receivers and actual event dispatch remain unverified.
- C# extraction is lexical. Calls, literal scene loads, Instantiate, activation, waits, subscriptions and persistence are candidates. Expression-bodied methods, semantic types, conditions, compilation symbols, reflection and dynamic receivers are not fully resolved. Numeric additions can resemble subscriptions; review source.
- Native field checks require an unambiguous single-class source file and known direct native target class. Aliases, custom shadows, stripped targets and inherited fields are excluded. Effective import and runtime assignment remain unverified.
- Saved camera/listener/collider/component settings are indexed. Multiple active records alone do not establish conflicting ownership, visibility, physics configuration or runtime cost. No new blanket camera/trigger error rule is applied.
- Performance findings are static heuristics, not frame-time measurements. No U3 or runtime level is awarded by this graph.

## Freshness and review

Source freshness fingerprints text in Assets, Packages, ProjectSettings and selected package roots, plus binary size/mtime. Added files are included. Imported binary internals are unverified; this is not a cryptographic backup of every binary. Analyzer identity hashes its source and manifests. Both are checked on reuse. Stale graphs fail unless `--allow-stale` is explicitly supplied for historical inspection. Report artifacts also carry their original date, revision and runtime limits.

The local HTML review embeds gzip-compressed navigation data and selected flow edges (a browser with DecompressionStream support is required), shares finding records, and requires no service or upload. It starts with all scenes and shared dependencies, then offers findings, source links, a bounded graph, incoming/outgoing navigation, candidate filtering and pagination. Full reference/containment edges remain in the queryable disk graph. File links work best when the review is opened locally.

Static completion means every selected scene has a result and unsupported checks are visible. It does not complete a gameplay, headset or release audit.
