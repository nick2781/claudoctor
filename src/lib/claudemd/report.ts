import chalk from 'chalk';
import type { DoctorReport, Finding, Severity } from './types.js';

const SEVERITY_ORDER: Record<Severity, number> = {
  error: 0,
  warn: 1,
  info: 2,
};

const TEXT_SEVERITY: Record<Severity, string> = {
  error: 'ERROR',
  warn: 'WARN',
  info: 'INFO',
};

const MD_GROUP_LABELS: Record<Severity, string> = {
  error: 'Errors',
  warn: 'Warnings',
  info: 'Info',
};

function sortedFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

function colorSeverity(severity: Severity, text: string): string {
  if (severity === 'error') return chalk.red(text);
  if (severity === 'warn') return chalk.yellow(text);
  return chalk.cyan(text);
}

function findingsForSeverity(findings: Finding[], severity: Severity): Finding[] {
  return findings.filter((finding) => finding.severity === severity);
}

function markdownCodeSpan(text: string): string {
  const longestBacktick = Math.max(0, ...Array.from(text.matchAll(/`+/g), (match) => match[0].length));
  const delimiter = '`'.repeat(longestBacktick + 1);
  return `${delimiter}${text}${delimiter}`;
}

export function renderMd(report: DoctorReport): string {
  const lines = [
    '# CLAUDE.md doctor report',
    '',
    `**File:** ${report.file} · ${report.tokens} tokens · ${report.ruleCount} rules · ${report.findings.length} findings`,
    '',
    `**Errors:** ${report.summary.errors} · **Warnings:** ${report.summary.warnings} · **Info:** ${report.summary.infos}`,
    '',
    '## Findings',
  ];

  const findings = sortedFindings(report.findings);
  if (findings.length === 0) {
    lines.push('', 'No issues found.');
    return lines.join('\n').trimEnd();
  }

  for (const severity of ['error', 'warn', 'info'] as const) {
    const group = findingsForSeverity(findings, severity);
    if (group.length === 0) continue;
    lines.push('');
    lines.push(`## ${MD_GROUP_LABELS[severity]}`);
    for (const finding of group) {
      const lineSuffix = finding.line === undefined ? '' : ` _(line ${finding.line})_`;
      lines.push(`- **[${finding.category}]** ${finding.message}${lineSuffix}`);
      if (finding.ruleText) lines.push(`  - rule: ${markdownCodeSpan(`"${finding.ruleText}"`)}`);
      if (finding.suggestion) lines.push(`  - fix: ${finding.suggestion}`);
      lines.push(`  - source: ${finding.source}`);
    }
  }

  return lines.join('\n').trimEnd();
}

export function renderText(report: DoctorReport): string {
  const lines = [
    chalk.bold(`claudoctor — ${report.file}`),
    '',
  ];

  const findings = sortedFindings(report.findings);
  if (findings.length === 0) {
    lines.push(chalk.green('No issues found.'));
  } else {
    for (const finding of findings) {
      const label = colorSeverity(finding.severity, TEXT_SEVERITY[finding.severity]);
      const lineSuffix = finding.line === undefined ? '' : ` (line ${finding.line})`;
      lines.push(`${label} [${finding.category}] ${finding.message}${lineSuffix}`);
    }
  }

  lines.push('');
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
