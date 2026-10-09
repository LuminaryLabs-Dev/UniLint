# Dependencies

## Runtime and development requirements

| Dependency | Evidence | Requirement |
| --- | --- | --- |
| Node.js | `package.json` `engines.node` | 20 or newer |
| npm | `package-lock.json`, `npm ci` workflow | Use the committed lockfile |
| `yaml` | `package.json` | Pinned at `2.9.1` |
| Python | `workers/python/unilint_worker.py` | Standard-library-only worker; CI uses Python 3.13 |
| .NET SDK | `workers/roslyn/UniLint.Roslyn.csproj` | CI uses .NET 8 |
| Roslyn | `workers/roslyn/UniLint.Roslyn.csproj`, `THIRD_PARTY_NOTICES.md` | `Microsoft.CodeAnalysis.CSharp` 5.6.0 |

The CLI and service are native Node ESM modules. The repository contains a small Python worker and a separate Roslyn C# worker.

## Data and external inputs

UniLint analyzes developer-supplied **local Unity project directories** and local Oracle/reference packs; it is not an Editor plugin. Initial Oracle Pack data lives under `oracle/`, including versions `6000.0` and `6000.3`. Reference assemblies for U3 are **not bundled** and must be supplied locally by an authorized user. Unity binaries are not redistributed.

The CI workflow references a second GitHub repository, `LuminaryLabs-Dev/NexusWorldFactory`, to inspect a real Unity 6000.3 project. That is a test data dependency in CI, not part of the runtime CLI.

## Rights and network boundaries

Read [the compliance boundary](compliance-boundary.md) and [third-party notices](../THIRD_PARTY_NOTICES.md). Development package installation and CI may require network access; the UniLint analysis core is designed to operate on local evidence without network ingestion. Do not confuse an offline-capable analysis operation with an offline dependency installation.
