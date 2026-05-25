import { RULES } from './rules.data.js';
import type { ClaudeMd, Finding } from './types.js';

export const RULESET_VERSION = '0.1.0';

export function runRules(doc: ClaudeMd): Finding[] {
  return RULES.flatMap((rule) => {
    const findings = rule.check(doc) ?? [];
    return [...findings].sort((a, b) => (a.line ?? 0) - (b.line ?? 0));
  });
}
