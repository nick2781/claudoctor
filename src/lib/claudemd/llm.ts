import Anthropic from '@anthropic-ai/sdk';
import type { Category, ClaudeMd, Finding, LlmOptions, Severity } from './types.js';

const VALID_CATEGORIES = new Set<Category>([
  'token-bloat',
  'rule-overload',
  'verbose',
  'vague',
  'counterproductive',
  'conflict',
  'missing-best-practice',
  'structural',
]);

const VALID_SEVERITIES = new Set<Severity>(['error', 'warn', 'info']);

const SYSTEM_PROMPT = `You are a CLAUDE.md auditor. Find issues in the instructions file that rule-based checks may miss.
Focus on missing best practices, rules that are too verbose, and wording that may be counterproductive.
Return only a strict JSON array with objects shaped as:
[{ "id": string, "severity": "error"|"warn"|"info", "category": Category, "message": string, "line"?: number, "ruleText"?: string, "suggestion"?: string }]
Category must be one of: token-bloat, rule-overload, verbose, vague, counterproductive, conflict, missing-best-practice, structural.`;

interface LlmFindingCandidate {
  id?: unknown;
  severity?: unknown;
  category?: unknown;
  message?: unknown;
  line?: unknown;
  ruleText?: unknown;
  suggestion?: unknown;
}

function buildUserPrompt(doc: ClaudeMd, rulesFindings: Finding[]): string {
  const rulesSummary =
    rulesFindings.length === 0
      ? 'No rule-based findings.'
      : rulesFindings.map((finding) => `- ${finding.id}: ${finding.message}`).join('\n');

  return `Rule-based findings summary:
${rulesSummary}

Full CLAUDE.md content (truncated to roughly 8000 tokens):
${doc.body.slice(0, 32000)}

Return only the JSON array.`;
}

function toFinding(candidate: LlmFindingCandidate): Finding | undefined {
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.message !== 'string' ||
    typeof candidate.severity !== 'string' ||
    typeof candidate.category !== 'string'
  ) {
    return undefined;
  }
  if (!VALID_SEVERITIES.has(candidate.severity as Severity)) return undefined;
  if (!VALID_CATEGORIES.has(candidate.category as Category)) return undefined;

  return {
    id: candidate.id,
    severity: candidate.severity as Severity,
    category: candidate.category as Category,
    message: candidate.message,
    source: 'llm',
    ...(typeof candidate.line === 'number' ? { line: candidate.line } : {}),
    ...(typeof candidate.ruleText === 'string' ? { ruleText: candidate.ruleText } : {}),
    ...(typeof candidate.suggestion === 'string' ? { suggestion: candidate.suggestion } : {}),
  };
}

export async function runLlm(doc: ClaudeMd, rulesFindings: Finding[], opts: LlmOptions): Promise<Finding[]> {
  try {
    const anthropic = new Anthropic({ apiKey: opts.apiKey });
    const response = await anthropic.messages.create({
      model: opts.model,
      max_tokens: 2048,
      temperature: 0,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: buildUserPrompt(doc, rulesFindings) }],
    });

    const text = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => (typeof item === 'object' && item !== null ? toFinding(item) : undefined))
      .filter((finding): finding is Finding => finding !== undefined);
  } catch {
    return [];
  }
}
