import { describe, expect, it } from 'vitest';
import { renderJson, renderMd, renderText } from '../../src/lib/claudemd/report.js';
import type { DoctorReport, Finding } from '../../src/lib/claudemd/types.js';

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

describe('claudemd report renderers', () => {
  it('renders a healthy markdown report when there are no findings', () => {
    const md = renderMd(makeReport([]));

    expect(md).toContain('looks healthy');
  });

  it('renders markdown findings sorted by severity with emoji headings', () => {
    const md = renderMd(makeReport([warnFinding, errorFinding]));

    expect(md.indexOf('### 🔴 File exceeds 15k tokens')).toBeLessThan(md.indexOf('### 🟡 Rule too long'));
    expect(md).toContain('## Findings');
    expect(md).toContain('### 🔴 File exceeds 15k tokens (token-bloat-extreme)');
    expect(md).toContain('### 🟡 Rule too long (verbose-rule)');
  });

  it('renders text report summary details for multiple findings', () => {
    const text = renderText(makeReport([warnFinding, errorFinding]));

    expect(text).toContain('12.3k tokens');
    expect(text).toContain('47 rules');
    expect(text).toContain('312 lines');
  });

  it('renders json that parses back to the original report', () => {
    const report = makeReport([warnFinding, errorFinding]);

    expect(JSON.parse(renderJson(report))).toEqual(report);
  });
});
