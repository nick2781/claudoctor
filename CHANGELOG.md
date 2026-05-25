# Changelog

All notable changes to claudoctor will be documented here. Format loosely
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [2026.5.25] — CalVer migration & docs

- Switched versioning from SemVer to CalVer (`YYYY.M.D`)
- Added PLAN.md / MEMORY.md as living docs (must be updated each cycle)
- Codified Versioning + Release process in README / AGENT.md / CLAUDE.md / CONTRIBUTING.md

## [0.3.0] - 2026-05-25

### Added
- `claudoctor claudemd [path]` — new top-level command that diagnoses a
  `CLAUDE.md` file. Detects token bloat (warn/error over 5 000 / 15 000
  tokens), rule overload, verbose / vague / counterproductive instructions,
  contradictions, missing best-practice sections (Tone, Tools, Workflow,
  …) and structural issues (missing frontmatter, broken headings, emphasis
  spam). Defaults to `./CLAUDE.md` then `~/.claude/CLAUDE.md` when no path
  is given. Exits non-zero when any `error`-severity finding fires.
- `--llm` / `--no-llm` cross-check via the Anthropic SDK
  (`@anthropic-ai/sdk`). When `ANTHROPIC_API_KEY` is set, the LLM pass
  runs by default and adds findings the static rules missed; without a
  key the command gracefully degrades to rules-only with a stderr
  warning. `--model <id>` selects the model (default
  `claude-haiku-4-5-20251001`).
- `--json`, `--md` (default), `--text` and `--output <file>` renderers
  for the new command, sharing a single `DoctorReport` contract.
- Declarative rule engine in `src/lib/claudemd/rules.ts` driven by
  `rules.data.ts` so new checks ship as data, not code.
- 24 new unit tests covering parser, rule engine and renderers, plus 15
  CLAUDE.md fixtures (well-formed / minimal / bloated / verbose /
  vague / contradiction / emphasis-spam / …).

### Internal
- Integrated from two parallel sub-issues: NIC-10 (parser + rule engine
  + fixtures) and NIC-11 (LLM cross-check + md/text renderers).
- CLI version now reads from `package.json` at startup instead of being
  hard-coded.

## [0.2.0] - 2026-05-22

### Added
- `bodyHash` on every `Skill` — sha256 of the trimmed body (frontmatter
  stripped) — sits alongside the existing `contentHash` of the full raw file.
- `Analysis.nearDuplicates` — groups skills that share a `bodyHash` but differ
  on `contentHash` (the frontmatter-drift case that previously fell into
  `conflicts`). Reported in the text renderer and JSON output, and contributes
  a `nearDuplicateTokens` line to the savings estimate.
- `--deep` flag on `claudoctor skills` now does something: body tokens are
  tokenized once per skill and overlap similarity becomes
  `max(descSimilarity, bodySimilarity)`. Each `OverlapPair` carries both
  components so callers can see why a pair matched. Without `--deep`, behaviour
  is unchanged from v0.1.
- `--exclude <glob,glob,...>` on `claudoctor skills` — comma-separated globs
  forwarded to fast-glob's `ignore` list. Lets users silence noisy mirror trees
  (e.g. `**/openclaw-imports/**`) without source edits.
- Project-level Cursor rules are now scanned by default
  (`$PWD/.cursor/rules/**/*.{mdc,md}`), matching real-world usage. The existing
  `~/.cursor/rules/` source is preserved.

### Changed
- `Analysis.savings` gained a `nearDuplicateTokens` field and the total is now
  `duplicateTokens + nearDuplicateTokens + overlapTokens`. Double-counting is
  prevented via the existing `counted` set: a file already credited to a
  duplicate group cannot be credited again as a near-duplicate or overlap.
- Text renderer shows a `Near-duplicates` table and, when any overlap carries
  a `bodySimilarity`, splits the overlap table into separate `Desc` / `Body`
  similarity columns.

### Internal
- Integrated from two parallel sub-issues: NIC-5 (sources + `--exclude`) and
  NIC-6 (`bodyHash` + `--deep`). 13 unit tests, all green.
