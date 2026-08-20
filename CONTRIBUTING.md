# Contributing to UniLint

UniLint is distributed under the MIT License.

By submitting a contribution, you represent that you have the right to submit it and agree that your contribution may be distributed under the MIT License. Copyright in individual contributions remains with the applicable author unless separately assigned.

## Contribution requirements

- Do not submit Unity binaries, Unity source code, copied Unity documentation, Unity artwork, credentials, or other material you do not have the right to redistribute.
- Preserve UniLint's offline evidence boundary: no Unity documentation crawler, Unity API automation, Package Manager automation, or automatic Unity process control in the validated core.
- Keep unknown evidence unknown and avoid changes that can create false-compatible results.
- Add or update tests for behavior changes.

Before submitting changes, run:

```bash
npm ci
npm test
npm run validate
```

See `AGENTS.md` and `docs/compliance-boundary.md` for additional project invariants.
