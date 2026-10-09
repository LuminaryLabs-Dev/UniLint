# Durable implementation context

- UniLint is designed as an independent, read-only, offline Unity **static** auditor, not an Editor controller.
- Compatibility levels U0–U3 encode increasing evidence; U3 requires a real Roslyn run and local complete reference pack. U4/U5 are not supported claims.
- The CLI is `src/cli.mjs`, service `apps/service/server.mjs`, core analyzers `src/`, Roslyn worker `workers/roslyn/`, Python asset worker `workers/python/`.
- The current npm manifest is version 0.2.3, with Node 20+ and pinned `yaml` 2.9.1.
- `AGENTS.md` forbids automated Unity documentation ingestion, Unity Editor/CLI control, Unity binary redistribution, and false-compatible evidence.
- CI includes Node/Python, Roslyn, and a real-project static analysis job using `NexusWorldFactory` fixture source. A CI configuration is **not** evidence that the jobs currently pass.
- Preserve existing authoritative docs instead of duplicating or replacing them during maintenance.
- Baseline for this documentation pass: `c52ecf8` on `main`.

Before working, read `.agent/start-here.md` and the relevant source. After work, update verifiable evidence; do not overwrite this document with speculative milestones.
