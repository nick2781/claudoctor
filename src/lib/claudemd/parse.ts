import fs from 'node:fs/promises';
import matter from 'gray-matter';
import { tokens as countTokens } from '../tokens.js';
import type { ClaudeMd, Rule, Section } from './types.js';

const headingPattern = /^(#{1,6})\s+(.+)$/;
const bulletPattern = /^\s*(?:[-*+]\s+|\d+[.)]\s+)(.+)$/;
const imperativePattern = /^(?:Always|Never|Do not|Don't|Must|Should|Avoid|Use|Prefer|Stop|Only|If)\b/i;
const emphasizedWordPattern = /\b(?:IMPORTANT|CRITICAL|NEVER|ALWAYS)\b/;

export async function parseClaudeMd(path: string): Promise<ClaudeMd> {
  const raw = await fs.readFile(path, 'utf8');
  const parsed = matter(raw);
  const body = parsed.content;
  const bodyStartLine = getBodyStartLine(raw);
  const sections = extractSections(body, bodyStartLine);
  const rules = extractRules(body, bodyStartLine, sections);

  return {
    path,
    raw,
    frontmatter: parsed.data,
    body,
    sections,
    rules,
    tokens: countTokens(raw),
    lineCount: countLines(raw),
  };
}

function countLines(text: string): number {
  if (text.length === 0) return 0;
  const lines = text.split(/\r\n|\r|\n/);
  if (lines.at(-1) === '') lines.pop();
  return lines.length;
}

function getBodyStartLine(raw: string): number {
  const lines = raw.split(/\r\n|\r|\n/);
  if (!/^---\s*$/.test(lines[0] ?? '')) return 1;

  for (let index = 1; index < lines.length; index += 1) {
    if (/^---\s*$/.test(lines[index] ?? '')) return index + 2;
  }

  return 1;
}

function extractSections(body: string, bodyStartLine: number): Section[] {
  const bodyLines = body.split(/\r\n|\r|\n/);
  const headings = bodyLines.flatMap((line, index) => {
    const match = line.match(headingPattern);
    if (!match) return [];
    return [
      {
        index,
        heading: match[2]!.trim(),
        level: match[1]!.length,
        startLine: bodyStartLine + index,
      },
    ];
  });

  return headings.map((heading, index) => {
    const nextBoundary = headings
      .slice(index + 1)
      .find((candidate) => candidate.level <= heading.level);
    const endIndex = nextBoundary?.index ?? bodyLines.length;

    return {
      heading: heading.heading,
      level: heading.level,
      body: bodyLines.slice(heading.index + 1, endIndex).join('\n').trim(),
      startLine: heading.startLine,
    };
  });
}

function extractRules(body: string, bodyStartLine: number, sections: Section[]): Rule[] {
  const bodyLines = body.split(/\r\n|\r|\n/);
  const rules: Rule[] = [];
  let paragraph: { lines: string[]; startLine: number } | undefined;

  const flushParagraph = (): void => {
    if (!paragraph) return;
    const text = paragraph.lines.join(' ').trim();
    if (imperativePattern.test(text)) {
      rules.push(toRule(text, paragraph.startLine, sections));
    }
    paragraph = undefined;
  };

  bodyLines.forEach((line, index) => {
    const lineNumber = bodyStartLine + index;
    const trimmed = line.trim();
    const bulletMatch = line.match(bulletPattern);

    if (trimmed.length === 0 || headingPattern.test(line)) {
      flushParagraph();
      return;
    }

    if (bulletMatch) {
      flushParagraph();
      rules.push(toRule(bulletMatch[1]!.trim(), lineNumber, sections));
      return;
    }

    if (!paragraph) paragraph = { lines: [], startLine: lineNumber };
    paragraph.lines.push(trimmed);
  });

  flushParagraph();
  return rules;
}

function toRule(text: string, line: number, sections: Section[]): Rule {
  return {
    text,
    line,
    section: sectionForLine(line, sections),
    imperative: imperativePattern.test(text),
    emphasized: isEmphasized(text),
  };
}

function sectionForLine(line: number, sections: Section[]): string {
  return sections
    .filter((section) => section.startLine <= line)
    .at(-1)?.heading ?? '';
}

function isEmphasized(text: string): boolean {
  const trimmed = text.trim();
  return (
    /^\*\*.+\*\*$/.test(trimmed) ||
    emphasizedWordPattern.test(trimmed) ||
    trimmed.endsWith('!!!')
  );
}
