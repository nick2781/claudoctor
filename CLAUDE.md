# Claude Agent Notes

This file mirrors the repository collaboration rules in `AGENT.md`. Keep both
files aligned; `AGENT.md` is the source of truth when the two disagree.

## Non-negotiable rules

1. Releases use CalVer: `YYYY.M.D`, with no zero padding. Same-day follow-up
   releases append `.N`, such as `2026.5.25.1`.
2. At the end of every development cycle, update both `PLAN.md` and
   `MEMORY.md`. A development cycle means one feature, one release, or one
   closed sub-issue.

## Living docs

`PLAN.md` is for forward-looking milestones, sub-issues, and exit criteria.
Update it when scope changes, a milestone closes, or the next milestone becomes
actionable.

`MEMORY.md` is for durable decisions, rationale, lessons learned, and pitfalls
future agents should remember. Keep transient implementation notes in issue
comments or pull requests instead.

## Release process

1. Update `CHANGELOG.md`.
2. Update `package.json` `version` to the CalVer value.
3. Commit the release changes.
4. Create a matching git tag.
5. Create the GitHub Release.
6. Treat npm publishing as a separate decision.
