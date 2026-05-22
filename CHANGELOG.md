# Changelog

All notable changes to claudoctor will be documented here. Format loosely
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
