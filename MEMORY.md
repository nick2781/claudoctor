# Memory

## Decisions

- 2026-05-25: Switched from SemVer to CalVer because the user prefers
  date-based releases. The canonical format is `YYYY.M.D`, without zero
  padding. Same-day follow-up releases append `.N`.
- 2026-05-25: Release flow is `CHANGELOG.md` first, then `package.json`
  `version`, commit, matching git tag, and GitHub Release. npm publishing is a
  separate decision, not an automatic release step.
- 2026-05-25: Remote skill packs install under `~/.claudoctor/skills/<pack-name>/`.
  The first registry is a static JSON index, overridable with
  `CLAUDOCTOR_REGISTRY_URL` or `~/.claudoctor/config.json`.
- 2026-05-25: The combined `claudoctor report` command uses the existing
  CLAUDE.md `DoctorReport` and skills `Analysis` contracts rather than creating
  a third scan data model. HTML output is a single offline file with inline CSS
  and source `file://` links.

## Lessons learned

- Keep report rendering separate from command I/O. The pure combined-report
  renderer made it straightforward to snapshot the HTML structure and reuse the
  same data for Markdown, JSON, and HTML.

## Pitfalls

- Keep this section for recurring hazards that future agents should check
  before changing release, packaging, or documentation flow.
- There is no separate `scan` command yet. Until that exists, combined report
  generation should compose the current `claudemd` and `skills` data contracts
  directly and avoid duplicating analyzer logic.
