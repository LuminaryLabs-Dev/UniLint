# Evidence

Every diagnostic carries:

- stable rule ID
- severity
- certainty
- category
- message
- optional file/line
- machine-readable evidence
- blocking/non-blocking status

Static evidence should describe what was observed, not imply an Editor/runtime action occurred.

## Package evidence

`oracle/evidence-index.json` stores compact source identities used by `oracle/package-compatibility.json`.
Every package compatibility record cites evidence. Missing exact package/version/Unity-line combinations remain `unknown`.

Official package-release documentation establishes availability for the named Unity line and package version. It does not prove project runtime behavior.
