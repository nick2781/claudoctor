import type { Skill } from './discover.js';

export interface DuplicateGroup {
  kind: 'duplicate';
  name: string;
  contentHash: string;
  tokens: number;
  copies: Skill[];
  wastedTokens: number;
}

export interface ConflictGroup {
  kind: 'conflict';
  name: string;
  variants: Skill[];
  tokens: number;
}

export interface OverlapPair {
  kind: 'overlap';
  a: Skill;
  b: Skill;
  similarity: number;
  smallerTokens: number;
}

export interface Analysis {
  skills: Skill[];
  totalTokens: number;
  totalSkills: number;
  byAgent: Record<string, { count: number; tokens: number }>;
  duplicates: DuplicateGroup[];
  conflicts: ConflictGroup[];
  overlaps: OverlapPair[];
  overlapsTotal: number;
  savings: {
    duplicateTokens: number;
    overlapTokens: number;
    totalEstimated: number;
  };
}

const STOPWORDS = new Set([
  'a','an','and','or','the','to','of','in','on','for','with','by','is','are','be','this','that','it','at','as','from','use','using','your','you','can','will',
  '一个','和','或','的','是','在','与','为','你','我','它','这','那','可以','使用','用于','支持','以及','并且','以便',
]);

function tokenize(s: string): Set<string> {
  const lowered = s.toLowerCase();
  const split = lowered
    .replace(/[`*_>#\[\]()<>{}|=\\/'":;,.!?\-—–\n\r\t]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w));
  return new Set(split);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export interface AnalyzeOptions {
  overlapThreshold?: number;
  overlapMaxPairs?: number;
}

export function analyze(skills: Skill[], opts: AnalyzeOptions = {}): Analysis {
  const overlapThreshold = opts.overlapThreshold ?? 0.5;
  const overlapMaxPairs = opts.overlapMaxPairs ?? 50;

  const totalTokens = skills.reduce((n, s) => n + s.tokens, 0);
  const byAgent: Record<string, { count: number; tokens: number }> = {};
  for (const s of skills) {
    const slot = (byAgent[s.agent] ??= { count: 0, tokens: 0 });
    slot.count++;
    slot.tokens += s.tokens;
  }

  const byHash = new Map<string, Skill[]>();
  for (const s of skills) {
    const arr = byHash.get(s.contentHash) ?? [];
    arr.push(s);
    byHash.set(s.contentHash, arr);
  }
  const duplicates: DuplicateGroup[] = [];
  for (const [hash, copies] of byHash) {
    if (copies.length < 2) continue;
    const tokens = copies[0]!.tokens;
    duplicates.push({
      kind: 'duplicate',
      name: copies[0]!.name,
      contentHash: hash,
      tokens,
      copies,
      wastedTokens: tokens * (copies.length - 1),
    });
  }
  duplicates.sort((a, b) => b.wastedTokens - a.wastedTokens);

  const dupedFiles = new Set<string>();
  for (const g of duplicates) for (const c of g.copies) dupedFiles.add(c.file);

  const byName = new Map<string, Skill[]>();
  for (const s of skills) {
    const arr = byName.get(s.name) ?? [];
    arr.push(s);
    byName.set(s.name, arr);
  }
  const conflicts: ConflictGroup[] = [];
  for (const [name, variants] of byName) {
    if (variants.length < 2) continue;
    const hashes = new Set(variants.map((v) => v.contentHash));
    if (hashes.size < 2) continue;
    conflicts.push({
      kind: 'conflict',
      name,
      variants,
      tokens: variants.reduce((n, v) => n + v.tokens, 0),
    });
  }
  conflicts.sort((a, b) => b.tokens - a.tokens);

  const byNameDedup = new Map<string, Skill>();
  for (const s of skills) {
    const prev = byNameDedup.get(s.name);
    if (!prev || s.tokens > prev.tokens) byNameDedup.set(s.name, s);
  }
  const uniqueByName = [...byNameDedup.values()];
  const sigs = uniqueByName.map((s) => ({
    skill: s,
    sig: tokenize(`${s.name} ${s.description}`),
  }));
  const overlaps: OverlapPair[] = [];
  for (let i = 0; i < sigs.length; i++) {
    for (let j = i + 1; j < sigs.length; j++) {
      const A = sigs[i]!;
      const B = sigs[j]!;
      if (A.sig.size < 2 || B.sig.size < 2) continue;
      const sim = jaccard(A.sig, B.sig);
      if (sim >= overlapThreshold) {
        overlaps.push({
          kind: 'overlap',
          a: A.skill,
          b: B.skill,
          similarity: Number(sim.toFixed(3)),
          smallerTokens: Math.min(A.skill.tokens, B.skill.tokens),
        });
      }
    }
  }
  overlaps.sort((a, b) => b.similarity - a.similarity || b.smallerTokens - a.smallerTokens);
  const overlapsTrimmed = overlaps.slice(0, overlapMaxPairs);

  const duplicateTokens = duplicates.reduce((n, g) => n + g.wastedTokens, 0);
  const counted = new Set<string>(dupedFiles);
  let overlapTokens = 0;
  for (const o of overlapsTrimmed) {
    const target = o.a.tokens <= o.b.tokens ? o.a : o.b;
    if (counted.has(target.file)) continue;
    counted.add(target.file);
    overlapTokens += target.tokens;
  }

  return {
    skills,
    totalTokens,
    totalSkills: skills.length,
    byAgent,
    duplicates,
    conflicts,
    overlaps: overlapsTrimmed,
    overlapsTotal: overlaps.length,
    savings: {
      duplicateTokens,
      overlapTokens,
      totalEstimated: duplicateTokens + overlapTokens,
    },
  };
}
