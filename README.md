# claudoctor

**English** · [简体中文](README.zh-CN.md)

> The lint tool for agent skills. Audit and clean up your Claude Code / Codex / Cursor / Hermes skills — find duplicates, conflicts, and token bloat.

[![npm version](https://img.shields.io/npm/v/claudoctor.svg)](https://www.npmjs.com/package/claudoctor)
[![CI](https://github.com/nick2781/claudoctor/actions/workflows/ci.yml/badge.svg)](https://github.com/nick2781/claudoctor/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](package.json)

**Status: early. Works on real data, API may still shift before 1.0.**

## Why

You installed `obra/superpowers`, a few trending skill packs, copied things into `~/.claude/skills/` once, then again into `~/.codex/skills/`. Your Claude Code / Codex system prompt is now several hundred KB of overlapping skills, accidental duplicates, and silent name conflicts. You have no idea what's actually loaded or what costs you tokens on every turn.

`claudoctor` scans the known skill locations on disk and tells you. Static analysis only — never reads code, never phones home.

## Install

```bash
# one-shot
npx claudoctor skills

# or install globally
npm install -g claudoctor
claudoctor skills
```

Requires Node.js ≥ 18.

## Usage

```bash
claudoctor skills                            # human-readable report
claudoctor skills --json                     # machine-readable, pipe-friendly
claudoctor skills --source claude,codex      # restrict by agent
claudoctor skills --exclude '**/openclaw-imports/**'
claudoctor skills --deep                     # also tokenize bodies for overlap (O(N²), slower)
claudoctor skills --top 30 --threshold 0.6   # tweak rank size + overlap sensitivity
```

### What it reports

- **Token rank** — top skills by token cost (via `@anthropic-ai/tokenizer`)
- **Duplicates** — byte-identical `SKILL.md` content across agents / paths
- **Near-duplicates** — identical body, different frontmatter (frontmatter drift)
- **Conflicts** — same skill `name` with different content
- **Overlap** — semantically similar `name + description` (Jaccard on token sets); `--deep` also compares body tokens
- **Savings estimate** — tokens you'd reclaim by removing duplicates, near-duplicates, and the smaller half of each overlap pair (no double counting)

### Sample output

```
claudoctor skills
Scanned 393 skills, 2462.2k tokens total.

By agent
┌────────┬────────┬─────────┐
│ Agent  │ Skills │ Tokens  │
├────────┼────────┼─────────┤
│ hermes │ 283    │ 2186.2k │
│ claude │ 104    │ 259.6k  │
│ codex  │ 6      │ 16.4k   │
└────────┴────────┴─────────┘

Duplicates (55)         ...
Near-duplicates (5)     ...
Conflicts (57)          ...
Overlap (showing top 50 of 224)
Estimated savings: ~499.0k tokens
```

### Scanned locations

| Agent   | Path |
|---------|------|
| claude  | `~/.claude/skills/`, `~/.claude/plugins/cache/`, `~/.claude/plugins/marketplaces/` |
| codex   | `~/.codex/skills/` |
| hermes  | `~/.hermes/skills/` |
| cursor  | `~/.cursor/rules/`, `$PWD/.cursor/rules/` |
| project | `$PWD/.claude/skills/` |

`--exclude` accepts comma-separated globs and is forwarded to fast-glob's `ignore` list — handy for silencing noisy mirror trees like `openclaw-imports/` without editing source.

### JSON output

`--json` emits the full `Analysis` object (skills, duplicates, nearDuplicates, conflicts, overlaps, savings). Pipe it into `jq`, ship it to a dashboard, diff it across machines.

```bash
claudoctor skills --json | jq '.savings'
claudoctor skills --json | jq '.duplicates[] | {name, copies, wastedTokens}'
```

## Roadmap

- **v0.1** — `claudoctor skills`: static analysis, token sorting, duplicate / conflict / overlap detection ✅
- **v0.2** — `bodyHash` near-duplicate detection, `--deep` body-similarity overlap, project-level `.cursor/rules`, `--exclude` glob filter ✅
- **v0.3** — Auto-fix / auto-merge for duplicates and near-duplicates; HTML report; remote skill-pack repos

See [CHANGELOG.md](CHANGELOG.md) for release notes.

## Development

```bash
pnpm install
pnpm dev skills      # run from source
pnpm build           # bundle via tsup → dist/cli.mjs
pnpm test            # vitest
pnpm lint            # tsc --noEmit
```

Source layout:

```
src/
  cli.ts             commander wiring
  commands/skills.ts top-level `skills` command
  lib/
    sources.ts       known skill locations per agent
    discover.ts      file discovery + hashing (contentHash / bodyHash)
    tokens.ts        @anthropic-ai/tokenizer wrapper
    analyze.ts       duplicate / near-duplicate / conflict / overlap detection
    report.ts        text + json renderers
test/                vitest unit tests + fixtures
```

## Contributing

Issues and PRs welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for the short version: open an issue first for non-trivial changes, run `pnpm test` and `pnpm lint` before pushing.

## License

[MIT](LICENSE) © Nick Yang
