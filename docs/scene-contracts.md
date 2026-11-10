# UniLint — Exact Unity Scene and Prefab Contract

Use `node src/scene-contract-cli.mjs <UnityProject> --unity 6000.3.28f1 --scenes Bootstrap,Level01_Cottage,Level02_Basement,Level03_SecretTunnel,Level04_ArcaneExterior --prefabs Assets/Resources/WoodStoveBase.prefab,Assets/Resources/WoodStoveCopperVariant.prefab`.

This is an **independent, read-only, source-level** preflight. It checks the exact
`ProjectVersion.txt` string, build-list scene identities and ordering, required
prefab files and metadata, duplicate GUIDs, and broken/cyclic prefab inheritance.
It reports the exact files that fail instead of inventing Unity runtime proof.

It complements `index`, `audit`, `compat` and `graph`; it does not replace the
normal U0–U3 compatibility model. `oracle/versions/6000.3.json` intentionally
remains Unity 6.3 family evidence rather than a fabricated patch-specific Oracle.
Only supply real, licensed Unity 6000.3.28f1 reference assemblies for U3, and
use the actual Unity Editor to verify import, C# compilation, prefabs, physics,
materials, PlayMode and player builds. No Unity process is launched by this CLI.
