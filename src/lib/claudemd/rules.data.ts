import type { Category, ClaudeMd, Severity } from './types.js';

export interface RuleSpec {
  id: string;
  category: Category;
  severity: Severity;
  check: (doc: ClaudeMd) => {
    matched: boolean;
    message: string;
    line?: number;
    ruleText?: string;
    suggestion?: string;
  }[];
}

type RuleMatch = ReturnType<RuleSpec['check']>[number];

function finding(message: string, extras: Omit<Partial<RuleMatch>, 'matched' | 'message'> = {}): RuleMatch {
  return { matched: true, message, ...extras };
}

function hasSection(doc: ClaudeMd, re: RegExp): boolean {
  return doc.sections.some((section) => re.test(section.heading));
}

function normalizeNoun(text: string): string | undefined {
  const match = /^(?:always|never|don't|do not|do)\s+([a-z][a-z0-9_-]*)/i.exec(text.trim());
  return match?.[1]?.toLowerCase();
}

export const ruleset: RuleSpec[] = [
  {
    id: 'token-bloat',
    category: 'token-bloat',
    severity: 'warn',
    check: (doc) =>
      doc.tokens > 5000
        ? [finding(`CLAUDE.md is ${doc.tokens} tokens; trim non-essential context above 5000 tokens.`)]
        : [],
  },
  {
    id: 'token-bloat-extreme',
    category: 'token-bloat',
    severity: 'error',
    check: (doc) =>
      doc.tokens > 15000
        ? [finding(`CLAUDE.md is ${doc.tokens} tokens; split or aggressively trim files above 15000 tokens.`)]
        : [],
  },
  {
    id: 'rule-overload',
    category: 'rule-overload',
    severity: 'warn',
    check: (doc) =>
      doc.rules.length > 50
        ? [finding(`${doc.rules.length} extracted rules; consolidate rules above 50.`)]
        : [],
  },
  {
    id: 'verbose-rule',
    category: 'verbose',
    severity: 'warn',
    check: (doc) =>
      doc.rules
        .filter((rule) => rule.text.length > 200)
        .map((rule) =>
          finding('Rule is over 200 characters; split or trim it.', {
            line: rule.line,
            ruleText: rule.text,
            suggestion: 'Keep each rule short enough to scan quickly.',
          }),
        ),
  },
  {
    id: 'vague-rule',
    category: 'vague',
    severity: 'info',
    check: (doc) => {
      const vagueStartRe = /^(?:be |try to |do your best|as needed|when appropriate)/i;
      const vagueWordRe = /\b(?:helpful|smart)\b/i;
      return doc.rules
        .filter((rule) => vagueStartRe.test(rule.text) || vagueWordRe.test(rule.text))
        .map((rule) =>
          finding('Rule is vague; describe a concrete behavior.', {
            line: rule.line,
            ruleText: rule.text,
          }),
        );
    },
  },
  {
    id: 'emphasis-spam',
    category: 'counterproductive',
    severity: 'warn',
    check: (doc) => {
      if (doc.rules.length === 0) return [];
      const emphasized = doc.rules.filter((rule) => rule.emphasized).length;
      return emphasized / doc.rules.length > 0.3
        ? [finding(`${emphasized}/${doc.rules.length} rules are emphasized; when everything is important, nothing is.`)]
        : [];
    },
  },
  {
    id: 'allcaps-shout',
    category: 'counterproductive',
    severity: 'info',
    check: (doc) =>
      doc.rules
        .filter((rule) => rule.text.length > 40 && rule.text === rule.text.toUpperCase() && /[A-Z]/.test(rule.text))
        .map((rule) =>
          finding('Rule is an all-caps shout; rewrite it in normal sentence case.', {
            line: rule.line,
            ruleText: rule.text,
          }),
        ),
  },
  {
    id: 'contradiction',
    category: 'conflict',
    severity: 'error',
    check: (doc) => {
      const always = new Map<string, RuleMatch>();
      const never = new Map<string, RuleMatch>();

      for (const rule of doc.rules) {
        const noun = normalizeNoun(rule.text);
        if (!noun) continue;

        const match = finding(`Conflicting rule around "${noun}".`, {
          line: rule.line,
          ruleText: rule.text,
        });
        if (/^always\b/i.test(rule.text)) always.set(noun, match);
        if (/^(?:never|don't|do not)\b/i.test(rule.text)) never.set(noun, match);
      }

      const findings: RuleMatch[] = [];
      for (const [noun, match] of always.entries()) {
        if (never.has(noun)) findings.push(match);
      }
      return findings;
    },
  },
  {
    id: 'missing-tone',
    category: 'missing-best-practice',
    severity: 'info',
    check: (doc) =>
      hasSection(doc, /(?:tone|style|communication)/i)
        ? []
        : [finding('Add a Tone, Style, or Communication section.')],
  },
  {
    id: 'missing-tool-policy',
    category: 'missing-best-practice',
    severity: 'info',
    check: (doc) =>
      hasSection(doc, /(?:tools|tooling|commands)/i)
        ? []
        : [finding('Add a Tools, Tooling, or Commands section.')],
  },
];
