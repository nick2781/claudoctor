import { describe, it, expect, afterAll } from 'vitest';
import { discover } from '../src/lib/discover.js';
import { analyze } from '../src/lib/analyze.js';
import { makeFixtures } from './fixtures/make.js';

const fx = await makeFixtures([
  {
    rel: 'claude/skills/dup/SKILL.md',
    frontmatter: { name: 'dup', description: 'Duplicate skill A.' },
    body: 'Identical body content.',
  },
  {
    rel: 'codex/skills/dup/SKILL.md',
    frontmatter: { name: 'dup', description: 'Duplicate skill A.' },
    body: 'Identical body content.',
  },
  {
    rel: 'claude/skills/cflct/SKILL.md',
    frontmatter: { name: 'cflct', description: 'Conflict variant one.' },
    body: 'Body one.',
  },
  {
    rel: 'codex/skills/cflct/SKILL.md',
    frontmatter: { name: 'cflct', description: 'Conflict variant two with different body.' },
    body: 'Body TWO entirely different.',
  },
  {
    rel: 'claude/skills/git-commit/SKILL.md',
    frontmatter: { name: 'git-commit', description: 'Commit changes with proper git commit message format.' },
    body: 'Run git commit -m message.',
  },
  {
    rel: 'codex/skills/commit-push/SKILL.md',
    frontmatter: { name: 'commit-push', description: 'Commit changes with proper git commit message format then push.' },
    body: 'Run git commit then git push.',
  },
]);
afterAll(() => fx.cleanup());

describe('analyze', () => {
  it('detects exact duplicates and counts wasted tokens', async () => {
    const skills = await discover(fx.sources);
    const a = analyze(skills, { overlapThreshold: 0.4 });
    const dup = a.duplicates.find((d) => d.name === 'dup');
    expect(dup).toBeTruthy();
    expect(dup!.copies).toHaveLength(2);
    expect(dup!.wastedTokens).toBe(dup!.tokens);
  });

  it('detects name conflicts with different content', async () => {
    const skills = await discover(fx.sources);
    const a = analyze(skills);
    const cflct = a.conflicts.find((c) => c.name === 'cflct');
    expect(cflct).toBeTruthy();
    expect(cflct!.variants).toHaveLength(2);
  });

  it('flags overlap by description similarity', async () => {
    const skills = await discover(fx.sources);
    const a = analyze(skills, { overlapThreshold: 0.4 });
    const pair = a.overlaps.find(
      (o) =>
        (o.a.name === 'git-commit' && o.b.name === 'commit-push') ||
        (o.b.name === 'git-commit' && o.a.name === 'commit-push'),
    );
    expect(pair).toBeTruthy();
    expect(pair!.similarity).toBeGreaterThan(0.4);
  });

  it('reports byAgent rollup and savings', async () => {
    const skills = await discover(fx.sources);
    const a = analyze(skills, { overlapThreshold: 0.4 });
    expect(a.byAgent.claude!.count).toBeGreaterThan(0);
    expect(a.byAgent.codex!.count).toBeGreaterThan(0);
    expect(a.savings.totalEstimated).toBeGreaterThan(0);
  });

  it('reports same-body frontmatter drift as near duplicates only', async () => {
    const nearFx = await makeFixtures([
      {
        rel: 'claude/skills/ship/SKILL.md',
        frontmatter: { name: 'ship', description: 'Ship software from Claude.' },
        body: 'Deploy the same release checklist.',
      },
      {
        rel: 'codex/skills/ship/SKILL.md',
        frontmatter: { name: 'ship', description: 'Ship software from Codex.' },
        body: 'Deploy the same release checklist.',
      },
    ]);
    try {
      const skills = await discover(nearFx.sources);
      const a = analyze(skills);
      expect(a.nearDuplicates).toHaveLength(1);
      expect(a.nearDuplicates[0]!.name).toBe('ship');
      expect(a.nearDuplicates[0]!.variants).toHaveLength(2);
      expect(a.duplicates).toHaveLength(0);
      expect(a.conflicts).toHaveLength(0);
    } finally {
      await nearFx.cleanup();
    }
  });

  it('keeps exact duplicates out of near duplicates', async () => {
    const exactFx = await makeFixtures([
      {
        rel: 'claude/skills/exact/SKILL.md',
        frontmatter: { name: 'exact', description: 'Exact duplicate skill.' },
        body: 'Exactly identical body.',
      },
      {
        rel: 'codex/skills/exact/SKILL.md',
        frontmatter: { name: 'exact', description: 'Exact duplicate skill.' },
        body: 'Exactly identical body.',
      },
    ]);
    try {
      const skills = await discover(exactFx.sources);
      const a = analyze(skills);
      expect(a.duplicates).toHaveLength(1);
      expect(a.nearDuplicates).toHaveLength(0);
    } finally {
      await exactFx.cleanup();
    }
  });

  it('uses description similarity for overlap unless deep analysis is enabled', async () => {
    const overlapFx = await makeFixtures([
      {
        rel: 'claude/skills/release-notes/SKILL.md',
        frontmatter: { name: 'release-notes', description: 'Prepare release notes changelog summary.' },
        body: 'Short release note body.',
      },
      {
        rel: 'codex/skills/changelog/SKILL.md',
        frontmatter: { name: 'changelog', description: 'Prepare release notes changelog summary for publishing.' },
        body: 'Different publish body.',
      },
      {
        rel: 'claude/skills/alpha/SKILL.md',
        frontmatter: { name: 'alpha', description: 'Alpha orchard nebula signal.' },
        body: 'Shared deployment rollback checklist validation evidence.',
      },
      {
        rel: 'codex/skills/beta/SKILL.md',
        frontmatter: { name: 'beta', description: 'Beta warehouse quantum ledger.' },
        body: 'Shared deployment rollback checklist validation evidence.',
      },
    ]);
    try {
      const skills = await discover(overlapFx.sources);
      const shallow = analyze(skills, { overlapThreshold: 0.6 });
      const descPair = shallow.overlaps.find(
        (o) =>
          (o.a.name === 'release-notes' && o.b.name === 'changelog') ||
          (o.b.name === 'release-notes' && o.a.name === 'changelog'),
      );
      const bodyPair = shallow.overlaps.find(
        (o) =>
          (o.a.name === 'alpha' && o.b.name === 'beta') ||
          (o.b.name === 'alpha' && o.a.name === 'beta'),
      );
      expect(descPair).toBeTruthy();
      expect(descPair!.descSimilarity).toBeGreaterThanOrEqual(0.6);
      expect(descPair!.bodySimilarity).toBeUndefined();
      expect(bodyPair).toBeUndefined();

      const deep = analyze(skills, { overlapThreshold: 0.6, deep: true });
      const deepBodyPair = deep.overlaps.find(
        (o) =>
          (o.a.name === 'alpha' && o.b.name === 'beta') ||
          (o.b.name === 'alpha' && o.a.name === 'beta'),
      );
      expect(deepBodyPair).toBeTruthy();
      expect(deepBodyPair!.bodySimilarity).not.toBeUndefined();
      expect(deepBodyPair!.similarity).toBe(deepBodyPair!.bodySimilarity);
    } finally {
      await overlapFx.cleanup();
    }
  });

  it('counts duplicate, near duplicate, and overlap savings without double counting', async () => {
    const savingsFx = await makeFixtures([
      {
        rel: 'claude/skills/dup/SKILL.md',
        frontmatter: { name: 'dup', description: 'Duplicate saving.' },
        body: 'Duplicate body for savings.',
      },
      {
        rel: 'codex/skills/dup/SKILL.md',
        frontmatter: { name: 'dup', description: 'Duplicate saving.' },
        body: 'Duplicate body for savings.',
      },
      {
        rel: 'claude/skills/near/SKILL.md',
        frontmatter: { name: 'near', description: 'Near duplicate saving one.' },
        body: 'Near duplicate body for savings.',
      },
      {
        rel: 'codex/skills/near/SKILL.md',
        frontmatter: { name: 'near', description: 'Near duplicate saving two.' },
        body: 'Near duplicate body for savings.',
      },
      {
        rel: 'claude/skills/overlap-a/SKILL.md',
        frontmatter: { name: 'overlap-a', description: 'Prune shared archive cleanup workflow.' },
        body: 'Overlap A body.',
      },
      {
        rel: 'codex/skills/overlap-b/SKILL.md',
        frontmatter: { name: 'overlap-b', description: 'Prune shared archive cleanup workflow.' },
        body: 'Overlap B body.',
      },
    ]);
    try {
      const skills = await discover(savingsFx.sources);
      const a = analyze(skills, { overlapThreshold: 0.6 });
      const duplicate = a.duplicates[0]!;
      const nearDuplicate = a.nearDuplicates[0]!;
      const overlap = a.overlaps.find(
        (o) =>
          (o.a.name === 'overlap-a' && o.b.name === 'overlap-b') ||
          (o.b.name === 'overlap-a' && o.a.name === 'overlap-b'),
      )!;
      expect(a.savings.duplicateTokens).toBe(duplicate.wastedTokens);
      expect(a.savings.nearDuplicateTokens).toBe(nearDuplicate.wastedTokens);
      expect(a.savings.overlapTokens).toBe(overlap.smallerTokens);
      expect(a.savings.totalEstimated).toBe(
        duplicate.wastedTokens + nearDuplicate.wastedTokens + overlap.smallerTokens,
      );
    } finally {
      await savingsFx.cleanup();
    }
  });
});
