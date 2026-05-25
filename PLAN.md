# Plan

## Current milestone: CalVer migration and documentation rules

### Goal

Move claudoctor from SemVer to CalVer and codify the release and living-doc
process across the repository's durable documentation.

Release flow for this milestone: update `CHANGELOG.md`, update `package.json`
`version`, commit, tag `2026.5.25`, create the GitHub Release, and leave npm
publishing for a separate decision.

### Sub-issues

- Update README.md and README.zh-CN.md with CalVer and release process docs.
- Add AGENT.md and CLAUDE.md with shared agent collaboration rules.
- Update CONTRIBUTING.md with maintainer-facing versioning and release steps.
- Create PLAN.md and MEMORY.md as required living docs.
- Change package metadata and changelog to `2026.5.25`.

### Exit criteria

- README.md, README.zh-CN.md, AGENT.md, CLAUDE.md, CONTRIBUTING.md, PLAN.md,
  and MEMORY.md all document CalVer or the release/living-doc process.
- `package.json` and `CHANGELOG.md` are migrated to `2026.5.25`.
- Tests, lint, and build pass before merge.
- PR is merged, tag `2026.5.25` is pushed, and a GitHub Release is created.

## Next milestone: first CalVer feature release

### Goal

Ship the former v0.4 scope as the first feature-bearing CalVer release, using
the same changelog -> package version -> commit -> tag -> GitHub Release flow.

### Sub-issues

- Duplicates and near-duplicates auto-fix / auto-merge.
- HTML report output.
- Remote skill-pack repository support. Implemented via
  `claudoctor skill add/list/remove` plus a static registry index.

### Exit criteria

- Each feature has focused tests and documentation.
- README usage examples cover the new user-facing commands or flags.
- CHANGELOG.md summarizes the feature release under its CalVer version.
- PLAN.md and MEMORY.md are updated at the end of the milestone.
