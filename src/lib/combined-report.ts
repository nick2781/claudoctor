import { pathToFileURL } from 'node:url';
import type { Analysis, ConflictGroup, DuplicateGroup, NearDuplicateGroup, OverlapPair } from './analyze.js';
import type { DoctorReport, Severity } from './claudemd/types.js';
import type { Skill } from './discover.js';

export interface CombinedReport {
  generatedAt: string;
  claudemd?: DoctorReport;
  skills: Analysis;
}

interface ReportFinding {
  severity: Severity;
  title: string;
  detail: string;
  links?: Skill[];
}

interface ReportSummary {
  errors: number;
  warnings: number;
  infos: number;
}

const SEVERITY_LABEL: Record<Severity, string> = {
  error: 'error',
  warn: 'warning',
  info: 'info',
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function markdownEscape(value: string): string {
  return value.replaceAll('|', '\\|');
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function fileLink(skill: Skill): string {
  return pathToFileURL(skill.file).href;
}

function claudemdFindings(report: CombinedReport): ReportFinding[] {
  return (report.claudemd?.findings ?? []).map((finding) => ({
    severity: finding.severity,
    title: `[${finding.category}] ${finding.message}`,
    detail: finding.line === undefined ? `source: ${finding.source}` : `line ${finding.line} · source: ${finding.source}`,
  }));
}

function conflictFinding(conflict: ConflictGroup): ReportFinding {
  return {
    severity: 'warn',
    title: `Name conflict: ${conflict.name}`,
    detail: `${conflict.variants.length} variants share a name but differ in content (${formatTokens(conflict.tokens)} tokens).`,
    links: conflict.variants,
  };
}

function overlapFinding(overlap: OverlapPair): ReportFinding {
  const body = overlap.bodySimilarity === undefined ? '' : ` · body ${overlap.bodySimilarity.toFixed(2)}`;
  return {
    severity: 'warn',
    title: `Overlap: ${overlap.a.name} / ${overlap.b.name}`,
    detail: `similarity ${overlap.similarity.toFixed(2)} · desc ${overlap.descSimilarity.toFixed(2)}${body} · save about ${formatTokens(overlap.smallerTokens)} tokens`,
    links: [overlap.a, overlap.b],
  };
}

function tokenFinding(skills: Skill[]): ReportFinding | undefined {
  const [largest] = [...skills].sort((a, b) => b.tokens - a.tokens);
  if (!largest) return undefined;
  return {
    severity: 'info',
    title: `Largest skill: ${largest.name}`,
    detail: `${formatTokens(largest.tokens)} tokens in ${largest.relPath}`,
    links: [largest],
  };
}

function skillsFindings(report: CombinedReport): ReportFinding[] {
  const findings = [
    ...report.skills.conflicts.map(conflictFinding),
    ...report.skills.overlaps.slice(0, 10).map(overlapFinding),
  ];
  const largest = tokenFinding(report.skills.skills);
  if (largest) findings.push(largest);
  return findings;
}

function duplicateFinding(group: DuplicateGroup): ReportFinding {
  return {
    severity: 'error',
    title: `Exact duplicate: ${group.name}`,
    detail: `${group.copies.length} copies waste about ${formatTokens(group.wastedTokens)} tokens.`,
    links: group.copies,
  };
}

function nearDuplicateFinding(group: NearDuplicateGroup): ReportFinding {
  return {
    severity: 'warn',
    title: `Near duplicate: ${group.name}`,
    detail: `${group.variants.length} variants share the same body with different frontmatter; waste about ${formatTokens(group.wastedTokens)} tokens.`,
    links: group.variants,
  };
}

function duplicateFindings(report: CombinedReport): ReportFinding[] {
  return [
    ...report.skills.duplicates.map(duplicateFinding),
    ...report.skills.nearDuplicates.map(nearDuplicateFinding),
  ];
}

function summary(report: CombinedReport): ReportSummary {
  const counts: ReportSummary = { errors: 0, warnings: 0, infos: 0 };
  for (const finding of [
    ...claudemdFindings(report),
    ...skillsFindings(report),
    ...duplicateFindings(report),
  ]) {
    if (finding.severity === 'error') counts.errors++;
    if (finding.severity === 'warn') counts.warnings++;
    if (finding.severity === 'info') counts.infos++;
  }
  return counts;
}

function renderLinks(skills: Skill[] | undefined): string {
  if (!skills || skills.length === 0) return '';
  return [
    '<ul class="source-list">',
    ...skills.map(
      (skill) =>
        `<li><a href="${escapeHtml(fileLink(skill))}">${escapeHtml(skill.agent)}: ${escapeHtml(skill.relPath)}</a></li>`,
    ),
    '</ul>',
  ].join('');
}

function renderFindingCard(finding: ReportFinding): string {
  return [
    `<article class="finding finding-${finding.severity}">`,
    `<div class="finding-top"><span class="severity">${escapeHtml(SEVERITY_LABEL[finding.severity])}</span><h3>${escapeHtml(finding.title)}</h3></div>`,
    `<p>${escapeHtml(finding.detail)}</p>`,
    renderLinks(finding.links),
    '</article>',
  ].join('');
}

function renderEmpty(message: string): string {
  return `<p class="empty">${escapeHtml(message)}</p>`;
}

function renderPanel(className: string, title: string, findings: ReportFinding[], emptyMessage: string): string {
  return [
    `<section class="panel ${className}">`,
    `<h2>${escapeHtml(title)}</h2>`,
    findings.length === 0 ? renderEmpty(emptyMessage) : findings.map(renderFindingCard).join('\n'),
    '</section>',
  ].join('\n');
}

export function renderHtmlReport(report: CombinedReport): string {
  const counts = summary(report);
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>claudoctor report</title>',
    '<style>',
    ':root{color-scheme:light dark;--bg:#f7f7f4;--text:#202124;--muted:#62665f;--panel:#ffffff;--line:#dadbd3;--error:#b42318;--warn:#a15c07;--info:#1769aa;--link:#0f5f8f}',
    '@media (prefers-color-scheme:dark){:root{--bg:#151716;--text:#ecefe8;--muted:#aeb4aa;--panel:#202320;--line:#3b403a;--error:#ff8a80;--warn:#ffbf69;--info:#83c5ff;--link:#8bd3ff}}',
    '*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.5 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}a{color:var(--link);overflow-wrap:anywhere}.report-header{padding:28px 32px 20px;border-bottom:1px solid var(--line)}h1{margin:0 0 8px;font-size:30px;line-height:1.1}h2{margin:0 0 16px;font-size:18px}.meta{margin:0;color:var(--muted)}.summary{display:flex;gap:12px;flex-wrap:wrap;margin-top:20px}.summary div{min-width:120px;border:1px solid var(--line);background:var(--panel);border-radius:8px;padding:10px 12px}.summary strong{display:block;color:var(--muted);font-size:12px;text-transform:uppercase}.summary span{display:block;font-size:28px;font-weight:700}.report-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;padding:20px 32px 32px}.panel{min-width:0}.finding{border:1px solid var(--line);border-radius:8px;background:var(--panel);padding:14px;margin:0 0 12px}.finding-top{display:flex;gap:10px;align-items:flex-start}.finding h3{margin:0;font-size:15px;line-height:1.35}.finding p{margin:8px 0 0;color:var(--muted)}.severity{flex:none;border:1px solid currentColor;border-radius:999px;padding:1px 7px;font-size:11px;text-transform:uppercase}.finding-error .severity{color:var(--error)}.finding-warn .severity{color:var(--warn)}.finding-info .severity{color:var(--info)}.source-list{margin:10px 0 0;padding-left:18px;color:var(--muted)}.empty{color:var(--muted);border:1px dashed var(--line);border-radius:8px;padding:16px}.report-footer{padding:0 32px 28px;color:var(--muted)}@media (max-width:920px){.report-header,.report-grid,.report-footer{padding-left:18px;padding-right:18px}.report-grid{grid-template-columns:1fr}}',
    '</style>',
    '<script>document.documentElement.dataset.ready="true";</script>',
    '</head>',
    '<body>',
    '<header class="report-header">',
    '<h1>claudoctor report</h1>',
    `<p class="meta">Generated ${escapeHtml(report.generatedAt)} · ${report.skills.totalSkills} skills · ${formatTokens(report.skills.totalTokens)} skill tokens</p>`,
    '<div class="summary">',
    `<div><strong>Errors</strong><span>${counts.errors}</span></div>`,
    `<div><strong>Warnings</strong><span>${counts.warnings}</span></div>`,
    `<div><strong>Info</strong><span>${counts.infos}</span></div>`,
    '</div>',
    '</header>',
    '<main class="report-grid">',
    renderPanel('panel-claudemd', 'CLAUDE.md findings', claudemdFindings(report), 'No CLAUDE.md findings.'),
    renderPanel('panel-skills', 'Skills findings', skillsFindings(report), 'No skill conflicts, overlap, or token-rank findings.'),
    renderPanel('panel-duplicates', 'Duplicates', duplicateFindings(report), 'No exact or near duplicates.'),
    '</main>',
    '<footer class="report-footer">',
    `Estimated savings: ${formatTokens(report.skills.savings.totalEstimated)} tokens`,
    '</footer>',
    '</body>',
    '</html>',
  ].join('\n');
}

function markdownFinding(finding: ReportFinding): string[] {
  const lines = [`- **${finding.severity}** ${markdownEscape(finding.title)} — ${markdownEscape(finding.detail)}`];
  for (const skill of finding.links ?? []) {
    lines.push(`  - [${markdownEscape(`${skill.agent}: ${skill.relPath}`)}](${fileLink(skill)})`);
  }
  return lines;
}

function markdownSection(title: string, findings: ReportFinding[], emptyMessage: string): string[] {
  return [
    `## ${title}`,
    '',
    ...(findings.length === 0
      ? [emptyMessage]
      : findings.flatMap((finding) => markdownFinding(finding))),
    '',
  ];
}

export function renderMarkdownReport(report: CombinedReport): string {
  const counts = summary(report);
  return [
    '# claudoctor report',
    '',
    `Generated ${report.generatedAt}. Scanned ${report.skills.totalSkills} skills (${formatTokens(report.skills.totalTokens)} tokens).`,
    '',
    `**Errors:** ${counts.errors} · **Warnings:** ${counts.warnings} · **Info:** ${counts.infos}`,
    '',
    ...markdownSection('CLAUDE.md findings', claudemdFindings(report), 'No CLAUDE.md findings.'),
    ...markdownSection('Skills findings', skillsFindings(report), 'No skill conflicts, overlap, or token-rank findings.'),
    ...markdownSection('Duplicates', duplicateFindings(report), 'No exact or near duplicates.'),
    `Estimated savings: ${formatTokens(report.skills.savings.totalEstimated)} tokens`,
  ].join('\n').trimEnd();
}

export function renderJsonReport(report: CombinedReport): string {
  return JSON.stringify(report, null, 2);
}
