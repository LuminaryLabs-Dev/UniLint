# Architecture

```text
                    USER-SUPPLIED UNITY PROJECT
                              │
                              ▼
                       Node project indexer
                              │
                              ▼
                       Canonical Project IR
                              │
              ┌───────────────┼────────────────┐
              ▼               ▼                ▼
        curated Oracle     project/package    local evidence
           metadata          metadata             │
              │               │                   │
              └───────────────┼───────────────────┘
                              ▼
                       Version Oracle
                              │
                              ▼
                 Assembly/define/package plan
                              │
              ┌───────────────┴────────────────┐
              ▼                                ▼
          U2 evidence                     Roslyn worker
                                               │
                                      local reference pack
                                               │
                                               ▼
                                          U3 evidence
```

Node is the control plane because project discovery, JSON, `.meta`, serialized-text and dependency graph work are filesystem-centric. C# semantic compilation is isolated in a .NET/Roslyn worker. Python is an independent asset-fact worker for binary/statistical processing.

## Evidence boundary

The core architecture is offline-first:

```text
NO automated Unity Documentation ingestion
NO Unity API / Package Manager querying
NO Unity Editor or Unity CLI automation
NO Unity binary redistribution
```

Oracle Packs are dynamically discovered local metadata with explicit provenance. Project metadata comes from the repository being analyzed. U3 reference packs are local evidence supplied by the developer and validated before Roslyn runs.

See `compliance-boundary.md` for the engineering guardrails around Unity access.
