import { tokens } from '../tokens.js';
import type { Category, ClaudeMd, Finding, Severity } from './types.js';

export interface RuleDef {
  id: string;
  category: Category;
  severity: Severity;
  description: string;
  check: (doc: ClaudeMd) => Finding[] | null;
}

function finding(
  id: string,
  severity: Severity,
  category: Category,
  message: string,
  extras: Omit<Partial<Finding>, 'id' | 'severity' | 'category' | 'message' | 'source'> = {},
): Finding {
  return { id, severity, category, message, source: 'rules', ...extras };
}

function normalizeRule(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstMatch(text: string, re: RegExp): string | undefined {
  const match = re.exec(text);
  return match?.[0];
}

function hasRule(doc: ClaudeMd, re: RegExp): boolean {
  return doc.rules.some((rule) => re.test(rule.text));
}

export const RULES: RuleDef[] = [
  {
    id: 'token-bloat-overall',
    category: 'token-bloat',
    severity: 'warn',
    description: 'Warn when CLAUDE.md is large enough to dilute attention.',
    check: (doc) =>
      doc.tokens > 4000
        ? [
            finding(
              'token-bloat-overall',
              'warn',
              'token-bloat',
              `CLAUDE.md is ${doc.tokens} tokens; >4000 tokens dilutes attention. Trim non-essential context.`,
            ),
          ]
        : null,
  },
  {
    id: 'token-bloat-critical',
    category: 'token-bloat',
    severity: 'error',
    description: 'Error when CLAUDE.md is critically large.',
    check: (doc) =>
      doc.tokens > 8000
        ? [
            finding(
              'token-bloat-critical',
              'error',
              'token-bloat',
              `CLAUDE.md is ${doc.tokens} tokens; >8000 tokens severely degrades performance.`,
            ),
          ]
        : null,
  },
  {
    id: 'rule-overload',
    category: 'rule-overload',
    severity: 'warn',
    description: 'Warn when the file contains too many extracted rules.',
    check: (doc) =>
      doc.rules.length > 40
        ? [
            finding(
              'rule-overload',
              'warn',
              'rule-overload',
              `${doc.rules.length} rules; agents skim past ~40 rules. Consolidate or move stale ones.`,
            ),
          ]
        : null,
  },
  {
    id: 'verbose-section',
    category: 'verbose',
    severity: 'info',
    description: 'Flag sections with verbose bodies.',
    check: (doc) => {
      const findings = doc.sections
        .filter((section) => tokens(section.body) > 600)
        .map((section) =>
          finding(
            `verbose-section:${section.startLine}`,
            'info',
            'verbose',
            `Section "${section.heading || 'preamble'}" is ${tokens(section.body)} tokens; trim or split it.`,
            { line: section.startLine },
          ),
        );
      return findings.length ? findings : null;
    },
  },
  {
    id: 'vague-rule',
    category: 'vague',
    severity: 'info',
    description: 'Flag vague words in rule text.',
    check: (doc) => {
      const vagueRe = /\b(properly|appropriately|carefully|nicely|good|well|reasonable|where appropriate)\b/i;
      const findings = doc.rules.flatMap((rule) => {
        const word = firstMatch(rule.text, vagueRe);
        return word
          ? [
              finding(
                `vague-rule:${rule.line}`,
                'info',
                'vague',
                `Vague word "${word}" in rule: ${rule.text}`,
                { line: rule.line, ruleText: rule.text },
              ),
            ]
          : [];
      });
      return findings.length ? findings : null;
    },
  },
  {
    id: 'pleasantry-instruction',
    category: 'counterproductive',
    severity: 'warn',
    description: 'Flag instructions that encourage filler pleasantries.',
    check: (doc) => {
      const pleasantryRe = /\b(be polite|be friendly|be nice|be kind|be helpful|sure!?|certainly|of course|happy to)\b/i;
      const findings = doc.rules
        .filter((rule) => pleasantryRe.test(rule.text))
        .map((rule) =>
          finding(
            `pleasantry-instruction:${rule.line}`,
            'warn',
            'counterproductive',
            'Pleasantries are filler; remove this instruction.',
            { line: rule.line, ruleText: rule.text },
          ),
        );
      return findings.length ? findings : null;
    },
  },
  {
    id: 'non-actionable-rule',
    category: 'vague',
    severity: 'info',
    description: 'Flag long prose rules that are not imperative.',
    check: (doc) => {
      const findings = doc.rules
        .filter((rule) => !rule.imperative && rule.text.length > 80)
        .map((rule) =>
          finding(
            `non-actionable-rule:${rule.line}`,
            'info',
            'vague',
            'Rule reads like prose; rewrite it as an imperative.',
            { line: rule.line, ruleText: rule.text },
          ),
        );
      return findings.length ? findings : null;
    },
  },
  {
    id: 'duplicate-rule',
    category: 'structural',
    severity: 'info',
    description: 'Flag duplicate extracted rules.',
    check: (doc) => {
      const firstLineByText = new Map<string, number>();
      const findings: Finding[] = [];
      for (const rule of doc.rules) {
        const normalized = normalizeRule(rule.text);
        const firstLine = firstLineByText.get(normalized);
        if (firstLine === undefined) {
          firstLineByText.set(normalized, rule.line);
        } else {
          findings.push(
            finding(`duplicate-rule:${rule.line}`, 'info', 'structural', `Duplicate rule of line ${firstLine}.`, {
              line: rule.line,
              ruleText: rule.text,
            }),
          );
        }
      }
      return findings.length ? findings : null;
    },
  },
  {
    id: 'missing-tone-guidance',
    category: 'missing-best-practice',
    severity: 'info',
    description: 'Suggest adding tone guidance when absent.',
    check: (doc) =>
      !hasRule(doc, /\b(tone|terse|concise|brief|short)\b/i) && !hasRule(doc, /\b(verbose|long|detail)\b/i)
        ? [
            finding(
              'missing-tone-guidance',
              'info',
              'missing-best-practice',
              'Consider stating preferred tone (concise vs detailed).',
            ),
          ]
        : null,
  },
  {
    id: 'missing-output-format',
    category: 'missing-best-practice',
    severity: 'info',
    description: 'Suggest adding output format guidance when absent.',
    check: (doc) =>
      !hasRule(doc, /\b(output|format|markdown|json)\b/i)
        ? [
            finding(
              'missing-output-format',
              'info',
              'missing-best-practice',
              'Consider stating expected output format.',
            ),
          ]
        : null,
  },
  {
    id: 'conflict-tone',
    category: 'conflict',
    severity: 'warn',
    description: 'Flag contradictory tone instructions.',
    check: (doc) =>
      hasRule(doc, /\b(concise|terse|brief|short)\b/i) && hasRule(doc, /\b(verbose|long|detail|detailed|thorough|thoroughly)\b/i)
        ? [finding('conflict-tone', 'warn', 'conflict', 'Tone rules conflict.')]
        : null,
  },
  {
    id: 'large-frontmatter',
    category: 'structural',
    severity: 'info',
    description: 'Flag large frontmatter blocks.',
    check: (doc) => {
      const count = Object.keys(doc.frontmatter).length;
      return count > 10
        ? [finding('large-frontmatter', 'info', 'structural', `Frontmatter has ${count} top-level keys; keep metadata minimal.`)]
        : null;
    },
  },
  {
    id: 'no-headings',
    category: 'structural',
    severity: 'info',
    description: 'Suggest headings for long unstructured files.',
    check: (doc) =>
      doc.sections.length <= 1 && doc.tokens > 800
        ? [finding('no-headings', 'info', 'structural', 'Structure with H2 sections for skimmability.')]
        : null,
  },
  {
    id: 'oversized-rule',
    category: 'verbose',
    severity: 'info',
    description: 'Flag individual rules that are too long.',
    check: (doc) => {
      const findings = doc.rules
        .filter((rule) => rule.text.length > 240)
        .map((rule) =>
          finding(`oversized-rule:${rule.line}`, 'info', 'verbose', 'Rule is over 240 characters; split or trim it.', {
            line: rule.line,
            ruleText: rule.text,
          }),
        );
      return findings.length ? findings : null;
    },
  },
  {
    id: 'negation-overload',
    category: 'counterproductive',
    severity: 'info',
    description: 'Flag rule sets dominated by negative phrasing.',
    check: (doc) => {
      const negative = doc.rules.filter((rule) => /^(don't|never|avoid|no)\b/i.test(rule.text)).length;
      return doc.rules.length >= 10 && negative / doc.rules.length > 0.3
        ? [
            finding(
              'negation-overload',
              'info',
              'counterproductive',
              'Heavy negation; rewrite as positive guidance.',
            ),
          ]
        : null;
    },
  },
];
