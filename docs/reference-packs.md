# Target reference packs

UniLint refuses to treat an arbitrary directory of DLLs as U3 proof. A reference-pack directory must contain target reference assemblies plus an explicit `unilint-reference-pack.json` manifest:

```json
{
  "schemaVersion": "0.1",
  "unityLine": "6000.3",
  "complete": true,
  "generatedLocally": true,
  "assemblies": {
    "framework": [
      "mscorlib",
      "netstandard"
    ],
    "engine": [
      "UnityEngine.CoreModule",
      "UnityEngine.PhysicsModule",
      "UnityEditor.CoreModule"
    ],
    "autoReferenced": [
      "Unity.InputSystem"
    ]
  }
}
```

`complete=true` is an assertion by the pack creator that the pack models the target compilation environment being certified. UniLint does not distribute Unity assemblies.

The assembly classifications are deliberately explicit:

- `assemblies.framework` contains the target framework/reference assemblies Unity compiles against; UniLint does not substitute the host .NET runtime.
- `assemblies.engine` contains the Unity engine/editor reference assemblies that normal assemblies receive unless `noEngineReferences` is set.
- `assemblies.autoReferenced` contains non-engine assemblies that Unity would make available automatically for this target environment. An empty array is valid.
- Explicit `.asmdef` references are still resolved by assembly name from the pack, even when they are not auto-referenced.

UniLint does **not** scan every DLL in the directory and silently add it as a compiler reference. That would make offline compilation over-permissive and could create a false U3 PASS.

If the manifest is absent, incomplete, targets a different Unity line, omits a required assembly classification, references a declared assembly that is missing from the pack, or contains no managed DLLs, U3 compilation does not succeed.
