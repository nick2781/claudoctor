# claudoctor

**English** · [简体中文](README.zh-CN.md)

> The lint tool for agent skills and CLAUDE.md. Audit and clean up your Claude Code / Codex / Cursor / Hermes skills — find duplicates, conflicts, and token bloat — and diagnose verbose / vague / counterproductive rules in CLAUDE.md.

[![npm version](https://img.shields.io/npm/v/claudoctor.svg)](https://www.npmjs.com/package/claudoctor)
[![CI](https://github.com/nick2781/claudoctor/actions/workflows/ci.yml/badge.svg)](https://github.com/nick2781/claudoctor/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](package.json)

Versioned with **CalVer** (`YYYY.M.D`).

**Status: early. Works on real data, API may still shift before 1.0.**

## Why

You installed `obra/superpowers`, a few trending skill packs, copied things into `~/.claude/skills/` once, then again into `~/.codex/skills/`. Your Claude Code / Codex system prompt is now several hundred KB of overlapping skills, accidental duplicates, and silent name conflicts. You have no idea what's actually loaded or what costs you tokens on every turn.

The audit commands scan the known skill locations on disk and tell you. Static
analysis only — they never read code or phone home. The `skill add` command is
the explicit networked path for installing remote packs.

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

## `claudoctor skill`

Install community skill packs into `~/.claudoctor/skills/<pack-name>/`.

```bash
claudoctor skill add git+https://github.com/acme/agent-skills.git
claudoctor skill add gh:acme/agent-skills/codex#main
claudoctor skill add starter-skills --yes
claudoctor skill list
claudoctor skill remove starter-skills
```

Supported sources:

- `git+https://...` — clone a git repository directly.
- `gh:owner/repo[/path][#ref]` — GitHub shorthand, with optional subdirectory and ref.
- `<pack-name>` — look up a pack in the registry, then clone its configured source.

Installs show the source URL and ask for confirmation before cloning. Pass
`--yes` for scripts and CI. If the target directory already exists, the command
fails unless `--force` is set.

The default registry is the static [`registry/index.json`](registry/index.json)
shipped with the package. Override it with `CLAUDOCTOR_REGISTRY_URL` or
`~/.claudoctor/config.json`:

```json
{
  "registryUrl": "https://example.com/claudoctor-registry.json"
}
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

## `claudoctor claudemd`

Diagnose a `CLAUDE.md` file. Catches token bloat, rule overload, vague /
verbose / counterproductive instructions, missing best-practice sections
(Tone, Tools, …), and contradictions — then, optionally, asks Claude to
cross-check what the static rules missed.

```bash
claudoctor claudemd                         # ./CLAUDE.md, then ~/.claude/CLAUDE.md
claudoctor claudemd path/to/CLAUDE.md       # explicit path
claudoctor claudemd --json                  # machine-readable DoctorReport
claudoctor claudemd --text                  # colored terminal text
claudoctor claudemd --llm                   # cross-check via Claude API
claudoctor claudemd --no-llm                # skip LLM even if ANTHROPIC_API_KEY set
claudoctor claudemd --model claude-haiku-4-5-20251001
claudoctor claudemd --output report.md      # write to file
```

The LLM cross-check is opt-in: if `ANTHROPIC_API_KEY` is set, it runs by
default; pass `--no-llm` to skip it. When the key is missing, the command
falls back to rules-only and writes a one-line warning to stderr.

### What it reports

- **Token bloat** — flags files over 5 000 / 15 000 tokens (warn / error)
- **Rule overload** — too many imperative `MUST` / `NEVER` rules in one file
- **Verbose / vague** — long rules, weasel words ("appropriate", "where suitable")
- **Counterproductive** — patterns known to hurt agent behaviour
- **Conflicts** — contradictory rules in the same section
- **Missing best-practice sections** — Tone, Tools, Workflow, …
- **Structural** — missing frontmatter, broken headings, emphasis spam
- **LLM cross-check** *(optional)* — Claude reads the file and adds findings the static rules miss

Exit code is `1` when any `error`-severity finding is produced (handy in CI).

## Roadmap

- **v0.1** — `claudoctor skills`: static analysis, token sorting, duplicate / conflict / overlap detection ✅
- **v0.2** — `bodyHash` near-duplicate detection, `--deep` body-similarity overlap, project-level `.cursor/rules`, `--exclude` glob filter ✅
- **v0.3** — `claudoctor claudemd`: static + LLM diagnosis of CLAUDE.md (token bloat, rule overload, vague / verbose / counterproductive rules, missing best-practice sections); markdown / text / JSON output ✅
- **Next CalVer release** — Auto-fix / auto-merge for duplicates and near-duplicates; HTML report; remote skill-pack repos ✅

See [CHANGELOG.md](CHANGELOG.md) for release notes.

## Versioning

claudoctor uses calendar versioning instead of SemVer.

- Release versions use `YYYY.M.D`, with no zero padding. Example: `2026.5.25`.
- If more than one release ships on the same day, append `.N`: `2026.5.25.1`, `2026.5.25.2`.
- The next formal release after `0.3.0` is the first CalVer release.

## Release process

1. Update `CHANGELOG.md` with the release notes.
2. Update `package.json` `version` to the CalVer value.
3. Commit the release changes.
4. Create a matching git tag, for example `2026.5.25`.
5. Create the GitHub Release from that tag.
6. Decide npm publishing separately; do not publish to npm as an automatic part of this process.

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
  cli.ts                  commander wiring
  commands/
    skills.ts             top-level `skills` command
    skill.ts              `skill add/list/remove` remote pack commands
    claudemd.ts           top-level `claudemd` command
  lib/
    sources.ts            known skill locations per agent
    discover.ts           file discovery + hashing (contentHash / bodyHash)
    tokens.ts             @anthropic-ai/tokenizer wrapper
    analyze.ts            duplicate / near-duplicate / conflict / overlap detection
    report.ts             text + json renderers (skills)
    skillpacks/           source parsing, registry lookup, install/remove/list
    claudemd/
      types.ts            DoctorReport / Finding / Rule contract
      parse.ts            CLAUDE.md → frontmatter + sections + rules
      rules.ts            rule engine driving rules.data.ts
      rules.data.ts       declarative rule definitions
      llm.ts              optional Claude API cross-check
      report.ts           md / text / json renderers (claudemd)
test/                     vitest unit tests + fixtures
```

## Contributing

Issues and PRs welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for the short version: open an issue first for non-trivial changes, run `pnpm test` and `pnpm lint` before pushing.

## License

[MIT](LICENSE) © Nick Yang
