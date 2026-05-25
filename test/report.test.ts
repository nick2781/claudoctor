import { describe, expect, it } from 'vitest';
import {
  renderHtmlReport,
  renderJsonReport,
  renderMarkdownReport,
  type CombinedReport,
} from '../src/lib/combined-report.js';
import type { Analysis } from '../src/lib/analyze.js';
import type { DoctorReport, Finding } from '../src/lib/claudemd/types.js';
import type { Skill } from '../src/lib/discover.js';

function skill(name: string, file: string, tokens = 100): Skill {
  return {
    agent: 'claude',
    sourceLabel: 'test',
    root: '/tmp/project',
    file,
    relPath: file.replace('/tmp/project/', ''),
    name,
    description: `${name} skill`,
    body: `${name} body`,
    raw: `${name} raw`,
    bytes: 42,
    tokens,
    contentHash: `${name}-content`,
    bodyHash: `${name}-body`,
  };
}

const errorFinding: Finding = {
  id: 'token-bloat-extreme',
  severity: 'error',
  category: 'token-bloat',
  message: 'CLAUDE.md is too large',
  line: 12,
  source: 'rules',
};

const warnFinding: Finding = {
  id: 'vague-rule',
  severity: 'warn',
  category: 'vague',
  message: 'Instruction is vague',
  source: 'rules',
};

const infoFinding: Finding = {
  id: 'missing-example',
  severity: 'info',
  category: 'missing-best-practice',
  message: 'Add examples',
  source: 'llm',
};

function doctorReport(findings: Finding[]): DoctorReport {
  return {
    file: '/tmp/project/CLAUDE.md',
    tokens: 1234,
    ruleCount: 12,
    lineCount: 88,
    findings,
    summary: {
      errors: findings.filter((finding) => finding.severity === 'error').length,
      warnings: findings.filter((finding) => finding.severity === 'warn').length,
      infos: findings.filter((finding) => finding.severity === 'info').length,
    },
    meta: { llmUsed: false, rulesetVersion: 'v0.3.0' },
  };
}

function analysis(): Analysis {
  const duplicateA = skill('deploy', '/tmp/project/.claude/skills/deploy/SKILL.md', 90);
  const duplicateB = skill('deploy', '/tmp/project/.codex/skills/deploy/SKILL.md', 90);
  const nearA = skill('ship', '/tmp/project/.claude/skills/ship/SKILL.md', 80);
  const nearB = skill('ship', '/tmp/project/.codex/skills/ship/SKILL.md', 80);
  const conflictA = skill('commit', '/tmp/project/.claude/skills/commit/SKILL.md', 70);
  const conflictB = skill('commit', '/tmp/project/.codex/skills/commit/SKILL.md', 75);
  const overlapA = skill('release-notes', '/tmp/project/.claude/skills/release/SKILL.md', 60);
  const overlapB = skill('changelog', '/tmp/project/.codex/skills/changelog/SKILL.md', 55);
  const tokenHeavy = skill('architecture-review', '/tmp/project/.claude/skills/arch/SKILL.md', 500);

  duplicateB.contentHash = duplicateA.contentHash;
  nearB.bodyHash = nearA.bodyHash;

  return {
    skills: [duplicateA, duplicateB, nearA, nearB, conflictA, conflictB, overlapA, overlapB, tokenHeavy],
    totalTokens: 1100,
    totalSkills: 9,
    byAgent: {
      claude: { count: 5, tokens: 800 },
      codex: { count: 4, tokens: 300 },
    },
    duplicates: [
      {
        kind: 'duplicate',
        name: 'deploy',
        contentHash: duplicateA.contentHash,
        tokens: 90,
        copies: [duplicateA, duplicateB],
        wastedTokens: 90,
      },
    ],
    nearDuplicates: [
      {
        kind: 'near-duplicate',
        name: 'ship',
        bodyHash: nearA.bodyHash,
        tokens: 80,
        variants: [nearA, nearB],
        wastedTokens: 80,
      },
    ],
    conflicts: [
      {
        kind: 'conflict',
        name: 'commit',
        variants: [conflictA, conflictB],
        tokens: 145,
      },
    ],
    overlapsTotal: 1,
    overlaps: [
      {
        kind: 'overlap',
        a: overlapA,
        b: overlapB,
        descSimilarity: 0.7,
        similarity: 0.7,
        smallerTokens: 55,
      },
    ],
    savings: {
      duplicateTokens: 90,
      nearDuplicateTokens: 80,
      overlapTokens: 55,
      totalEstimated: 225,
    },
  };
}

function report(): CombinedReport {
  return {
    generatedAt: '2026-05-25T10:00:00.000Z',
    claudemd: doctorReport([errorFinding, warnFinding, infoFinding]),
    skills: analysis(),
  };
}

function templateSkeleton(html: string): string {
  return Array.from(
    html.matchAll(/<(?:header|main|section|article|footer)\b[^>]*>|<h[12]\b[^>]*>[^<]+<\/h[12]>/g),
    (match) => match[0].replace(/\s+/g, ' '),
  ).join('\n');
}

describe('combined report renderers', () => {
  it('renders single-file HTML with summary counts, three sections, and source links', () => {
    const html = renderHtmlReport(report());

    expect(html).toContain('<!doctype html>');
    expect(html).toContain('<style>');
    expect(html).not.toContain('https://');
    expect(html).not.toContain('cdn');
    expect(html).toContain('<strong>Errors</strong><span>2</span>');
    expect(html).toContain('<strong>Warnings</strong><span>4</span>');
    expect(html).toContain('<strong>Info</strong><span>2</span>');
    expect(html).toContain('CLAUDE.md findings');
    expect(html).toContain('Skills findings');
    expect(html).toContain('Duplicates');
    expect(html).toContain('CLAUDE.md is too large');
    expect(html).toContain('Name conflict: commit');
    expect(html).toContain('Exact duplicate: deploy');
    expect(html).toContain('Near duplicate: ship');
    expect(html).toContain('href="file:///tmp/project/.claude/skills/deploy/SKILL.md"');
    expect(html).toContain('href="file:///tmp/project/.codex/skills/ship/SKILL.md"');
  });

  it('locks the HTML template structure with a snapshot', () => {
    expect(templateSkeleton(renderHtmlReport(report()))).toMatchInlineSnapshot(`
      "<header class="report-header">
      <h1>claudoctor report</h1>
      <main class="report-grid">
      <section class="panel panel-claudemd">
      <h2>CLAUDE.md findings</h2>
      <article class="finding finding-error">
      <article class="finding finding-warn">
      <article class="finding finding-info">
      <section class="panel panel-skills">
      <h2>Skills findings</h2>
      <article class="finding finding-warn">
      <article class="finding finding-warn">
      <article class="finding finding-info">
      <section class="panel panel-duplicates">
      <h2>Duplicates</h2>
      <article class="finding finding-error">
      <article class="finding finding-warn">
      <footer class="report-footer">"
    `);
  });

  it('renders markdown and json forms from the same report data', () => {
    const md = renderMarkdownReport(report());

    expect(md).toContain('# claudoctor report');
    expect(md).toContain('## CLAUDE.md findings');
    expect(md).toContain('## Skills findings');
    expect(md).toContain('## Duplicates');
    expect(JSON.parse(renderJsonReport(report()))).toEqual(report());
  });
});
