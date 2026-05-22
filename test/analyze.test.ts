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
});
