# Validation

## Locally executable without Unity

- Node unit/fixture tests
- project indexing
- GUID graph integrity
- Unity YAML document/reference parsing
- `.asmdef`/`.asmref` parsing
- target define reconstruction
- version-defined symbol evaluation
- package minimum-version checks when local `package.json` evidence exists
- Python worker smoke test
- CLI/report contract
- repository invariant validator

## Requires .NET + user-supplied target reference pack

- Roslyn worker restore/build
- actual U3 semantic compilation

## Requires real Unity to calibrate oracle truth

- exact Unity compilation parity
- AssetDatabase/import behavior
- serialized asset migration behavior
- shader/compiler behavior
- platform build behavior
- runtime behavior

The highest static level in v0.1 is U3. No v0.1 code path is allowed to emit U4 or U5.
