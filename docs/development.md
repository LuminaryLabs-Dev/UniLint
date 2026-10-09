# Development workflow

## Setup

```sh
npm ci
npm test
npm run validate
```

Node.js 20+ is required. Use `npm run check` to run the test suite and validator sequentially; these commands are defined in `package.json`.

## CLI examples

```sh
node src/cli.mjs index /path/to/UnityProject
node src/cli.mjs compat fixtures/good/basic-project --unity 6000.3 --format json
node src/cli.mjs audit /path/to/UnityProject
node src/cli.mjs oracles
node src/cli.mjs graph /path/to/UnityProject --scope build-list --out /tmp/unilint-run
node src/cli.mjs query /tmp/unilint-run --view findings --limit 20
```

The README documents additional `versions`, `reference-pack`, and scene review commands.

## Service and workers

- Local HTTP service: `node apps/service/server.mjs`, binding to `127.0.0.1:17450` by default.
- Python worker: `workers/python/unilint_worker.py`, used for asset facts and tested separately.
- Roslyn worker: `dotnet build workers/roslyn/UniLint.Roslyn.csproj --configuration Release`. Actual U3 claims require a valid local target reference pack and a successful compile; building the worker alone is insufficient.

## Contributor boundaries

Read `AGENTS.md`, `docs/architecture.md`, `docs/compliance-boundary.md`, `docs/evidence.md`, and `docs/validation.md` before modifying behavior. Do not add Unity process control, automated Unity documentation crawling, binary redistribution, or unsupported compatibility certainty.

After edits, rerun the appropriate checks; record the command, environment, exit status, and evidence. No commands were executed in this documentation-only pass.
