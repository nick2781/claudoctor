import type { ClaudeMd, Finding, LlmOptions } from './types.js';

export async function runLlm(_doc: ClaudeMd, _rulesFindings: Finding[], _opts: LlmOptions): Promise<Finding[]> {
  throw new Error('runLlm: not implemented (codex-worker-2)');
}
