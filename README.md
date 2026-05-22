# claudoctor

> Audit and clean up your Claude Code / Cursor skills — find duplicates, conflicts, and token bloat.

**Status: pre-alpha, under active development.**

## Why

You installed `obra/superpowers`, `andrej-karpathy-skills`, and three other trending skill packs. Now your Claude Code system prompt is a 40K-token mess with overlapping skills and silent conflicts. claudoctor is the lint tool for that.

## Install (coming soon)

```bash
npx claudoctor skills
```

## `claudoctor skills`

Scans known skill locations across Claude Code, Codex, Cursor, and Hermes and reports:

- **Token rank** — top skills by token cost
- **Duplicates** — identical `SKILL.md` content across agents
- **Near-duplicates** — same body, different frontmatter (frontmatter drift)
- **Conflicts** — same skill `name` with different content
- **Overlap** — semantically similar `name + description` (Jaccard); `--deep` also compares body
- **Savings estimate** — tokens reclaimable by removing duplicates, near-duplicates, and overlapping skills

```bash
claudoctor skills                          # human-readable report
claudoctor skills --json                   # machine-readable, pipe-friendly
claudoctor skills --source claude,codex    # restrict by agent
claudoctor skills --exclude '**/openclaw-imports/**'
claudoctor skills --deep                   # also tokenize bodies for overlap (O(N²), slower)
claudoctor skills --top 30 --threshold 0.6 # tweak rank + overlap sensitivity
```

`--exclude` accepts comma-separated globs and is passed straight to fast-glob's
`ignore` list. Use it to silence noisy mirror trees like
`openclaw-imports/` without editing source code.

Scanned locations:

| Agent  | Path |
|--------|------|
| claude | `~/.claude/skills/`, `~/.claude/plugins/cache/`, `~/.claude/plugins/marketplaces/` |
| codex  | `~/.codex/skills/` |
| hermes | `~/.hermes/skills/` |
| cursor | `~/.cursor/rules/`, `$PWD/.cursor/rules/` |
| project| `$PWD/.claude/skills/` |

## Roadmap

- **v0.1** — `claudoctor skills`: static analysis, token sorting, duplicate / conflict / overlap detection ✅
- **v0.2** — `bodyHash` near-duplicate detection, `--deep` body-similarity overlap, project-level `.cursor/rules`, `--exclude` glob filter ✅
- **v0.3** — Auto-fix / auto-merge for duplicates and near-duplicates; HTML report; remote agent skills repos

## License

MIT
