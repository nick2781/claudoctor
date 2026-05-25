import Anthropic from '@anthropic-ai/sdk';
import { tokens } from '../tokens.js';
import type { Category, ClaudeMd, Finding, LlmOptions, Severity } from './types.js';

const VALID_CATEGORIES = new Set<Category>([
  'token-bloat', 'rule-overload', 'verbose', 'vague', 'counterproductive', 'conflict', 'missing-best-practice', 'structural',
]);
const VALID_SEVERITIES = new Set<Severity>(['error', 'warn', 'info']);
const SEVERITY_RANK: Record<Severity, number> = { error: 0, warn: 1, info: 2 };
const MAX_DOC_TOKENS = 12_000;
const SYSTEM_PROMPT = `You are reviewing a CLAUDE.md instruction file for gaps deterministic checks may miss.
Return only JSON shaped exactly like:
{ "findings": [{ "category": string, "severity": string, "message": string, "line": number, "ruleText": string, "suggestion": string }] }
Allowed categories: token-bloat, rule-overload, verbose, vague, counterproductive, conflict, missing-best-practice, structural.
Allowed severities: error, warn, info.
Do not duplicate deterministic rule finding IDs supplied by the caller.`;
function truncateDocBody(body: string): string {
  const bodyTokens = tokens(body);
  if (bodyTokens <= MAX_DOC_TOKENS) return body;
  let budget = Math.max(1000, Math.floor((body.length * MAX_DOC_TOKENS) / bodyTokens));
  while (true) {
    const edge = Math.floor(budget / 2);
    const truncated = `${body.slice(0, edge)}\n\n[... middle truncated ...]\n\n${body.slice(-edge)}`;
    if (tokens(truncated) <= MAX_DOC_TOKENS || budget <= 1000) return truncated;
    budget = Math.floor(budget * 0.9);
  }
}
function buildUserPrompt(doc: ClaudeMd, rulesFindings: Finding[]): string {
  return `CLAUDE.md path:
${doc.path}

Deterministic finding IDs to avoid duplicating:
${JSON.stringify(rulesFindings.map((finding) => finding.id))}

CLAUDE.md body:
${truncateDocBody(doc.body)}

Find important gaps in this file that deterministic checks are likely to miss.`;
}
function firstJsonObject(text: string): string | undefined {
  const start = text.indexOf('{');
  if (start === -1) return undefined;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) return text.slice(start, index + 1);
  }
  return undefined;
}
function parseFindings(text: string): unknown[] {
  const jsonText = firstJsonObject(text);
  if (!jsonText) throw new Error(`LLM returned invalid JSON: ${text.slice(0, 200)}`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error(`LLM returned invalid JSON: ${text.slice(0, 200)}`);
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`LLM returned invalid finding shape: ${text.slice(0, 200)}`);
  }
  const findings = (parsed as { findings?: unknown }).findings;
  if (!Array.isArray(findings)) throw new Error(`LLM returned invalid finding shape: ${text.slice(0, 200)}`);
  return findings;
}
function toFinding(item: Record<string, unknown>, index: number): Finding | undefined {
  const { category, severity, message, line, ruleText, suggestion } = item;
  if (typeof category !== 'string' || typeof severity !== 'string' || typeof message !== 'string') return undefined;
  if (!VALID_CATEGORIES.has(category as Category) || !VALID_SEVERITIES.has(severity as Severity)) return undefined;
  return {
    id: `llm-${category}-${index}`,
    category: category as Category,
    severity: severity as Severity,
    message,
    ...(typeof line === 'number' ? { line } : {}),
    ...(typeof ruleText === 'string' ? { ruleText } : {}),
    ...(typeof suggestion === 'string' ? { suggestion } : {}),
    source: 'llm',
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
    .join('\n')
    .trim();
  return parseFindings(text)
    .map((item, index) => (typeof item === 'object' && item !== null ? toFinding(item as Record<string, unknown>, index) : undefined))
    .filter((finding): finding is Finding => finding !== undefined)
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
    .slice(0, 20);
}
