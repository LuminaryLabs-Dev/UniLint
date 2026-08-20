# Unity access and evidence boundary

UniLint is designed as an independent, offline static analyzer. This is an engineering guardrail, not legal advice.

Current policy review date: **2026-08-20**. Unity's Terms of Service were last updated **2026-06-30** when this boundary was written.

Official references:

- https://unity.com/legal/terms-of-service
- https://unity.com/legal/terms-of-service/software/package-guidelines

## Core boundary

```text
USER'S UNITY PROJECT FILES
          │
          ▼
       UniLint
          │
          ├── no Unity Editor control
          ├── no Unity CLI invocation
          ├── no Package Manager API querying
          ├── no automated Unity-doc ingestion
          └── no Unity binary redistribution
          │
          ▼
  static compatibility evidence
```

UniLint core reads files the developer supplies, including `ProjectSettings`, `Packages`, `.meta`, `.asmdef`, `.asmref`, C#, Unity serialized text, shaders and plugin files.

## Oracle Pack evidence

Oracle Packs are independently structured facts, not mirrors of Unity Documentation. They must carry one provenance level:

```text
A — local-verified evidence from files the user is entitled to inspect
B — human-curated factual metadata from authoritative documentation
C — project/package metadata supplied by the analyzed project
D — inference or heuristic
```

Committed Oracle Packs must explicitly declare:

```json
{
  "automatedIngestion": false,
  "unityProcessInvoked": false,
  "networkRequired": false
}
```

Automated crawling or bulk ingestion of Unity Documentation, Unity APIs, the Asset Store, or other Unity Offerings is not part of UniLint core.

## Reference Packs

A U3 reference pack is local evidence. UniLint does not download or redistribute Unity assemblies and does not launch Unity to build a pack.

The `reference-pack` CLI command only:

1. receives a local directory explicitly supplied by the user;
2. validates explicitly named DLLs already present there; and
3. writes `unilint-reference-pack.json` beside those files.

The user must explicitly pass `--complete` to assert that the local pack models the target compilation environment. UniLint still validates that provenance and assembly classifications are present before U3 can run.

## Future integrations

A Unity Editor package, Unity API client, automated Unity process caller, documentation crawler, or agentic Unity-control feature is outside this repository's current boundary. Before adding one, perform a separate terms/authorization review and keep the existing standalone analyzer usable without it.
