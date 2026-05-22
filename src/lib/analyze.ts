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

export interface NearDuplicateGroup {
  kind: 'near-duplicate';
  name: string;
  bodyHash: string;
  tokens: number;
  variants: Skill[];
  wastedTokens: number;
}

export interface OverlapPair {
  kind: 'overlap';
  a: Skill;
  b: Skill;
  descSimilarity: number;
  bodySimilarity?: number;
  similarity: number;
  smallerTokens: number;
}

export interface Analysis {
  skills: Skill[];
  totalTokens: number;
  totalSkills: number;
  byAgent: Record<string, { count: number; tokens: number }>;
  duplicates: DuplicateGroup[];
  nearDuplicates: NearDuplicateGroup[];
  conflicts: ConflictGroup[];
  overlaps: OverlapPair[];
  overlapsTotal: number;
  savings: {
    duplicateTokens: number;
    nearDuplicateTokens: number;
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
  deep?: boolean;
}

export function analyze(skills: Skill[], opts: AnalyzeOptions = {}): Analysis {
  const overlapThreshold = opts.overlapThreshold ?? 0.5;
  const overlapMaxPairs = opts.overlapMaxPairs ?? 50;
  const deep = opts.deep ?? false;

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

  const byBodyHash = new Map<string, Skill[]>();
  for (const s of skills) {
    const arr = byBodyHash.get(s.bodyHash) ?? [];
    arr.push(s);
    byBodyHash.set(s.bodyHash, arr);
  }
  const nearDuplicates: NearDuplicateGroup[] = [];
  for (const [bodyHash, variants] of byBodyHash) {
    if (variants.length < 2) continue;
    const contentHashes = new Set(variants.map((v) => v.contentHash));
    if (contentHashes.size < 2) continue;
    const tokens = variants[0]!.tokens;
    nearDuplicates.push({
      kind: 'near-duplicate',
      name: variants[0]!.name,
      bodyHash,
      tokens,
      variants,
      wastedTokens: tokens * (variants.length - 1),
    });
  }
  nearDuplicates.sort((a, b) => b.wastedTokens - a.wastedTokens);

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
    const bodyHashes = new Set(variants.map((v) => v.bodyHash));
    if (bodyHashes.size < 2) continue;
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
  if (deep && uniqueByName.length > 500) {
    process.stderr.write(`[claudoctor] --deep: tokenizing ${uniqueByName.length} skills, this may take a few seconds.\n`);
  }
  const sigs = uniqueByName.map((s) => ({
    skill: s,
    descSig: tokenize(`${s.name} ${s.description}`),
    bodySig: deep ? tokenize(s.body) : undefined,
  }));
  const overlaps: OverlapPair[] = [];
  for (let i = 0; i < sigs.length; i++) {
    for (let j = i + 1; j < sigs.length; j++) {
      const A = sigs[i]!;
      const B = sigs[j]!;
      if (!deep && (A.descSig.size < 2 || B.descSig.size < 2)) continue;
      const descSimilarity = Number(jaccard(A.descSig, B.descSig).toFixed(3));
      const bodySimilarity = deep && A.bodySig && B.bodySig
        ? Number(jaccard(A.bodySig, B.bodySig).toFixed(3))
        : undefined;
      const similarity = bodySimilarity === undefined
        ? descSimilarity
        : Math.max(descSimilarity, bodySimilarity);
      if (similarity >= overlapThreshold) {
        overlaps.push({
          kind: 'overlap',
          a: A.skill,
          b: B.skill,
          descSimilarity,
          ...(bodySimilarity === undefined ? {} : { bodySimilarity }),
          similarity,
          smallerTokens: Math.min(A.skill.tokens, B.skill.tokens),
        });
      }
    }
  }
  overlaps.sort((a, b) => b.similarity - a.similarity || b.smallerTokens - a.smallerTokens);
  const overlapsTrimmed = overlaps.slice(0, overlapMaxPairs);

  const duplicateTokens = duplicates.reduce((n, g) => n + g.wastedTokens, 0);
  const counted = new Set<string>(dupedFiles);
  let nearDuplicateTokens = 0;
  for (const g of nearDuplicates) {
    let countedInGroup = 0;
    for (const variant of g.variants) {
      if (counted.has(variant.file)) continue;
      counted.add(variant.file);
      countedInGroup++;
      if (countedInGroup > 1) nearDuplicateTokens += g.tokens;
    }
  }
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
    nearDuplicates,
    conflicts,
    overlaps: overlapsTrimmed,
    overlapsTotal: overlaps.length,
    savings: {
      duplicateTokens,
      nearDuplicateTokens,
      overlapTokens,
      totalEstimated: duplicateTokens + nearDuplicateTokens + overlapTokens,
    },
  };
}
