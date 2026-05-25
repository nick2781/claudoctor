import { existsSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { parseClaudeMd } from '../lib/claudemd/parse.js';
import { runRules, RULESET_VERSION } from '../lib/claudemd/rules.js';
import { runLlm } from '../lib/claudemd/llm.js';
import { renderMd, renderText, renderJson } from '../lib/claudemd/report.js';
import type { DoctorReport, Finding } from '../lib/claudemd/types.js';

export interface ClaudemdOptions {
  json?: boolean;
  md?: boolean;
  text?: boolean;
  llm?: boolean;
  model?: string;
  output?: string;
}

function resolveDefaultPath(): string | undefined {
  const candidates = [
    resolve(process.cwd(), 'CLAUDE.md'),
    resolve(homedir(), '.claude', 'CLAUDE.md'),
  ];
  return candidates.find((p) => existsSync(p));
}

function summarize(findings: Finding[]): DoctorReport['summary'] {
  return {
    errors: findings.filter((f) => f.severity === 'error').length,
    warnings: findings.filter((f) => f.severity === 'warn').length,
    infos: findings.filter((f) => f.severity === 'info').length,
  };
}

export async function runClaudemd(pathArg: string | undefined, opts: ClaudemdOptions): Promise<void> {
  const target = pathArg ? resolve(pathArg) : resolveDefaultPath();
  if (!target) {
    process.stderr.write('claudoctor: no CLAUDE.md found (tried ./CLAUDE.md and ~/.claude/CLAUDE.md). Pass a path explicitly.\n');
    process.exit(2);
  }
  if (!existsSync(target)) {
    process.stderr.write(`claudoctor: file not found: ${target}\n`);
    process.exit(2);
  }

  const doc = await parseClaudeMd(target);
  const rulesFindings = runRules(doc);

  let llmFindings: Finding[] = [];
  let llmUsed = false;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const llmRequested = opts.llm === true || (opts.llm !== false && !!apiKey);
  if (llmRequested) {
    if (!apiKey) {
      process.stderr.write('[claudoctor] --llm requested but ANTHROPIC_API_KEY is not set; skipping.\n');
    } else {
      try {
        llmFindings = await runLlm(doc, rulesFindings, { apiKey, model: opts.model ?? 'claude-haiku-4-5-20251001' });
        llmUsed = true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        process.stderr.write(`[claudoctor] LLM cross-check failed: ${msg}\n`);
      }
    }
  }

  const findings = [...rulesFindings, ...llmFindings];
  const report: DoctorReport = {
    file: target,
    tokens: doc.tokens,
    ruleCount: doc.rules.length,
    lineCount: doc.lineCount,
    findings,
    summary: summarize(findings),
    meta: { llmUsed, rulesetVersion: RULESET_VERSION },
  };

  const format = opts.json ? 'json' : opts.text ? 'text' : 'md';
  const rendered =
    format === 'json' ? renderJson(report) : format === 'text' ? renderText(report) : renderMd(report);

  if (opts.output) {
    writeFileSync(opts.output, rendered + (rendered.endsWith('\n') ? '' : '\n'), 'utf8');
    process.stderr.write(`claudoctor: report written to ${opts.output}\n`);
  } else {
    process.stdout.write(rendered + (rendered.endsWith('\n') ? '' : '\n'));
  }

  if (report.summary.errors > 0) process.exit(1);
}
