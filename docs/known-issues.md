# Known limitations and verification gaps

The following are **documented scope limitations**, not newly reproduced defects.

## Static evidence boundary

- UniLint does not run the Unity Editor, import assets in Unity, build player binaries, or verify runtime behavior.
- No U4 (build-predictive) or U5 (runtime-verified) claim is permitted by its current compatibility model.
- U3 requires successful Roslyn compilation against a complete, locally supplied reference assembly pack. Ordinary source indexing cannot establish U3.
- Shaders, custom importers, opaque native binaries, platform-native build behavior, and some asset migrations are outside the present proof boundary.
- An unresolvable or incomplete package/API fact must remain unknown, not silently pass.
- Unity data containing references outside `Assets/` can cause ambiguity; unmatched GUID references are not all proven deleted.
- Source documentation describes v0.1 compatibility and v0.2 static scene graph features; the current package manifest is `0.2.3`. Version-specific capabilities should be checked against current code, not inferred from one section of the README.

## Tests not demonstrated in this pass

- No fresh local `npm test`, `npm run validate`, Python smoke, or Roslyn worker build was executed.
- No CI run status, real Unity build, runtime parity, or rights certification was independently verified.

See [validation](validation.md), [compatibility model](compatibility-model.md), [signal graph](signal-graph.md), and [compliance boundary](compliance-boundary.md) for precise evidence limits. File concrete bug reports only after reproducible evidence.
