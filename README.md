# claudoctor

> Audit and clean up your Claude Code / Cursor skills — find duplicates, conflicts, and token bloat.

**Status: pre-alpha, under active development.**

## Why

You installed `obra/superpowers`, `andrej-karpathy-skills`, and three other trending skill packs. Now your Claude Code system prompt is a 40K-token mess with overlapping skills and silent conflicts. claudoctor is the lint tool for that.

## Install (coming soon)

```bash
npx claudoctor skills
```

## v0.1 — `claudoctor skills`

Scans known skill locations across Claude Code, Codex, Cursor, and Hermes and reports:

- **Token rank** — top skills by token cost
- **Duplicates** — identical `SKILL.md` content across agents
- **Conflicts** — same skill `name` with different content
- **Overlap** — semantically similar `name + description` (Jaccard)
- **Savings estimate** — tokens reclaimable by removing duplicates and overlapping skills

```bash
claudoctor skills                          # human-readable report
claudoctor skills --json                   # machine-readable, pipe-friendly
claudoctor skills --source claude,codex    # restrict by agent
claudoctor skills --exclude '**/openclaw-imports/**'
claudoctor skills --top 30 --threshold 0.6 # tweak rank + overlap sensitivity
```

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
- **v0.2** — `--deep` semantic conflict detection via local `claude` CLI; `claudoctor runtime` for RTK / hook completeness
- **v0.3** — Unified dashboard combining system prompt + runtime IO health

## License

MIT
