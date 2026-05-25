import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseClaudeMd } from '../../src/lib/claudemd/parse.js';

const fixturePath = (name: string): string => path.join(process.cwd(), 'test/fixtures/claudemd', name);

describe('parseClaudeMd', () => {
  it('parses frontmatter, sections, bullet rules, and emphasized lines', async () => {
    const doc = await parseClaudeMd(fixturePath('sections.md'));

    expect(doc.frontmatter).toMatchObject({ owner: 'platform', version: 1 });
    expect(doc.raw).toContain('owner: platform');
    expect(doc.body).toContain('# Workflow');
    expect(doc.tokens).toBeGreaterThan(0);
    expect(doc.lineCount).toBe(doc.raw.split(/\r?\n/).length);
    expect(doc.sections.map((section) => section.heading)).toEqual(['Workflow', 'Output', 'Details']);
    expect(doc.sections.map((section) => section.level)).toEqual([1, 2, 3]);
    expect(doc.sections[0]!.startLine).toBe(8);
    expect(doc.sections[0]!.body).toContain('- Use pnpm');

    expect(doc.rules.map((rule) => rule.text)).toEqual([
      'Use pnpm for project commands.',
      'Prefer small focused commits.',
      'IMPORTANT: Verify behavior before reporting success.',
      'Format final answers as concise markdown.',
      'Always include relevant file paths.',
    ]);
    expect(doc.rules.map((rule) => rule.section)).toEqual(['Workflow', 'Workflow', 'Workflow', 'Output', 'Details']);
    expect(doc.rules[2]!.line).toBe(13);
    expect(doc.rules[2]!.imperative).toBe(true);
    expect(doc.rules[2]!.emphasized).toBe(true);
  });

  it('does not extract bullets inside fenced code blocks', async () => {
    const doc = await parseClaudeMd(fixturePath('ignored.md'));

    expect(doc.rules.map((rule) => rule.text)).toEqual(['Keep this visible rule.', 'Use visible rules after fences.']);
  });

  it('does not extract blockquoted emphasized lines', async () => {
    const doc = await parseClaudeMd(fixturePath('ignored.md'));

    expect(doc.rules.find((rule) => rule.text.includes('quoted warnings'))).toBeUndefined();
  });

  it('does not treat fenced headings as sections', async () => {
    const doc = await parseClaudeMd(fixturePath('ignored.md'));

    expect(doc.sections.map((section) => section.heading)).toEqual(['Ignored Examples', 'After Fence']);
    expect(doc.rules.map((rule) => rule.section)).toEqual(['Ignored Examples', 'After Fence']);
  });
});
