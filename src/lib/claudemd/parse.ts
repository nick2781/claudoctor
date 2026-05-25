import fs from 'node:fs/promises';
import matter from 'gray-matter';
import { tokens } from '../tokens.js';
import type { ClaudeMd, Rule, Section } from './types.js';

const headingRe = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const bulletRe = /^\s*(?:[-*+]\s+|\d+\.\s+)(.+)$/;
const fenceMarkerRe = /^\s*(`{3,}|~{3,})/;
const triggerLineRe = /^\s*(?:\*\*)?(IMPORTANT|NEVER|ALWAYS|MUST|DO NOT|Note:)(?:\*\*)?(?=\s|:|$)/i;
const imperativeRe =
  /^(do|don't|never|always|use|avoid|prefer|ensure|make|run|check|read|write|skip|drop|keep|stop|return|reply|respond|ask|verify|test|format|wrap|escape|quote|set|unset|enable|disable|include|exclude|add|remove|delete|create|update|fix|fail|exit|call|invoke)\b/i;
const triggerKeywordRe = /\b(IMPORTANT|NEVER|ALWAYS|MUST|DO NOT)\b|Note:/i;
const emphasizedTriggerRe = /(\*\*\s*(?:IMPORTANT|NEVER|ALWAYS|MUST|DO NOT|Note:)\s*\*\*)|\b(?:IMPORTANT|NEVER|ALWAYS|MUST|DO NOT)\b/;

interface Heading {
  heading: string;
  level: number;
  bodyLine: number;
  rawLine: number;
}

interface Fence {
  marker: '`' | '~';
  length: number;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function bodyStartLine(raw: string, body: string): number {
  const index = raw.indexOf(body);
  if (index <= 0) return 1;
  return raw.slice(0, index).split(/\r?\n/).length;
}

function cleanRuleText(text: string): string {
  return text.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
}

function nextFence(line: string, current: Fence | undefined): Fence | undefined {
  const match = fenceMarkerRe.exec(line);
  if (!match) return current;

  const markerText = match[1]!;
  const marker = markerText[0] as Fence['marker'];
  if (!current) return { marker, length: markerText.length };
  if (marker === current.marker && markerText.length >= current.length) return undefined;
  return current;
}

function makeRule(text: string, line: number, section: string, sourceLine: string): Rule {
  const cleaned = cleanRuleText(text);
  return {
    text: cleaned,
    line,
    section,
    imperative: imperativeRe.test(cleaned) || triggerKeywordRe.test(cleaned),
    emphasized: emphasizedTriggerRe.test(sourceLine) || emphasizedTriggerRe.test(cleaned),
  };
}

function getHeadings(lines: string[], startLine: number): Heading[] {
  const headings: Heading[] = [];
  let fence: Fence | undefined;

  lines.forEach((line, index) => {
    const updatedFence = nextFence(line, fence);
    if (updatedFence !== fence) {
      fence = updatedFence;
      return;
    }
    if (fence) return;

    const match = headingRe.exec(line);
    if (!match) return;
    headings.push({
      heading: match[2]!.trim(),
      level: match[1]!.length,
      bodyLine: index,
      rawLine: startLine + index,
    });
  });

  return headings;
}

function parseSections(lines: string[], headings: Heading[]): Section[] {
  const sections: Section[] = [];
  const firstHeading = headings[0];
  if (firstHeading) {
    const preamble = lines.slice(0, firstHeading.bodyLine).join('\n').trim();
    if (preamble) {
      sections.push({ heading: '', level: 0, body: preamble, startLine: 1 });
    }
  } else {
    const wholeBody = lines.join('\n').trim();
    if (wholeBody) {
      sections.push({ heading: '', level: 0, body: wholeBody, startLine: 1 });
    }
  }

  headings.forEach((heading, index) => {
    const next = headings[index + 1];
    const end = next ? next.bodyLine : lines.length;
    sections.push({
      heading: heading.heading,
      level: heading.level,
      body: lines.slice(heading.bodyLine + 1, end).join('\n').trim(),
      startLine: heading.rawLine,
    });
  });

  return sections;
}

function sectionAtLine(headings: Heading[], bodyLine: number): string {
  let current = '';
  for (const heading of headings) {
    if (heading.bodyLine > bodyLine) break;
    current = heading.heading;
  }
  return current;
}

function parseRules(lines: string[], headings: Heading[], startLine: number): Rule[] {
  const rules: Rule[] = [];
  let fence: Fence | undefined;

  lines.forEach((line, index) => {
    const updatedFence = nextFence(line, fence);
    if (updatedFence !== fence) {
      fence = updatedFence;
      return;
    }
    if (fence || /^\s*>/.test(line)) return;

    const bulletMatch = bulletRe.exec(line);
    const triggerMatch = triggerLineRe.exec(line);
    const section = sectionAtLine(headings, index);
    const rawLine = startLine + index;

    if (bulletMatch) {
      rules.push(makeRule(bulletMatch[1]!, rawLine, section, line));
      return;
    }

    if (triggerMatch) {
      rules.push(makeRule(line.trim(), rawLine, section, line));
    }
  });

  return rules;
}

export async function parseClaudeMd(path: string): Promise<ClaudeMd> {
  const file = await fs.readFile(path, 'utf8');
  const raw = file.startsWith('\uFEFF') ? file.slice(1) : file;
  const parsed = matter(raw);
  const body = parsed.content;
  const startLine = bodyStartLine(raw, body);
  const lines = body.split(/\r?\n/);
  const headings = getHeadings(lines, startLine);

  return {
    path,
    raw,
    frontmatter: asRecord(parsed.data as unknown),
    body,
    sections: parseSections(lines, headings),
    rules: parseRules(lines, headings, startLine),
    tokens: tokens(raw),
    lineCount: raw.split(/\r?\n/).length,
  };
}
