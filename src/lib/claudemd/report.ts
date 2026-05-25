import chalk from 'chalk';
import type { DoctorReport, Finding, Severity } from './types.js';

const SEVERITY_ORDER: Record<Severity, number> = {
  error: 0,
  warn: 1,
  info: 2,
};

const MD_SEVERITY: Record<Severity, string> = {
  error: '🔴',
  warn: '🟡',
  info: '🔵',
};

const TEXT_SEVERITY: Record<Severity, string> = {
  error: 'ERR',
  warn: 'WARN',
  info: 'INFO',
};

function formatTokens(tokens: number): string {
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`;
  return String(tokens);
}

function sortedFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

function quoteMarkdown(text: string): string {
  return text
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
}

function colorSeverity(severity: Severity, text: string): string {
  if (severity === 'error') return chalk.red(text);
  if (severity === 'warn') return chalk.yellow(text);
  return chalk.cyan(text);
}

export function renderMd(report: DoctorReport): string {
  const lines = [
    '# CLAUDE.md Doctor Report',
    '',
    `**File**: \`${report.file}\``,
    `**Tokens**: ${formatTokens(report.tokens)}  •  **Rules**: ${report.ruleCount}  •  **Lines**: ${report.lineCount}`,
    `**LLM cross-check**: ${report.meta.llmUsed ? 'enabled' : 'disabled'}`,
    `**Ruleset**: ${report.meta.rulesetVersion}`,
    '',
    '## Summary',
    `- 🔴 Errors: ${report.summary.errors}`,
    `- 🟡 Warnings: ${report.summary.warnings}`,
    `- 🔵 Info: ${report.summary.infos}`,
    '',
    '## Findings',
    '',
  ];

  const findings = sortedFindings(report.findings);
  if (findings.length === 0) {
    lines.push('_No issues found. Your CLAUDE.md looks healthy._');
    return lines.join('\n');
  }

  for (const finding of findings) {
    lines.push(`### ${MD_SEVERITY[finding.severity]} ${finding.message} (${finding.id})`);
    lines.push(
      `**Category**: ${finding.category} · **Source**: ${finding.source}${
        finding.line === undefined ? '' : ` · **Line**: ${finding.line}`
      }`,
    );
    lines.push('');
    if (finding.ruleText) {
      lines.push(quoteMarkdown(finding.ruleText));
      lines.push('');
    }
    if (finding.suggestion) {
      lines.push(finding.suggestion);
      lines.push('');
    }
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

export function renderText(report: DoctorReport): string {
  const lines = [
    `CLAUDE.md doctor — ${report.file}`,
    `${formatTokens(report.tokens)} tokens · ${report.ruleCount} rules · ${report.lineCount} lines · llm=${
      report.meta.llmUsed ? 'on' : 'off'
    } · ruleset ${report.meta.rulesetVersion}`,
    '',
  ];

  for (const finding of sortedFindings(report.findings)) {
    const label = colorSeverity(finding.severity, TEXT_SEVERITY[finding.severity]);
    const lineSuffix = finding.line === undefined ? '' : ` (line ${finding.line})`;
    lines.push(`${label} ${finding.id}  ${finding.message}${lineSuffix}`);
    if (finding.ruleText) lines.push(`                         > "${finding.ruleText}"`);
    if (finding.suggestion) lines.push(`                         suggest: ${finding.suggestion}`);
  }

  if (report.findings.length > 0) lines.push('');
  lines.push(
    `${report.summary.errors} errors · ${report.summary.warnings} warnings · ${report.summary.infos} infos`,
  );

  return lines.join('\n');
}

export function renderJson(report: DoctorReport): string {
  return JSON.stringify(report, null, 2);
}
