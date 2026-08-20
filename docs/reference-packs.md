# Target reference packs

UniLint refuses to treat an arbitrary directory of DLLs as U3 proof. A reference-pack directory must contain target reference assemblies plus an explicit `unilint-reference-pack.json` manifest using schema `0.2`:

```json
{
  "schemaVersion": "0.2",
  "unityLine": "6000.3",
  "complete": true,
  "generatedLocally": true,
  "provenance": {
    "sourceMode": "local-installed-files",
    "unityProcessInvoked": false,
    "networkAccess": false
  },
  "assemblies": {
    "framework": ["mscorlib", "netstandard"],
    "engine": ["UnityEngine.CoreModule", "UnityEngine.PhysicsModule", "UnityEditor.CoreModule"],
    "autoReferenced": ["Unity.InputSystem"]
  }
}
```

`complete=true` is an explicit assertion by the pack creator that the pack models the target compilation environment being certified. UniLint does not distribute Unity assemblies.

## Local-files-only manifest helper

UniLint can write the manifest around DLLs already present in a directory supplied by the developer:

```bash
node src/cli.mjs reference-pack /path/to/reference-assemblies \
  --unity 6000.3 \
  --framework mscorlib,netstandard \
  --engine UnityEngine.CoreModule,UnityEngine.PhysicsModule,UnityEditor.CoreModule \
  --auto Unity.InputSystem \
  --complete
```

The helper does **not** launch Unity, call Unity APIs, query Package Manager, access Unity Documentation, or use the network. It only checks that the explicitly declared DLL basenames exist in the supplied local directory and writes the manifest.

Omit `--complete` while assembling or reviewing a pack. An incomplete pack cannot produce U3.

## Assembly classifications

- `assemblies.framework` contains the target framework/reference assemblies Unity compiles against; UniLint does not substitute the host .NET runtime.
- `assemblies.engine` contains Unity engine/editor reference assemblies that normal assemblies receive unless `noEngineReferences` is set.
- `assemblies.autoReferenced` contains non-engine assemblies that the pack creator has determined are automatically available for the target environment. An empty array is valid.
- Explicit `.asmdef` references are still resolved by assembly name from the pack, even when they are not auto-referenced.

UniLint does **not** scan every DLL in the directory and silently add it as a compiler reference. That would make offline compilation over-permissive and could create a false U3 PASS.

If the manifest is absent, uses the older schema, lacks local provenance, is incomplete, targets a different Unity line, omits a required assembly classification, references a declared assembly that is missing, or contains no managed DLLs, U3 compilation does not succeed.
