import fs from 'node:fs/promises';
import path from 'node:path';
import { analyze } from './analyze.js';
import type { Skill } from './discover.js';

export type NearDuplicateDecision = 'keep-both' | 'merge-into-a' | 'merge-into-b' | 'skip';

export interface SkillDeleteAction {
  kind: 'skill-delete';
  keeper: Skill;
  target: Skill;
  reason: string;
}

export interface ClaudeMdParagraph {
  file: string;
  startLine: number;
  endLine: number;
  text: string;
  normalized: string;
}

export interface ParagraphDeleteAction {
  kind: 'claudemd-paragraph-delete';
  keeper: ClaudeMdParagraph;
  target: ClaudeMdParagraph;
  reason: string;
}

export interface NearDuplicatePair {
  kind: 'near-duplicate-pair';
  a: Skill;
  b: Skill;
  similarity: number;
  reason: string;
}

export interface DedupPlan {
  skillDeletes: SkillDeleteAction[];
  paragraphDeletes: ParagraphDeleteAction[];
  nearDuplicatePairs: NearDuplicatePair[];
  dryRunDiff: string;
}

export interface CreateDedupPlanOptions {
  skills: Skill[];
  claudeMdFiles?: string[];
  threshold?: number;
}

export interface ApplyExactResult {
  deletedSkills: number;
  removedParagraphs: number;
  traces: string[];
}

export interface ApplyNearDuplicateResult {
  merged: number;
  kept: number;
  skipped: number;
  traces: string[];
}

export interface NearDuplicateDecisionOptions {
  decide: (pair: NearDuplicatePair) => Promise<NearDuplicateDecision>;
}

function depthOf(p: string): number {
  return p.split(path.sep).filter(Boolean).length;
}

function skillPriority(a: Skill, b: Skill, sourceFrequency: Map<string, number>): number {
  const freq = (sourceFrequency.get(b.sourceLabel) ?? 0) - (sourceFrequency.get(a.sourceLabel) ?? 0);
  if (freq !== 0) return freq;
  const depth = depthOf(a.relPath) - depthOf(b.relPath);
  if (depth !== 0) return depth;
  return a.file.localeCompare(b.file);
}

function chooseSkillKeeper(skills: Skill[], allSkills: Skill[]): Skill {
  const sourceFrequency = new Map<string, number>();
  for (const skill of allSkills) {
    sourceFrequency.set(skill.sourceLabel, (sourceFrequency.get(skill.sourceLabel) ?? 0) + 1);
  }
  return [...skills].sort((a, b) => skillPriority(a, b, sourceFrequency))[0]!;
}

function normalizeParagraph(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function shouldConsiderParagraph(text: string): boolean {
  const normalized = normalizeParagraph(text);
  if (normalized.length < 40) return false;
  if (/^(#{1,6}\s|---(?:\s|$)|```|~~~)/.test(normalized)) return false;
  return true;
}

async function readClaudeMdParagraphs(files: string[]): Promise<ClaudeMdParagraph[]> {
  const paragraphs: ClaudeMdParagraph[] = [];
  for (const file of files) {
    let raw: string;
    try {
      raw = await fs.readFile(file, 'utf8');
    } catch {
      continue;
    }

    const lines = raw.split(/\r?\n/);
    let start: number | undefined;
    for (let i = 0; i <= lines.length; i++) {
      const line = lines[i];
      const isBoundary = line === undefined || line.trim() === '';
      if (!isBoundary && start === undefined) start = i;
      if (!isBoundary || start === undefined) continue;

      const end = i - 1;
      const text = lines.slice(start, end + 1).join('\n');
      if (shouldConsiderParagraph(text)) {
        paragraphs.push({
          file,
          startLine: start + 1,
          endLine: end + 1,
          text,
          normalized: normalizeParagraph(text),
        });
      }
      start = undefined;
    }
  }
  return paragraphs;
}

function paragraphPriority(a: ClaudeMdParagraph, b: ClaudeMdParagraph): number {
  const depth = depthOf(a.file) - depthOf(b.file);
  if (depth !== 0) return depth;
  const file = a.file.localeCompare(b.file);
  if (file !== 0) return file;
  return a.startLine - b.startLine;
}

function pairKey(a: Skill, b: Skill): string {
  return [a.file, b.file].sort().join('\0');
}

function linePreview(text: string): string {
  return normalizeParagraph(text).slice(0, 100);
}

function renderDeletedFile(action: SkillDeleteAction): string {
  const lines = action.target.raw.split(/\r?\n/);
  return [
    `--- ${action.target.file}`,
    '+++ /dev/null',
    `@@ deleted duplicate skill; kept ${action.keeper.file} @@`,
    ...lines.filter((line, index) => index < lines.length - 1 || line !== '').map((line) => `-${line}`),
  ].join('\n');
}

function renderDeletedParagraph(action: ParagraphDeleteAction): string {
  return [
    `--- ${action.target.file}`,
    `+++ ${action.target.file}`,
    `@@ remove duplicate CLAUDE.md paragraph; kept ${action.keeper.file}:${action.keeper.startLine} @@`,
    ...action.target.text.split(/\r?\n/).map((line) => `-${line}`),
  ].join('\n');
}

function buildDryRunDiff(skillDeletes: SkillDeleteAction[], paragraphDeletes: ParagraphDeleteAction[]): string {
  const chunks = [
    ...skillDeletes.map(renderDeletedFile),
    ...paragraphDeletes.map(renderDeletedParagraph),
  ];
  return chunks.join('\n\n');
}

export async function createDedupPlan(opts: CreateDedupPlanOptions): Promise<DedupPlan> {
  const threshold = opts.threshold ?? 0.9;
  const analysis = analyze(opts.skills, {
    deep: true,
    overlapThreshold: threshold,
    overlapMaxPairs: Number.MAX_SAFE_INTEGER,
  });

  const skillDeletes: SkillDeleteAction[] = [];
  for (const duplicate of analysis.duplicates) {
    const keeper = chooseSkillKeeper(duplicate.copies, opts.skills);
    for (const target of duplicate.copies) {
      if (target.file === keeper.file) continue;
      skillDeletes.push({
        kind: 'skill-delete',
        keeper,
        target,
        reason: `exact duplicate of ${keeper.file}`,
      });
    }
  }

  const paragraphs = await readClaudeMdParagraphs(opts.claudeMdFiles ?? []);
  const paragraphDeletes: ParagraphDeleteAction[] = [];
  const byParagraph = new Map<string, ClaudeMdParagraph[]>();
  for (const paragraph of paragraphs) {
    const list = byParagraph.get(paragraph.normalized) ?? [];
    list.push(paragraph);
    byParagraph.set(paragraph.normalized, list);
  }
  for (const group of byParagraph.values()) {
    if (group.length < 2) continue;
    const keeper = [...group].sort(paragraphPriority)[0]!;
    for (const target of group) {
      if (target === keeper) continue;
      paragraphDeletes.push({
        kind: 'claudemd-paragraph-delete',
        keeper,
        target,
        reason: `duplicate CLAUDE.md paragraph: ${linePreview(target.text)}`,
      });
    }
  }

  const nearDuplicatePairs: NearDuplicatePair[] = [];
  const seenPairs = new Set<string>();
  for (const group of analysis.nearDuplicates) {
    const keeper = chooseSkillKeeper(group.variants, opts.skills);
    for (const target of group.variants) {
      if (target.file === keeper.file) continue;
      seenPairs.add(pairKey(keeper, target));
      nearDuplicatePairs.push({
        kind: 'near-duplicate-pair',
        a: keeper,
        b: target,
        similarity: 1,
        reason: 'same body, different frontmatter',
      });
    }
  }
  for (const overlap of analysis.overlaps) {
    if (overlap.a.contentHash === overlap.b.contentHash) continue;
    const key = pairKey(overlap.a, overlap.b);
    if (seenPairs.has(key)) continue;
    seenPairs.add(key);
    nearDuplicatePairs.push({
      kind: 'near-duplicate-pair',
      a: overlap.a,
      b: overlap.b,
      similarity: overlap.similarity,
      reason: `similarity ${overlap.similarity.toFixed(2)} >= ${threshold}`,
    });
  }

  return {
    skillDeletes,
    paragraphDeletes,
    nearDuplicatePairs,
    dryRunDiff: buildDryRunDiff(skillDeletes, paragraphDeletes),
  };
}

export async function applyExactFixes(plan: DedupPlan): Promise<ApplyExactResult> {
  const traces: string[] = [];
  for (const action of plan.skillDeletes) {
    await fs.rm(action.target.file, { force: true });
    traces.push(`deleted duplicate skill ${action.target.file}; kept ${action.keeper.file}`);
  }

  const byFile = new Map<string, ParagraphDeleteAction[]>();
  for (const action of plan.paragraphDeletes) {
    const actions = byFile.get(action.target.file) ?? [];
    actions.push(action);
    byFile.set(action.target.file, actions);
  }
  for (const [file, actions] of byFile) {
    const raw = await fs.readFile(file, 'utf8');
    const lines = raw.split(/\r?\n/);
    for (const action of [...actions].sort((a, b) => b.target.startLine - a.target.startLine)) {
      let removeEnd = action.target.endLine;
      if (removeEnd < lines.length && lines[removeEnd]?.trim() === '') removeEnd++;
      lines.splice(action.target.startLine - 1, removeEnd - action.target.startLine + 1);
      traces.push(`removed duplicate CLAUDE.md paragraph ${file}:${action.target.startLine}`);
    }
    await fs.writeFile(file, lines.join('\n'), 'utf8');
  }

  return {
    deletedSkills: plan.skillDeletes.length,
    removedParagraphs: plan.paragraphDeletes.length,
    traces,
  };
}

function mergedRaw(winner: Skill, loser: Skill): string {
  if (winner.body.trim() === loser.body.trim()) return winner.raw;
  const base = winner.raw.endsWith('\n') ? winner.raw : `${winner.raw}\n`;
  return `${base}\n## Merged from ${loser.relPath}\n\n${loser.body.trim()}\n`;
}

export async function applyNearDuplicateDecisions(
  plan: DedupPlan,
  opts: NearDuplicateDecisionOptions,
): Promise<ApplyNearDuplicateResult> {
  let merged = 0;
  let kept = 0;
  let skipped = 0;
  const traces: string[] = [];

  for (const pair of plan.nearDuplicatePairs) {
    const decision = await opts.decide(pair);
    if (decision === 'skip') {
      skipped++;
      traces.push(`skipped near duplicate ${pair.a.file} <-> ${pair.b.file}`);
      continue;
    }
    if (decision === 'keep-both') {
      kept++;
      traces.push(`kept both near duplicates ${pair.a.file} <-> ${pair.b.file}`);
      continue;
    }

    const winner = decision === 'merge-into-a' ? pair.a : pair.b;
    const loser = decision === 'merge-into-a' ? pair.b : pair.a;
    await fs.writeFile(winner.file, mergedRaw(winner, loser), 'utf8');
    await fs.rm(loser.file, { force: true });
    merged++;
    traces.push(`merged ${loser.file} into ${winner.file}`);
  }

  return { merged, kept, skipped, traces };
}
