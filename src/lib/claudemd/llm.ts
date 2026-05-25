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
const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warn: 1, info: 2 };

const SYSTEM_PROMPT = `You are a CLAUDE.md auditor. Find issues in the instructions file that rule-based checks may miss.
Focus on missing best practices, rules that are too verbose, and wording that may be counterproductive.
Return only one strict JSON object shaped as:
{ "findings": [{ "severity": "error"|"warn"|"info", "category": Category, "message": string, "line"?: number, "ruleText"?: string, "suggestion"?: string }] }
Category must be one of: token-bloat, rule-overload, verbose, vague, counterproductive, conflict, missing-best-practice, structural.`;

interface LlmFindingCandidate {
  severity?: unknown;
  category?: unknown;
  message?: unknown;
  line?: unknown;
  ruleText?: unknown;
  suggestion?: unknown;
}

function truncateBody(body: string, tokens: number): string {
  if (tokens <= 12000) return body;
  const maxChars = 12000 * 4;
  if (body.length <= maxChars) return body;

  const marker = '\n\n[... middle content omitted for length ...]\n\n';
  const keepChars = Math.max(0, maxChars - marker.length);
  const headChars = Math.ceil(keepChars / 2);
  const tailChars = Math.floor(keepChars / 2);
  return `${body.slice(0, headChars)}${marker}${body.slice(-tailChars)}`;
}

function buildUserPrompt(doc: ClaudeMd, rulesFindings: Finding[]): string {
  const rulesSummary = rulesFindings.length === 0 ? 'none' : rulesFindings.map((finding) => finding.id).join(', ');
  return `Rule-based finding ids to avoid duplicating:
${rulesSummary}

CLAUDE.md content (middle omitted if larger than roughly 12000 tokens):
${truncateBody(doc.body, doc.tokens)}

Return only the JSON object.`;
}

function invalidResponse(text: string): Error {
  return new Error(`Invalid LLM JSON response: ${text.slice(0, 200)}`);
}

function firstJsonObject(text: string): string {
  const start = text.indexOf('{');
  if (start === -1) throw invalidResponse(text);

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\' && inString) {
      escaped = true;
      continue;
    }
    if (char === '"') inString = !inString;
    if (inString) continue;
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  throw invalidResponse(text);
}

function parseResponse(text: string): LlmFindingCandidate[] {
  try {
    const parsed: unknown = JSON.parse(firstJsonObject(text));
    if (typeof parsed !== 'object' || parsed === null || !('findings' in parsed)) throw invalidResponse(text);
    const response = parsed as { findings: unknown };
    if (!Array.isArray(response.findings)) throw invalidResponse(text);
    return response.findings.filter(
      (item): item is LlmFindingCandidate => typeof item === 'object' && item !== null,
    );
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Invalid LLM JSON response:')) throw error;
    throw invalidResponse(text);
  }
}

function toFinding(candidate: LlmFindingCandidate, index: number): Finding | undefined {
  if (
    typeof candidate.message !== 'string' ||
    typeof candidate.severity !== 'string' ||
    typeof candidate.category !== 'string'
  ) {
    return undefined;
  }
  if (!VALID_SEVERITIES.has(candidate.severity as Severity)) return undefined;
  if (!VALID_CATEGORIES.has(candidate.category as Category)) return undefined;

  const category = candidate.category as Category;
  return {
    id: `llm-${category}-${index}`,
    severity: candidate.severity as Severity,
    category,
    message: candidate.message,
    source: 'llm',
    ...(typeof candidate.line === 'number' ? { line: candidate.line } : {}),
    ...(typeof candidate.ruleText === 'string' ? { ruleText: candidate.ruleText } : {}),
    ...(typeof candidate.suggestion === 'string' ? { suggestion: candidate.suggestion } : {}),
  };
}

export async function runLlm(doc: ClaudeMd, rulesFindings: Finding[], opts: LlmOptions): Promise<Finding[]> {
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
    .join('\n');

  return parseResponse(text)
    .map((item, index) => ({ finding: toFinding(item, index), index }))
    .filter((item): item is { finding: Finding; index: number } => item.finding !== undefined)
    .sort((a, b) => SEVERITY_ORDER[a.finding.severity] - SEVERITY_ORDER[b.finding.severity] || a.index - b.index)
    .slice(0, 20)
    .map((item) => item.finding);
}
