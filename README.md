# claudoctor

> Audit and clean up your Claude Code / Cursor skills — find duplicates, conflicts, and token bloat.

**Status: pre-alpha, under active development.**

## Why

You installed `obra/superpowers`, `andrej-karpathy-skills`, and three other trending skill packs. Now your Claude Code system prompt is a 40K-token mess with overlapping skills and silent conflicts. claudoctor is the lint tool for that.

## Install (coming soon)

```bash
npx claudoctor skills
```

## Roadmap

- **v0.1** — `claudoctor skills`: static analysis, token sorting, duplicate detection, `--deep` mode via local `claude` CLI
- **v0.2** — `claudoctor runtime`: detect RTK install, check hook completeness
- **v0.3** — Unified dashboard combining system prompt + runtime IO health

## License

MIT
