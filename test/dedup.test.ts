import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { discover } from '../src/lib/discover.js';
import {
  applyExactFixes,
  applyNearDuplicateDecisions,
  createDedupPlan,
} from '../src/lib/dedup.js';
import { makeFixtures } from './fixtures/make.js';

describe('dedup', () => {
  it('plans and applies exact duplicate skill deletion while keeping the shallowest copy', async () => {
    const fx = await makeFixtures([
      {
        rel: 'claude/skills/dup/SKILL.md',
        frontmatter: { name: 'dup', description: 'Duplicate skill.' },
        body: 'Exact duplicate body.',
      },
      {
        rel: 'codex/skills/dup/SKILL.md',
        frontmatter: { name: 'dup', description: 'Duplicate skill.' },
        body: 'Exact duplicate body.',
      },
    ]);
    try {
      const skills = await discover(fx.sources);
      const plan = await createDedupPlan({ skills, claudeMdFiles: [] });

      expect(plan.skillDeletes).toHaveLength(1);
      expect(plan.skillDeletes[0]!.keeper.relPath).toBe('claude/skills/dup/SKILL.md');
      expect(plan.skillDeletes[0]!.target.relPath).toBe('codex/skills/dup/SKILL.md');
      expect(plan.dryRunDiff).toContain('deleted duplicate skill');

      const result = await applyExactFixes(plan);

      expect(result.deletedSkills).toBe(1);
      await expect(fs.stat(path.join(fx.root, 'codex/skills/dup/SKILL.md'))).rejects.toMatchObject({
        code: 'ENOENT',
      });
      await expect(fs.stat(path.join(fx.root, 'claude/skills/dup/SKILL.md'))).resolves.toBeTruthy();
    } finally {
      await fx.cleanup();
    }
  });

  it('removes duplicate CLAUDE.md paragraphs and leaves one canonical paragraph', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'claudoctor-dedup-claudemd-'));
    const first = path.join(root, 'CLAUDE.md');
    const second = path.join(root, 'nested', 'CLAUDE.md');
    const duplicate =
      'Always keep implementation notes concise, specific, and tied to the code being changed.';
    await fs.mkdir(path.dirname(second), { recursive: true });
    await fs.writeFile(first, `# Root\n\n${duplicate}\n\nUnique root paragraph.\n`, 'utf8');
    await fs.writeFile(second, `# Nested\n\n${duplicate}\n\nUnique nested paragraph.\n`, 'utf8');

    try {
      const plan = await createDedupPlan({ skills: [], claudeMdFiles: [first, second] });

      expect(plan.paragraphDeletes).toHaveLength(1);
      expect(plan.paragraphDeletes[0]!.target.file).toBe(second);

      const result = await applyExactFixes(plan);
      const firstAfter = await fs.readFile(first, 'utf8');
      const secondAfter = await fs.readFile(second, 'utf8');

      expect(result.removedParagraphs).toBe(1);
      expect(firstAfter).toContain(duplicate);
      expect(secondAfter).not.toContain(duplicate);
      expect(secondAfter).toContain('Unique nested paragraph.');
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('leaves near-duplicate skill files unchanged when the user skips the merge', async () => {
    const fx = await makeFixtures([
      {
        rel: 'claude/skills/ship/SKILL.md',
        frontmatter: { name: 'ship', description: 'Ship from Claude.' },
        body: 'Run the same release checklist.',
      },
      {
        rel: 'codex/skills/ship/SKILL.md',
        frontmatter: { name: 'ship', description: 'Ship from Codex.' },
        body: 'Run the same release checklist.',
      },
    ]);
    try {
      const skills = await discover(fx.sources);
      const before = await fs.readFile(path.join(fx.root, 'codex/skills/ship/SKILL.md'), 'utf8');
      const plan = await createDedupPlan({ skills, claudeMdFiles: [] });

      expect(plan.nearDuplicatePairs).toHaveLength(1);

      const result = await applyNearDuplicateDecisions(plan, {
        decide: async () => 'skip',
      });

      expect(result.skipped).toBe(1);
      expect(result.traces[0]).toContain('skipped');
      await expect(fs.readFile(path.join(fx.root, 'codex/skills/ship/SKILL.md'), 'utf8')).resolves.toBe(before);
    } finally {
      await fx.cleanup();
    }
  });
});
