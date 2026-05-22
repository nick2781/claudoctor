import { Command } from 'commander';
import chalk from 'chalk';

const program = new Command();

program
  .name('claudoctor')
  .description('Audit and clean up your Claude Code / Cursor skills.')
  .version('0.0.1');

program
  .command('skills')
  .description('Audit local skills: duplicates, conflicts, token usage.')
  .option('--deep', 'Use local claude CLI for semantic conflict detection')
  .option('--json', 'Output as JSON')
  .action((opts) => {
    console.log(chalk.cyan('claudoctor skills'), chalk.dim('(stub)'), opts);
  });

program.parse();
