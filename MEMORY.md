# Memory

## Decisions

- 2026-05-25: Switched from SemVer to CalVer because the user prefers
  date-based releases. The canonical format is `YYYY.M.D`, without zero
  padding. Same-day follow-up releases append `.N`.
- 2026-05-25: Release flow is `CHANGELOG.md` first, then `package.json`
  `version`, commit, matching git tag, and GitHub Release. npm publishing is a
  separate decision, not an automatic release step.

## Lessons learned

- Keep this section for reusable implementation or release lessons. Do not use
  it as a scratchpad for one-off run notes.

## Pitfalls

- Keep this section for recurring hazards that future agents should check
  before changing release, packaging, or documentation flow.
