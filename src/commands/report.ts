import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { analyze } from '../lib/analyze.js';
import { parseClaudeMd } from '../lib/claudemd/parse.js';
import { runRules, RULESET_VERSION } from '../lib/claudemd/rules.js';
import type { DoctorReport, Finding } from '../lib/claudemd/types.js';
import { renderHtmlReport, renderJsonReport, renderMarkdownReport, type CombinedReport } from '../lib/combined-report.js';
import { discover } from '../lib/discover.js';
import { defaultSources } from '../lib/sources.js';

export interface ReportOptions {
  format?: string;
  output?: string;
}

function resolveDefaultClaudeMd(): string | undefined {
  const candidates = [
    resolve(process.cwd(), 'CLAUDE.md'),
    resolve(homedir(), '.claude', 'CLAUDE.md'),
  ];
  return candidates.find((p) => existsSync(p));
}

function summarize(findings: Finding[]): DoctorReport['summary'] {
  return {
    errors: findings.filter((finding) => finding.severity === 'error').length,
    warnings: findings.filter((finding) => finding.severity === 'warn').length,
    infos: findings.filter((finding) => finding.severity === 'info').length,
  };
}

async function buildClaudeMdReport(): Promise<DoctorReport | undefined> {
  const target = resolveDefaultClaudeMd();
  if (!target) return undefined;

  const doc = await parseClaudeMd(target);
  const findings = runRules(doc);
  return {
    file: target,
    tokens: doc.tokens,
    ruleCount: doc.rules.length,
    lineCount: doc.lineCount,
    findings,
    summary: summarize(findings),
    meta: { llmUsed: false, rulesetVersion: RULESET_VERSION },
  };
}

function normalizeFormat(value: string | undefined): 'html' | 'json' | 'md' {
  if (value === undefined || value === 'md') return 'md';
  if (value === 'html' || value === 'json') return value;
  throw new Error(`unsupported report format: ${value}`);
}

function writeOutput(target: string, rendered: string): void {
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, rendered + (rendered.endsWith('\n') ? '' : '\n'), 'utf8');
  process.stderr.write(`claudoctor: report written to ${target}\n`);
}

export async function createCombinedReport(): Promise<CombinedReport> {
  const skills = await discover(defaultSources());
  return {
    generatedAt: new Date().toISOString(),
    claudemd: await buildClaudeMdReport(),
    skills: analyze(skills),
  };
}

export async function runReport(opts: ReportOptions): Promise<void> {
  const format = normalizeFormat(opts.format);
  const report = await createCombinedReport();
  const rendered =
    format === 'html'
      ? renderHtmlReport(report)
      : format === 'json'
        ? renderJsonReport(report)
        : renderMarkdownReport(report);

  const output = opts.output ?? (format === 'html' ? 'report.html' : undefined);
  if (output) {
    writeOutput(output, rendered);
  } else {
    process.stdout.write(rendered + (rendered.endsWith('\n') ? '' : '\n'));
  }
}
