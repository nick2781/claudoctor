import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { SourceRoot } from '../../src/lib/sources.js';

export interface FixtureSpec {
  rel: string;
  frontmatter: Record<string, string>;
  body: string;
}

export async function makeFixtures(specs: FixtureSpec[]): Promise<{
  root: string;
  sources: SourceRoot[];
  cleanup: () => Promise<void>;
}> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'claudoctor-'));
  for (const s of specs) {
    const dest = path.join(root, s.rel);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    const fm = Object.entries(s.frontmatter)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join('\n');
    await fs.writeFile(dest, `---\n${fm}\n---\n\n${s.body}\n`);
  }
  const sources: SourceRoot[] = [
    {
      agent: 'claude',
      label: 'test/claude',
      root,
      patterns: ['claude/**/SKILL.md'],
    },
    {
      agent: 'codex',
      label: 'test/codex',
      root,
      patterns: ['codex/**/SKILL.md'],
    },
    {
      agent: 'hermes',
      label: 'test/hermes',
      root,
      patterns: ['hermes/**/SKILL.md'],
    },
  ];
  return { root, sources, cleanup: () => fs.rm(root, { recursive: true, force: true }) };
}
