import chalk from 'chalk';
import type { DoctorReport, Finding, Severity } from './types.js';

const SEVERITY_ORDER: Record<Severity, number> = {
  error: 0,
  warn: 1,
  info: 2,
};

const SEVERITY_HEADINGS: Record<Severity, string> = {
  error: 'Errors',
  warn: 'Warnings',
  info: 'Info',
};

const TEXT_SEVERITY: Record<Severity, string> = {
  error: 'ERROR',
  warn: 'WARN',
  info: 'INFO',
};

function sortedFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

function colorSeverity(severity: Severity, text: string): string {
  if (severity === 'error') return chalk.red(text);
  if (severity === 'warn') return chalk.yellow(text);
  return chalk.cyan(text);
}

export function renderMd(report: DoctorReport): string {
  const lines = [
    '# CLAUDE.md doctor report',
    '',
    `**File:** ${report.file}  ·  **Tokens:** ${report.tokens}  ·  **Rules:** ${report.ruleCount}  ·  **Lines:** ${report.lineCount}  ·  **LLM:** ${
      report.meta.llmUsed ? 'yes' : 'no'
    }  ·  **Ruleset:** ${report.meta.rulesetVersion}`,
    '',
    `**Errors:** ${report.summary.errors}  ·  **Warnings:** ${report.summary.warnings}  ·  **Info:** ${report.summary.infos}`,
    '',
    '## Findings',
  ];

  if (report.findings.length === 0) {
    lines.push('', 'No issues found.');
    return lines.join('\n').trimEnd();
  }

  for (const severity of ['error', 'warn', 'info'] as const) {
    const severityFindings = sortedFindings(report.findings).filter((finding) => finding.severity === severity);
    if (severityFindings.length === 0) continue;

    lines.push('', `### ${SEVERITY_HEADINGS[severity]}`);
    for (const finding of severityFindings) {
      const lineSuffix = finding.line === undefined ? '' : ` _(line ${finding.line})_`;
      lines.push(`- **[${finding.category}]** ${finding.message}${lineSuffix}`);
      if (finding.ruleText) lines.push(`  - rule: \`"${finding.ruleText}"\``);
      if (finding.suggestion) lines.push(`  - fix: ${finding.suggestion}`);
      lines.push(`  - source: ${finding.source}`);
    }
  }

  return lines.join('\n').trimEnd();
}

export function renderText(report: DoctorReport): string {
  const lines = [chalk.bold(`claudoctor — ${report.file}`)];

  if (report.findings.length === 0) {
    lines.push(chalk.green('No issues found.'));
  }

  for (const finding of sortedFindings(report.findings)) {
    const label = colorSeverity(finding.severity, TEXT_SEVERITY[finding.severity]);
    const lineSuffix = finding.line === undefined ? '' : ` (line ${finding.line})`;
    lines.push(`${label} [${finding.category}] ${finding.message}${lineSuffix}`);
  }

  lines.push(
    `${report.summary.errors} errors, ${report.summary.warnings} warnings, ${report.summary.infos} infos · ruleset ${report.meta.rulesetVersion} · llm: ${
      report.meta.llmUsed ? 'yes' : 'no'
    }`,
  );

  return lines.join('\n').trimEnd();
}

export function renderJson(report: DoctorReport): string {
  return JSON.stringify(report, null, 2);
}
