# Architecture

```text
Unity project files
      │
      ▼
Node project indexer
      │
      ▼
Canonical Project IR
      │
      ├──────────────┐
      ▼              ▼
Version Oracle    Audit rules
      │
      ▼
Assembly/define/package plan
      │
      ├──────────── optional ────────────┐
      ▼                                  ▼
U2 evidence                         Roslyn worker
                                         │
                                         ▼
                                   U3 evidence
```

Node is the control plane because project discovery, JSON, `.meta`, serialized-text and dependency graph work are naturally filesystem-centric. C# semantic compilation is isolated in a .NET/Roslyn worker. Python is an independent asset-fact worker for formats that benefit from binary/statistical processing.
