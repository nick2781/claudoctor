import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseClaudeMd } from '../../src/lib/claudemd/parse.js';

const fixturePath = (name: string): string => path.join(process.cwd(), 'test/fixtures/claudemd', name);

describe('parseClaudeMd', () => {
  it('parses frontmatter and keeps heading line numbers relative to the original file', async () => {
    const doc = await parseClaudeMd(fixturePath('sections.md'));

    expect(doc.frontmatter).toMatchObject({ owner: 'platform', version: 1 });
    expect(doc.raw).toContain('owner: platform');
    expect(doc.body).toContain('# Workflow');
    expect(doc.tokens).toBeGreaterThan(0);
    expect(doc.lineCount).toBe(doc.raw.split(/\r?\n/).length);
    expect(doc.sections[0]).toMatchObject({ heading: 'Workflow', level: 1, startLine: 8 });
  });

  it('parses files without frontmatter', async () => {
    const doc = await parseClaudeMd(fixturePath('no-frontmatter.md'));

    expect(doc.frontmatter).toEqual({});
    expect(doc.sections).toHaveLength(1);
    expect(doc.sections[0]).toMatchObject({ heading: 'Guide', level: 1, startLine: 1 });
    expect(doc.rules.map((rule) => rule.text)).toEqual(['Always read the issue first.']);
  });

  it('keeps child heading content inside parent section bodies until the next same-or-higher heading', async () => {
    const doc = await parseClaudeMd(fixturePath('sections.md'));

    expect(doc.sections.map((section) => section.heading)).toEqual(['Workflow', 'Output', 'Details']);
    expect(doc.sections.map((section) => section.level)).toEqual([1, 2, 3]);
    expect(doc.sections[0]!.body).toContain('- Use pnpm');
    expect(doc.sections[1]!.body).toContain('### Details');
    expect(doc.sections[1]!.body).toContain('Always include relevant file paths.');
  });

  it('extracts bullet rules and standalone imperative paragraphs', async () => {
    const doc = await parseClaudeMd(fixturePath('sections.md'));

    expect(doc.rules.map((rule) => rule.text)).toEqual([
      'Use pnpm for project commands.',
      'Prefer small focused commits.',
      'Format final answers as concise markdown.',
      'Always include relevant file paths.',
    ]);
    expect(doc.rules.map((rule) => rule.section)).toEqual(['Workflow', 'Workflow', 'Output', 'Details']);
    expect(doc.rules[3]!.line).toBe(21);
    expect(doc.rules[3]!.imperative).toBe(true);
    expect(doc.rules[3]!.emphasized).toBe(false);
  });

  it('recognizes every required bullet marker and imperative trigger', async () => {
    const doc = await parseClaudeMd(fixturePath('bullets.md'));

    expect(doc.rules.map((rule) => rule.text)).toEqual([
      'Should preserve dash bullets.',
      'Avoid star bullet mistakes.',
      'Use plus bullet support.',
      'Prefer numbered bullet support.',
      'Only include standalone directives.',
      'If blocked, report the blocker.',
      "Don't skip apostrophe directives.",
      'Do not ignore explicit negative directives.',
      'Must verify required language.',
      'Stop before destructive commands.',
      'Never leak secrets.',
      'Always cite relevant files.',
    ]);
    expect(doc.rules.every((rule) => rule.imperative)).toBe(true);
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
