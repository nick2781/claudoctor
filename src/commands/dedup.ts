import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { defaultSources, filterSources } from '../lib/sources.js';
import { discover } from '../lib/discover.js';
import {
  applyExactFixes,
  applyNearDuplicateDecisions,
  createDedupPlan,
  type DedupPlan,
  type NearDuplicateDecision,
  type NearDuplicatePair,
} from '../lib/dedup.js';

export interface DedupOptions {
  json?: boolean;
  yes?: boolean;
  source?: string;
  exclude?: string;
  threshold?: string;
  claudemd?: string;
  skipClaudemd?: boolean;
}

function splitList(value: string | undefined): string[] | undefined {
  const parsed = value?.split(',').map((item) => item.trim()).filter(Boolean);
  return parsed && parsed.length > 0 ? parsed : undefined;
}

function defaultClaudeMdFiles(): string[] {
  const candidates = [
    resolve(process.cwd(), 'CLAUDE.md'),
    resolve(homedir(), '.claude', 'CLAUDE.md'),
  ];
  return candidates.filter((file) => existsSync(file));
}

function resolveClaudeMdFiles(opts: DedupOptions): string[] {
  if (opts.skipClaudemd) return [];
  const explicit = splitList(opts.claudemd);
  return explicit ? explicit.map((file) => resolve(file)) : defaultClaudeMdFiles();
}

function thresholdFrom(opts: DedupOptions): number {
  if (!opts.threshold) return 0.9;
  const parsed = Number.parseFloat(opts.threshold);
  if (!Number.isFinite(parsed)) return 0.9;
  return Math.min(1, Math.max(0, parsed));
}

function summarizePlan(plan: DedupPlan): object {
  return {
    exact: {
      skillDeletes: plan.skillDeletes.map((action) => ({
        target: action.target.file,
        keeper: action.keeper.file,
        reason: action.reason,
      })),
      paragraphDeletes: plan.paragraphDeletes.map((action) => ({
        target: `${action.target.file}:${action.target.startLine}`,
        keeper: `${action.keeper.file}:${action.keeper.startLine}`,
        reason: action.reason,
      })),
    },
    nearDuplicates: plan.nearDuplicatePairs.map((pair) => ({
      a: pair.a.file,
      b: pair.b.file,
      similarity: pair.similarity,
      reason: pair.reason,
    })),
  };
}

function renderNearDiff(pair: NearDuplicatePair): string {
  const aLines = pair.a.raw.split(/\r?\n/);
  const bLines = pair.b.raw.split(/\r?\n/);
  const max = Math.max(aLines.length, bLines.length);
  const lines = [
    `A: ${pair.a.file}`,
    `B: ${pair.b.file}`,
    `Reason: ${pair.reason}`,
    '--- A',
    '+++ B',
  ];
  for (let i = 0; i < max; i++) {
    const a = aLines[i];
    const b = bLines[i];
    if (a === b) {
      if (a !== undefined) lines.push(` ${a}`);
      continue;
    }
    if (a !== undefined) lines.push(`-${a}`);
    if (b !== undefined) lines.push(`+${b}`);
  }
  return lines.join('\n');
}

async function confirmApply(): Promise<boolean> {
  if (!input.isTTY || !output.isTTY) return false;
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question('Apply exact duplicate fixes? [y/N] ');
    return answer.trim().toLowerCase() === 'y';
  } finally {
    rl.close();
  }
}

async function promptNearDecision(pair: NearDuplicatePair): Promise<NearDuplicateDecision> {
  output.write(`\n${renderNearDiff(pair)}\n`);
  if (!input.isTTY || !output.isTTY) return 'skip';
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question('[k]eep both / merge into [a] / merge into [b] / [s]kip: ');
    const normalized = answer.trim().toLowerCase();
    if (normalized === 'k') return 'keep-both';
    if (normalized === 'a') return 'merge-into-a';
    if (normalized === 'b') return 'merge-into-b';
    return 'skip';
  } finally {
    rl.close();
  }
}

export async function runDedup(opts: DedupOptions): Promise<void> {
  const wanted = splitList(opts.source);
  const exclude = splitList(opts.exclude);
  const sources = filterSources(defaultSources(), wanted);
  const skills = await discover(sources, { exclude });
  const plan = await createDedupPlan({
    skills,
    claudeMdFiles: resolveClaudeMdFiles(opts),
    threshold: thresholdFrom(opts),
  });

  const exactCount = plan.skillDeletes.length + plan.paragraphDeletes.length;
  if (opts.json) {
    process.stdout.write(JSON.stringify(summarizePlan(plan), null, 2) + '\n');
    return;
  }

  process.stdout.write('claudoctor dedup\n');
  if (exactCount === 0) {
    process.stdout.write('No exact duplicate fixes available.\n');
  } else {
    process.stdout.write(
      `Exact duplicate fixes available: ${plan.skillDeletes.length} skill files, ${plan.paragraphDeletes.length} CLAUDE.md paragraphs.\n`,
    );
    process.stdout.write('\nDry-run diff (not applied yet):\n');
    process.stdout.write(plan.dryRunDiff + '\n');
  }

  if (exactCount > 0) {
    const apply = opts.yes === true || (await confirmApply());
    if (apply) {
      const result = await applyExactFixes(plan);
      process.stdout.write(
        `Applied exact fixes: ${result.deletedSkills} skill files deleted, ${result.removedParagraphs} CLAUDE.md paragraphs removed.\n`,
      );
    } else {
      process.stdout.write('Exact fixes not applied. Re-run with --yes to apply non-interactively.\n');
    }
  }

  if (plan.nearDuplicatePairs.length === 0) {
    process.stdout.write('No near-duplicates above threshold.\n');
    return;
  }

  process.stdout.write(`Near-duplicates above threshold: ${plan.nearDuplicatePairs.length}.\n`);
  if (!input.isTTY || !output.isTTY) {
    process.stdout.write('Near-duplicate merge prompt requires an interactive terminal; skipped.\n');
    return;
  }

  const result = await applyNearDuplicateDecisions(plan, { decide: promptNearDecision });
  process.stdout.write(
    `Near-duplicate decisions: ${result.merged} merged, ${result.kept} kept, ${result.skipped} skipped.\n`,
  );
}
