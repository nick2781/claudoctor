# Contributing to claudoctor

Thanks for the interest. claudoctor is small and pre-1.0, so contributions are very welcome.

## Before you start

For anything beyond a typo, comment, or one-line fix, please **open an issue first** to sanity-check the direction. The roadmap in `README.md` is the rough plan; pull requests outside of it may still be accepted but expect a discussion.

## Local setup

```bash
git clone https://github.com/nick2781/claudoctor.git
cd claudoctor
pnpm install
pnpm test
pnpm build
```

Requires Node.js ≥ 18 and pnpm (or npm — `package-lock.json` is not checked in, but `npm install` works).

## Before submitting a PR

1. `pnpm test` — vitest, all green.
2. `pnpm lint` — `tsc --noEmit`, zero errors.
3. `pnpm build` — produces `dist/cli.mjs` cleanly.
4. Update `CHANGELOG.md` under an `## [Unreleased]` heading.
5. If you added a new CLI flag, update the `Usage` section in `README.md`.

Keep commits focused; squash noise locally before pushing.

## Versioning

claudoctor uses the same CalVer rules documented in `README.md`: release
versions use `YYYY.M.D` with no zero padding, and same-day follow-up releases
append `.N`, such as `2026.5.25.1`.

## Release process

For maintainers preparing a release:

1. Confirm the changelog describes the release.
2. Update `package.json` `version` to the CalVer value.
3. Run `pnpm install` if package metadata changes require lockfile refresh.
4. Run `pnpm test`, `pnpm lint`, and `pnpm build`.
5. Commit the release changes.
6. Tag the commit with the same CalVer value, for example `2026.5.25`.
7. Create the GitHub Release from that tag.
8. Leave npm publishing to a separate explicit decision.

## Code style

- TypeScript strict mode. No `any` without a comment justifying it.
- Functions over classes unless state is genuinely needed.
- Tests live in `test/`, fixtures in `test/fixtures/`. Add a fixture when adding a new detection.

## Reporting bugs

Open a GitHub issue with:

- `claudoctor --version`, Node.js version, OS.
- Exact command that reproduces.
- Expected vs. actual output.

If the report involves sensitive paths (`~/.claude/...`), feel free to redact — `claudoctor skills --json | jq '.skills | length'` is often enough.

## License

By contributing, you agree your contributions are licensed under the [MIT License](LICENSE).
