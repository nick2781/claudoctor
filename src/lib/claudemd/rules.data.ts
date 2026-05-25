import type { Category, ClaudeMd, Severity } from './types.js';

export interface RuleCheckResult {
  matched: boolean;
  message: string;
  line?: number;
  ruleText?: string;
  suggestion?: string;
}

export interface RuleSpec {
  id: string;
  category: Category;
  severity: Severity;
  check: (doc: ClaudeMd) => RuleCheckResult[];
}

const vagueLeadPattern = /^(?:be |try to |do your best|as needed|when appropriate)/i;
const vagueSingleWordPattern = /^(?:helpful|smart)[.!?]?$/i;

export const ruleset: RuleSpec[] = [
  {
    id: 'token-bloat',
    category: 'token-bloat',
    severity: 'warn',
    check: (doc) =>
      doc.tokens > 5000
        ? [
            {
              matched: true,
              message: `CLAUDE.md is large (${doc.tokens} tokens).`,
              suggestion: 'Trim repeated context or move reference material out of always-loaded instructions.',
            },
          ]
        : [],
  },
  {
    id: 'token-bloat-extreme',
    category: 'token-bloat',
    severity: 'error',
    check: (doc) =>
      doc.tokens > 15000
        ? [
            {
              matched: true,
              message: `CLAUDE.md is extremely large (${doc.tokens} tokens).`,
              suggestion: 'Split the document and keep only critical operating rules in the root file.',
            },
          ]
        : [],
  },
  {
    id: 'rule-overload',
    category: 'rule-overload',
    severity: 'warn',
    check: (doc) =>
      doc.rules.length > 50
        ? [
            {
              matched: true,
              message: `CLAUDE.md contains ${doc.rules.length} extracted rules.`,
              suggestion: 'Merge overlapping rules and remove low-value instructions.',
            },
          ]
        : [],
  },
  {
    id: 'verbose-rule',
    category: 'verbose',
    severity: 'warn',
    check: (doc) =>
      doc.rules
        .filter((rule) => rule.text.length > 200)
        .map((rule) => ({
          matched: true,
          message: 'Rule is longer than 200 characters.',
          line: rule.line,
          ruleText: rule.text,
          suggestion: 'Split the rule or rewrite it as a short, direct instruction.',
        })),
  },
  {
    id: 'vague-rule',
    category: 'vague',
    severity: 'info',
    check: (doc) =>
      doc.rules
        .filter((rule) => vagueLeadPattern.test(rule.text) || vagueSingleWordPattern.test(rule.text.trim()))
        .map((rule) => ({
          matched: true,
          message: 'Rule is vague and does not name a concrete behavior.',
          line: rule.line,
          ruleText: rule.text,
          suggestion: 'Replace it with a specific action the agent can verify.',
        })),
  },
  {
    id: 'emphasis-spam',
    category: 'counterproductive',
    severity: 'warn',
    check: (doc) => {
      if (doc.rules.length === 0) return [];
      const emphasized = doc.rules.filter((rule) => rule.emphasized).length;
      return emphasized / doc.rules.length > 0.3
        ? [
            {
              matched: true,
              message: `${emphasized} of ${doc.rules.length} rules are emphasized; if everything is important, nothing is important.`,
              suggestion: 'Reserve emphasis for the few instructions that are truly critical.',
            },
          ]
        : [];
    },
  },
  {
    id: 'allcaps-shout',
    category: 'counterproductive',
    severity: 'info',
    check: (doc) =>
      doc.rules
        .filter((rule) => isAllCapsShout(rule.text))
        .map((rule) => ({
          matched: true,
          message: 'Rule is written as a long all-caps line.',
          line: rule.line,
          ruleText: rule.text,
          suggestion: 'Use normal sentence case and keep emphasis targeted.',
        })),
  },
  {
    id: 'contradiction',
    category: 'conflict',
    severity: 'error',
    check: (doc) => findContradictions(doc),
  },
  {
    id: 'missing-tone',
    category: 'missing-best-practice',
    severity: 'info',
    check: (doc) =>
      hasSection(doc, /Tone|Style|Communication/i)
        ? []
        : [
            {
              matched: true,
              message: 'No Tone, Style, or Communication section found.',
              suggestion: 'Add a short section describing expected communication style.',
            },
          ],
  },
  {
    id: 'missing-tool-policy',
    category: 'missing-best-practice',
    severity: 'info',
    check: (doc) =>
      hasSection(doc, /Tools|Tooling|Commands/i)
        ? []
        : [
            {
              matched: true,
              message: 'No Tools, Tooling, or Commands section found.',
              suggestion: 'Add a short section describing tool and command expectations.',
            },
          ],
  },
];

function isAllCapsShout(text: string): boolean {
  const letters = text.replace(/[^A-Za-z]/g, '');
  return text.length > 40 && letters.length > 0 && letters === letters.toUpperCase();
}

function hasSection(doc: ClaudeMd, pattern: RegExp): boolean {
  return doc.sections.some((section) => pattern.test(section.heading));
}

function findContradictions(doc: ClaudeMd): RuleCheckResult[] {
  const positive = new Map<string, { line: number; text: string }>();
  const negative = new Map<string, { line: number; text: string }>();

  for (const rule of doc.rules) {
    const parsed = parseContradictionKey(rule.text);
    if (!parsed) continue;
    const target = parsed.polarity === 'positive' ? positive : negative;
    target.set(parsed.key, { line: rule.line, text: rule.text });
  }

  return [...positive.entries()].flatMap(([key, positiveRule]) => {
    const negativeRule = negative.get(key);
    if (!negativeRule) return [];
    return [
      {
        matched: true,
        message: 'Rule contradicts another imperative instruction.',
        line: negativeRule.line,
        ruleText: `${positiveRule.text} / ${negativeRule.text}`,
        suggestion: 'Choose one policy and remove the conflicting instruction.',
      },
    ];
  });
}

function parseContradictionKey(text: string): { key: string; polarity: 'positive' | 'negative' } | undefined {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9'\s-]/g, '')
    .split(/\s+/)
    .filter(Boolean);

  if (words.length < 3) return undefined;

  if (words[0] === 'always') return keyFrom(words.slice(1), 'positive');
  if (words[0] === 'never') return keyFrom(words.slice(1), 'negative');
  if (words[0] === "don't") return keyFrom(words.slice(1), 'negative');
  if (words[0] === 'do' && words[1] === 'not') return keyFrom(words.slice(2), 'negative');

  return undefined;
}

function keyFrom(
  words: string[],
  polarity: 'positive' | 'negative',
): { key: string; polarity: 'positive' | 'negative' } | undefined {
  const [verb, noun] = words;
  if (!verb || !noun) return undefined;
  return { key: `${verb}:${noun}`, polarity };
}
