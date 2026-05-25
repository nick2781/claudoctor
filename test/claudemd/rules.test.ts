import { describe, expect, it } from 'vitest';
import { runRules } from '../../src/lib/claudemd/rules.js';
import type { ClaudeMd, Rule, Section } from '../../src/lib/claudemd/types.js';

function rule(text: string, line: number): Rule {
  return {
    text,
    line,
    section: 'Rules',
    imperative: /^(do|don't|never|always|use|avoid)\b/i.test(text),
    emphasized: /\b(NEVER|ALWAYS|MUST|IMPORTANT|DO NOT)\b/.test(text),
  };
}

function doc(overrides: Partial<ClaudeMd> = {}): ClaudeMd {
  const raw = overrides.raw ?? '# Rules\n\n- Use clear output.\n';
  const sections: Section[] = overrides.sections ?? [{ heading: 'Rules', level: 1, body: '- Use clear output.', startLine: 1 }];
  const rules = overrides.rules ?? [rule('Use clear output.', 3)];
  return {
    path: 'CLAUDE.md',
    raw,
    frontmatter: {},
    body: raw,
    sections,
    rules,
    tokens: 12,
    lineCount: raw.split(/\r?\n/).length,
    ...overrides,
  };
}

describe('runRules', () => {
  it('reports both token-bloat findings above 8000 tokens', () => {
    const findings = runRules(doc({ tokens: 8001 }));

    expect(findings.map((finding) => finding.id)).toContain('token-bloat-overall');
    expect(findings.map((finding) => finding.id)).toContain('token-bloat-critical');
  });

  it('reports vague rules', () => {
    const findings = runRules(doc({ rules: [rule('Be reasonable about errors.', 3)] }));

    expect(findings.find((finding) => finding.id === 'vague-rule:3')).toMatchObject({
      category: 'vague',
      ruleText: 'Be reasonable about errors.',
    });
  });

  it('reports pleasantry instructions', () => {
    const findings = runRules(doc({ rules: [rule('Always be polite and friendly.', 3)] }));

    expect(findings.find((finding) => finding.id === 'pleasantry-instruction:3')).toMatchObject({
      severity: 'warn',
      category: 'counterproductive',
    });
  });

  it('reports duplicate rules', () => {
    const findings = runRules(doc({ rules: [rule('Use clear output.', 3), rule('Use clear output!', 8)] }));

    expect(findings.find((finding) => finding.id === 'duplicate-rule:8')).toMatchObject({
      line: 8,
      message: 'Duplicate rule of line 3.',
    });
  });

  it('reports missing tone and output format guidance on a minimal doc', () => {
    const findings = runRules(doc({ rules: [rule('Use the project context.', 3)] }));

    expect(findings.map((finding) => finding.id)).toContain('missing-tone-guidance');
    expect(findings.map((finding) => finding.id)).toContain('missing-output-format');
  });

  it('reports negation overload', () => {
    const rules = [
      'Don\'t commit broken tests.',
      'Don\'t ignore lint.',
      'Don\'t skip review.',
      'Don\'t touch unrelated files.',
      'Don\'t add dependencies.',
      'Don\'t write secrets.',
      'Don\'t use vague wording.',
      'Don\'t leave TODOs.',
      'Use clear output.',
      'Format responses as markdown.',
    ].map((text, index) => rule(text, index + 3));

    const findings = runRules(doc({ rules }));

    expect(findings.find((finding) => finding.id === 'negation-overload')).toMatchObject({
      category: 'counterproductive',
    });
  });
});
