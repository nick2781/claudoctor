# Plan

## Current milestone: first CalVer feature release

### Goal

Ship the former v0.4 scope as the first feature-bearing CalVer release, using
the same changelog -> package version -> commit -> tag -> GitHub Release flow.

### Sub-issues

- Duplicates and near-duplicates auto-fix / auto-merge.
- HTML report output: `claudoctor report --format html` now generates a
  single-file offline report with CLAUDE.md findings, skills findings, and
  duplicate / near-duplicate columns.
- Remote skill-pack repository support. Implemented via
  `claudoctor skill add/list/remove` plus a static registry index.

### Exit criteria

- Each feature has focused tests and documentation.
- README usage examples cover the new user-facing commands or flags.
- CHANGELOG.md summarizes the feature release under its CalVer version.
- PLAN.md and MEMORY.md are updated at the end of the milestone.
- PRs for all three sub-issues are merged before the release tag is cut.

## Next milestone: CalVer feature release packaging

### Goal

After the three feature sub-issues merge, package them as the next CalVer
release.

### Sub-issues

- Update CHANGELOG.md for the feature release.
- Update `package.json` to the release date version.
- Tag the release and create the GitHub Release.

### Exit criteria

- Feature PRs are merged.
- `pnpm lint`, `pnpm test`, and `pnpm build` pass on main.
- The CalVer tag and GitHub Release are published.
