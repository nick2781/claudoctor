import { describe, it, expect, afterAll } from 'vitest';
import { discover } from '../src/lib/discover.js';
import { makeFixtures } from './fixtures/make.js';

const fx = await makeFixtures([
  {
    rel: 'claude/skills/foo/SKILL.md',
    frontmatter: { name: 'foo', description: 'Foo skill: does foo things.' },
    body: 'Body for foo.',
  },
  {
    rel: 'codex/skills/foo/SKILL.md',
    frontmatter: { name: 'foo', description: 'Foo skill: does foo things.' },
    body: 'Body for foo.',
  },
  {
    rel: 'hermes/skills/bar/SKILL.md',
    frontmatter: { name: 'bar', description: 'Bar skill.' },
    body: 'Body for bar bar bar.',
  },
]);
afterAll(() => fx.cleanup());

describe('discover', () => {
  it('finds skills across agents and parses frontmatter', async () => {
    const skills = await discover(fx.sources);
    expect(skills).toHaveLength(3);
    const names = skills.map((s) => s.name).sort();
    expect(names).toEqual(['bar', 'foo', 'foo']);
    const foo = skills.filter((s) => s.name === 'foo');
    expect(foo[0]!.description).toMatch(/Foo skill/);
    expect(foo[0]!.tokens).toBeGreaterThan(0);
  });

  it('hashes identical content to same hash', async () => {
    const skills = await discover(fx.sources);
    const foos = skills.filter((s) => s.name === 'foo');
    expect(foos[0]!.contentHash).toBe(foos[1]!.contentHash);
  });
});
