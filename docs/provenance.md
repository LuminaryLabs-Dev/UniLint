# Provenance and redistribution boundaries

## Repository-owned material

The repository contains Node ESM source (`src/`, `apps/service/`), fixtures, tests, local Oracle metadata, a Python worker, and a Roslyn worker. The root `LICENSE` declares MIT for the project; individual third-party material remains subject to upstream rights.

## Third-party dependencies

- `yaml` 2.9.1: npm dependency, ISC license (as recorded in `THIRD_PARTY_NOTICES.md`).
- `Microsoft.CodeAnalysis.CSharp` 5.6.0: NuGet dependency, MIT license (per third-party notices).
- Unity, its marks and binaries belong to their owners. UniLint is not affiliated with Unity Technologies.

## Evidence sources and limitations

Oracle Packs identify A/B/C/D evidence provenance. The included version records are human-curated and intentionally incomplete; the repository requires explicit flags prohibiting automated ingestion/network reliance when generating committed Oracle Packs. Project/package facts derive from analyzed local source; inference must remain labeled.

A U3 proof needs an authorized, complete local target reference pack. Neither Unity engine binaries nor reference assemblies are shipped with this repository. Do not mistake a reference-pack manifest for a grant of redistribution rights.

See [compliance boundary](compliance-boundary.md), [evidence](evidence.md), [Oracle packs](oracle-packs.md), [reference packs](reference-packs.md), [LICENSE](../LICENSE), and [third-party notices](../THIRD_PARTY_NOTICES.md). This inventory is not a legal certification.
