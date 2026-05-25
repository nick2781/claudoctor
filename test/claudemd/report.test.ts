import { describe, expect, it } from 'vitest';
import { renderJson, renderMd, renderText } from '../../src/lib/claudemd/report.js';
import type { DoctorReport, Finding } from '../../src/lib/claudemd/types.js';

function stripAnsi(value: string): string {
  return value.replace(/\u001B\[[0-9;]*m/g, '');
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
  ruleText: 'Always run `pnpm test` before pushing.',
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
  id: 'missing-examples',
  severity: 'info',
  category: 'missing-best-practice',
  message: 'Add concrete examples',
  source: 'llm',
  suggestion: 'Add one command example per workflow.',
};

const secondWarnFinding: Finding = {
  id: 'vague-rule',
  severity: 'warn',
  category: 'vague',
  message: 'Instruction is vague',
  source: 'llm',
};

describe('claudemd report renderers', () => {
  it('renders markdown with grouped findings and report metadata', () => {
    const report = makeReport([infoFinding, warnFinding, errorFinding]);
    const md = renderMd(report);

    expect(md).toContain('# CLAUDE.md doctor report');
    expect(md).toContain('**File:** /tmp/project/CLAUDE.md · 12345 tokens · 47 rules · 3 findings');
    expect(md).toContain('## Findings');
    expect(md.indexOf('## Errors')).toBeLessThan(md.indexOf('## Warnings'));
    expect(md.indexOf('## Warnings')).toBeLessThan(md.indexOf('## Info'));
    expect(md).toContain('- **[token-bloat]** File exceeds 15k tokens');
    expect(md).toContain('- **[verbose]** Rule too long _(line 87)_');
    expect(md).toContain('- **[missing-best-practice]** Add concrete examples');
    expect(md).toContain('- rule: ``"Always run `pnpm test` before pushing."``');
    expect(md).toContain('- fix: split into two bullets');
    expect(JSON.parse(renderJson(report))).toEqual(report);
  });

  it('renders a healthy markdown report when there are no findings', () => {
    const md = renderMd(makeReport([]));

    expect(md).toContain('No issues found.');
  });

  it('renders text report severity tags and footer counts', () => {
    const text = stripAnsi(renderText(makeReport([warnFinding, secondWarnFinding])));

    expect(text).toContain('claudoctor — /tmp/project/CLAUDE.md');
    expect(text).toContain('WARN [verbose] Rule too long (line 87)');
    expect(text).toContain('0 errors, 2 warnings, 0 infos · ruleset v0.1.0 · llm: yes');
  });

  it('renders json that parses back to the original report', () => {
    const report = makeReport([warnFinding, errorFinding, infoFinding]);

    expect(JSON.parse(renderJson(report))).toEqual(report);
  });
});
