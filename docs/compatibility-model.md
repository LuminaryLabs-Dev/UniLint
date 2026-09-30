# Compatibility model

UniLint treats compatibility as evidence aggregation rather than a boolean guess.

```text
U0  structurally blocked / insufficient project
U1  structurally valid
U2  target version resolved
U3  offline semantic compilation proven
U4  build predicted          (not implemented in v0.1)
U5  runtime verified         (requires real Unity/runtime)
```

U2 requires a supported target oracle and no blocking structural/package/assembly evidence. U3 additionally requires successful Roslyn compilation against a supplied target reference pack.

The model is intentionally asymmetric: uncertainty may reduce the level or remain visible, but it may never increase confidence.

## Package compatibility states

Package conclusions are exact-record and evidence gated:

- `compatible` — the exact package/version/Unity line has supporting evidence for the recorded scope.
- `incompatible` — exact evidence blocks the combination.
- `deprecated` — exact evidence marks the combination deprecated.
- `unknown` — no exact evidence exists or identity is incomplete.

A nearby version, similar package name, or another project's manifest never upgrades `unknown` to a compatibility claim.
