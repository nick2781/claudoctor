import { Command } from 'commander';
import { runSkills } from './commands/skills.js';

const program = new Command();

program
  .name('claudoctor')
  .description('Audit and clean up your Claude Code / Cursor skills.')
  .version('0.1.0');

program
  .command('skills')
  .description('Audit local skills: duplicates, conflicts, overlap, token usage.')
  .option('--json', 'Output as JSON for piping')
  .option('--deep', 'Use local claude CLI for semantic conflict detection (v0.2)')
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

program.parseAsync();
