# Oracle packs

`oracle/versions/*.json` describes target Unity lines without bundling Unity binaries.

Trust levels:

```text
A-verified   compared against real Unity truth fixtures
B-derived    derived from authoritative Unity contracts/metadata
C-community  third-party supplied
D-inferred   heuristic
```

The initial `6000.0` and `6000.3` packs are B-derived. Their API-surface coverage explicitly requires a local target reference pack before U3 can be awarded.
