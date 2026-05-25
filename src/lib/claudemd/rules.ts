import type { ClaudeMd, Finding } from './types.js';
import { ruleset } from './rules.data.js';

export const RULESET_VERSION = '0.1.0';

export function runRules(doc: ClaudeMd): Finding[] {
  return ruleset.flatMap((rule) =>
    rule
      .check(doc)
      .filter((result) => result.matched)
      .map((result) => ({
        id: rule.id,
        severity: rule.severity,
        category: rule.category,
        message: result.message,
        line: result.line,
        ruleText: result.ruleText,
        suggestion: result.suggestion,
        source: 'rules',
      })),
  );
}
