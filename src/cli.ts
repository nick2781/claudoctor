import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { runSkills } from './commands/skills.js';
import { runClaudemd } from './commands/claudemd.js';
import { runDedup } from './commands/dedup.js';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(here, '../package.json'), 'utf8')) as { version: string };

const program = new Command();

program
  .name('claudoctor')
  .description('Audit and clean up your Claude Code / Cursor skills and CLAUDE.md.')
  .version(pkg.version);

program
  .command('skills')
  .description('Audit local skills: duplicates, conflicts, overlap, token usage.')
  .option('--json', 'Output as JSON for piping')
  .option('--deep', 'Use local claude CLI for semantic conflict detection (v0.2)')
  .option('--fix', 'Plan and apply duplicate cleanup fixes')
  .option('--yes', 'Apply exact duplicate fixes without prompting (with --fix)')
  .option('--source <list>', 'Comma list of agents: claude,codex,cursor,hermes,project')
  .option('--exclude <list>', 'Exclude file globs (e.g. **/openclaw-imports/**,**/node_modules/**)')
  .option('--top <n>', 'Top N skills in token rank', '20')
  .option('--threshold <n>', 'Overlap similarity threshold 0..1', '0.5')
  .action(async (opts) => {
    try {
      await runSkills(opts);
    } catch (err) {
      const msg = err instanceof Error ? err.stack ?? err.message : String(err);
      process.stderr.write(`claudoctor: ${msg}\n`);
      process.exit(1);
    }
  });

program
  .command('dedup')
  .description('Auto-fix exact duplicates and interactively merge near-duplicates.')
  .option('--json', 'Output the dedup plan as JSON')
  .option('--yes', 'Apply exact duplicate fixes without prompting')
  .option('--source <list>', 'Comma list of agents: claude,codex,cursor,hermes,project')
  .option('--exclude <list>', 'Exclude file globs (e.g. **/openclaw-imports/**,**/node_modules/**)')
  .option('--threshold <n>', 'Near-duplicate similarity threshold 0..1', '0.9')
  .option('--claudemd <list>', 'Comma list of CLAUDE.md files to deduplicate')
  .option('--skip-claudemd', 'Skip CLAUDE.md paragraph deduplication')
  .action(async (opts) => {
    try {
      await runDedup(opts);
    } catch (err) {
      const msg = err instanceof Error ? err.stack ?? err.message : String(err);
      process.stderr.write(`claudoctor: ${msg}\n`);
      process.exit(1);
    }
  });

program
  .command('claudemd')
  .description('Audit a CLAUDE.md: best-practice gaps, verbose / vague / counterproductive rules.')
  .argument('[path]', 'Path to CLAUDE.md (defaults to ./CLAUDE.md then ~/.claude/CLAUDE.md)')
  .option('--json', 'Output as JSON for piping')
  .option('--md', 'Output as Markdown (default)')
  .option('--text', 'Output as colored terminal text')
  .option('--llm', 'Cross-check with Claude API (requires ANTHROPIC_API_KEY)')
  .option('--no-llm', 'Skip the LLM cross-check even if ANTHROPIC_API_KEY is set')
  .option('--model <id>', 'Anthropic model id for --llm', 'claude-haiku-4-5-20251001')
  .option('--output <file>', 'Write report to file instead of stdout')
  .action(async (path, opts) => {
    try {
      await runClaudemd(path, opts);
    } catch (err) {
      const msg = err instanceof Error ? err.stack ?? err.message : String(err);
      process.stderr.write(`claudoctor: ${msg}\n`);
      process.exit(1);
    }
  });

program.parseAsync();
