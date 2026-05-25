import { describe, expect, it } from 'vitest';
import { renderJson, renderMd, renderText } from '../../src/lib/claudemd/report.js';
import type { DoctorReport, Finding } from '../../src/lib/claudemd/types.js';

function stripAnsi(text: string): string {
  return text.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');
}

function makeReport(findings: Finding[]): DoctorReport {
  return {
    file: '/tmp/project/CLAUDE.md',
    tokens: 12345,
    ruleCount: 47,
    lineCount: 312,
    findings,
    summary: {
      errors: findings.filter((finding) => finding.severity === 'error').length,
      warnings: findings.filter((finding) => finding.severity === 'warn').length,
      infos: findings.filter((finding) => finding.severity === 'info').length,
    },
    meta: { llmUsed: true, rulesetVersion: 'v0.1.0' },
  };
}

const warnFinding: Finding = {
  id: 'verbose-rule',
  severity: 'warn',
  category: 'verbose',
  message: 'Rule too long',
  line: 87,
  ruleText: 'Always remember to explain every single decision in great detail.',
  suggestion: 'split into two bullets',
  source: 'rules',
};

const errorFinding: Finding = {
  id: 'token-bloat-extreme',
  severity: 'error',
  category: 'token-bloat',
  message: 'File exceeds 15k tokens',
  source: 'rules',
};

const infoFinding: Finding = {
  id: 'missing-best-practice-1',
  severity: 'info',
  category: 'missing-best-practice',
  message: 'Add verification guidance',
  suggestion: 'Mention the expected test command.',
  source: 'llm',
};

describe('claudemd report renderers', () => {
  it('renders markdown findings, headings, and metadata', () => {
    const report = makeReport([warnFinding, infoFinding, errorFinding]);
    const md = renderMd(report);

    expect(md).toContain('# CLAUDE.md doctor report');
    expect(md).toContain(
      '**File:** /tmp/project/CLAUDE.md  ·  **Tokens:** 12345  ·  **Rules:** 47  ·  **Lines:** 312  ·  **LLM:** yes  ·  **Ruleset:** v0.1.0',
    );
    expect(md).toContain('**Errors:** 1  ·  **Warnings:** 1  ·  **Info:** 1');
    expect(md).toContain('## Findings');
    expect(md).toContain('### Errors');
    expect(md).toContain('### Warnings');
    expect(md).toContain('### Info');
    expect(md).toContain('File exceeds 15k tokens');
    expect(md).toContain('Rule too long');
    expect(md).toContain('Add verification guidance');
    expect(md).toContain('- source: rules');
    expect(md).toContain('- source: llm');
  });

  it('renders an empty markdown report without findings', () => {
    const md = renderMd(makeReport([]));

    expect(md).toContain('No issues found.');
  });

  it('renders text report with colored severity tags and footer summary', () => {
    const text = stripAnsi(renderText(makeReport([warnFinding, infoFinding, errorFinding])));

    expect(text).toContain('claudoctor — /tmp/project/CLAUDE.md');
    expect(text).toContain('ERROR [token-bloat] File exceeds 15k tokens');
    expect(text).toContain('WARN [verbose] Rule too long (line 87)');
    expect(text).toContain('INFO [missing-best-practice] Add verification guidance');
    expect(text).toContain('1 errors, 1 warnings, 1 infos · ruleset v0.1.0 · llm: yes');
  });

  it('renders json that parses back to the original report', () => {
    const report = makeReport([warnFinding, infoFinding, errorFinding]);

    expect(JSON.parse(renderJson(report))).toEqual(report);
  });

  it('renders green text when there are no findings', () => {
    const text = stripAnsi(renderText(makeReport([])));

    expect(text).toContain('No issues found.');
  });
});
