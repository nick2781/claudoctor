import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, afterAll, vi } from 'vitest';
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

  it('excludes files matching ignore globs', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'claudoctor-discover-'));
    try {
      await fs.mkdir(path.join(root, 'keep'), { recursive: true });
      await fs.mkdir(path.join(root, 'drop'), { recursive: true });
      await fs.writeFile(
        path.join(root, 'keep', 'SKILL.md'),
        '---\nname: keep\n---\nKeep this skill.\n',
        'utf8',
      );
      await fs.writeFile(
        path.join(root, 'drop', 'SKILL.md'),
        '---\nname: drop\n---\nDrop this skill.\n',
        'utf8',
      );

      const skills = await discover(
        [{ agent: 'claude', label: 'test', root, patterns: ['**/SKILL.md'] }],
        { exclude: ['**/drop/**'] },
      );

      expect(skills.map((s) => s.name)).toEqual(['keep']);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('finds project cursor rules from default sources', async () => {
    const cwd = process.cwd();
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'claudoctor-cursor-'));
    await fs.mkdir(path.join(root, '.cursor', 'rules'), { recursive: true });
    await fs.writeFile(
      path.join(root, '.cursor', 'rules', 'team.mdc'),
      '---\nname: team-rule\n---\nUse the team rule.\n',
      'utf8',
    );

    try {
      process.chdir(root);
      vi.resetModules();
      const [{ defaultSources }, { discover: discoverWithFreshSources }] = await Promise.all([
        import('../src/lib/sources.js'),
        import('../src/lib/discover.js'),
      ]);
      const sources = defaultSources().filter((src) => src.label === 'cursor/project');

      const skills = await discoverWithFreshSources(sources);

      expect(skills.map((s) => s.name)).toEqual(['team-rule']);
    } finally {
      process.chdir(cwd);
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
