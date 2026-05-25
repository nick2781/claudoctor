import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseClaudeMd } from '../../src/lib/claudemd/parse.js';

const fixture = (name: string) => path.join(process.cwd(), 'test/fixtures/claudemd', name);

describe('parseClaudeMd', () => {
  it('parses frontmatter, body, token count, and total line count', async () => {
    const doc = await parseClaudeMd(fixture('minimal.md'));

    expect(doc.path).toBe(fixture('minimal.md'));
    expect(doc.frontmatter).toMatchObject({ name: 'minimal', owner: 'docs' });
    expect(doc.body).toContain('# Tone');
    expect(doc.tokens).toBeGreaterThan(0);
    expect(doc.lineCount).toBe(12);
  });

  it('parses files without frontmatter', async () => {
    const doc = await parseClaudeMd(fixture('no-frontmatter.md'));

    expect(doc.frontmatter).toEqual({});
    expect(doc.sections.map((section) => section.heading)).toEqual(['Guide']);
    expect(doc.rules).toEqual([
      expect.objectContaining({
        text: 'Always read the issue first.',
        line: 3,
        section: 'Guide',
        imperative: true,
      }),
    ]);
  });

  it('splits sections on same or higher-level headings and preserves source line numbers', async () => {
    const doc = await parseClaudeMd(fixture('sections.md'));

    expect(doc.sections).toEqual([
      expect.objectContaining({
        heading: 'Tone',
        level: 1,
        startLine: 5,
        body: expect.stringContaining('## Details'),
      }),
      expect.objectContaining({
        heading: 'Details',
        level: 2,
        startLine: 9,
        body: expect.stringContaining('- Prefer direct language.'),
      }),
      expect.objectContaining({
        heading: 'Tools',
        level: 1,
        startLine: 13,
        body: expect.stringContaining('Do not skip verification.'),
      }),
    ]);
    expect(doc.sections[0]!.body).not.toContain('# Tools');
  });

  it('extracts unordered, ordered, and imperative paragraph rules', async () => {
    const doc = await parseClaudeMd(fixture('bullets.md'));

    expect(doc.rules.map((rule) => rule.text)).toEqual([
      'Always test parser behavior.',
      'Never ignore command failures.',
      'Use stable fixtures.',
      'Avoid vague assertions.',
      'Should preserve imperative paragraphs.',
    ]);
    expect(doc.rules.map((rule) => rule.line)).toEqual([3, 4, 5, 6, 8]);
    expect(doc.rules.every((rule) => rule.section === 'Rules')).toBe(true);
    expect(doc.rules.every((rule) => rule.imperative)).toBe(true);
  });
});
