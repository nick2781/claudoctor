import { ruleset } from './rules.data.js';
import type { ClaudeMd, Finding } from './types.js';

export const RULESET_VERSION = '0.1.0';

export function runRules(doc: ClaudeMd): Finding[] {
  return ruleset.flatMap((rule) =>
    rule.check(doc).map((finding) => ({
      id: rule.id,
      category: rule.category,
      severity: rule.severity,
      source: 'rules',
      ...finding,
    })),
  );
}
