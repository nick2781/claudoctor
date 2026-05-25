import type { ClaudeMd, Finding } from './types.js';

export const RULESET_VERSION = '0.1.0';

export function runRules(_doc: ClaudeMd): Finding[] {
  throw new Error('runRules: not implemented (codex-worker-1)');
}
