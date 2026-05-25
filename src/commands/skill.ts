import { createInterface } from 'node:readline/promises';
import type { Command } from 'commander';
import { installSkillPack, listSkillPacks, previewSkillPackInstall, removeSkillPack } from '../lib/skillpacks/install.js';

export function registerSkillCommand(program: Command): void {
  const skill = program.command('skill').description('Install, list, and remove remote skill packs.');

  skill
    .command('add')
    .argument('<source>', 'git+ URL, gh:owner/repo[/path][#ref], or registry pack name')
    .option('-y, --yes', 'Skip confirmation prompt')
    .option('-f, --force', 'Overwrite an installed pack with the same name')
    .action(async (source: string, opts: { yes?: boolean; force?: boolean }) => {
      try {
        const confirmed = opts.yes ? true : await confirmInstall(source);
        if (!confirmed) {
          process.stdout.write('Aborted.\n');
          return;
        }
        const installed = await installSkillPack({ source, yes: true, force: !!opts.force });
        process.stdout.write(`Installed ${installed.name} from ${installed.source}\n`);
      } catch (err) {
        reportError(err);
      }
    });

  skill
    .command('list')
    .description('List locally installed skill packs')
    .action(async () => {
      try {
        const packs = await listSkillPacks();
        if (packs.length === 0) {
          process.stdout.write('No skill packs installed.\n');
          return;
        }
        for (const pack of packs) {
          process.stdout.write(`${pack.name}\t${pack.path}\n`);
        }
      } catch (err) {
        reportError(err);
      }
    });

  skill
    .command('remove')
    .argument('<pack-name>', 'Installed pack name')
    .description('Remove an installed skill pack')
    .action(async (name: string) => {
      try {
        await removeSkillPack(name);
        process.stdout.write(`Removed ${name}\n`);
      } catch (err) {
        reportError(err);
      }
    });
}

async function confirmInstall(source: string): Promise<boolean> {
  const preview = await previewSkillPackInstall(source);
  process.stdout.write(`Source: ${preview.source}\nInstall directory: ~/.claudoctor/skills/${preview.name}\n`);
  if (!process.stdin.isTTY) {
    throw new Error('Install confirmation requires an interactive terminal. Pass --yes to continue.');
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question('Install this skill pack? [y/N] ');
    return answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes';
  } finally {
    rl.close();
  }
}

function reportError(err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`claudoctor: ${msg}\n`);
  process.exit(1);
}
