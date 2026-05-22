import chalk from 'chalk';
import Table from 'cli-table3';
import os from 'node:os';
import type { Analysis } from './analyze.js';
import type { Skill } from './discover.js';

function shortPath(p: string): string {
  const home = os.homedir();
  return p.startsWith(home) ? '~' + p.slice(home.length) : p;
}

function fmtTokens(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

function skillLoc(s: Skill): string {
  return shortPath(s.file);
}

export interface RenderOptions {
  top?: number;
}

export function renderText(a: Analysis, opts: RenderOptions = {}): string {
  const top = opts.top ?? 20;
  const lines: string[] = [];

  lines.push(chalk.bold.cyan('claudoctor skills'));
  lines.push(
    `Scanned ${chalk.bold(a.totalSkills)} skills, ${chalk.bold(fmtTokens(a.totalTokens))} tokens total.`
  );

  const agentTbl = new Table({
    head: [chalk.bold('Agent'), 'Skills', 'Tokens'],
    style: { head: [], border: [] },
  });
  for (const [agent, v] of Object.entries(a.byAgent).sort((x, y) => y[1].tokens - x[1].tokens)) {
    agentTbl.push([agent, v.count, fmtTokens(v.tokens)]);
  }
  lines.push('');
  lines.push(chalk.bold('By agent'));
  lines.push(agentTbl.toString());

  const ranked = [...a.skills].sort((x, y) => y.tokens - x.tokens).slice(0, top);
  const tokenTbl = new Table({
    head: [chalk.bold(`Top ${ranked.length} by tokens`), 'Agent', 'Tokens', 'Path'],
    style: { head: [], border: [] },
    colWidths: [28, 10, 10, 60],
    wordWrap: true,
  });
  for (const s of ranked) {
    tokenTbl.push([s.name, s.agent, fmtTokens(s.tokens), skillLoc(s)]);
  }
  lines.push('');
  lines.push(chalk.bold('Token rank'));
  lines.push(tokenTbl.toString());

  lines.push('');
  if (a.duplicates.length === 0) {
    lines.push(chalk.dim('No exact duplicates.'));
  } else {
    lines.push(chalk.bold(`Duplicates (${a.duplicates.length})`));
    const dt = new Table({
      head: [chalk.bold('Name'), 'Copies', 'Per-copy', 'Wasted', 'Locations'],
      style: { head: [], border: [] },
      colWidths: [22, 7, 9, 8, 60],
      wordWrap: true,
    });
    for (const g of a.duplicates) {
      dt.push([
        g.name,
        g.copies.length,
        fmtTokens(g.tokens),
        chalk.yellow(fmtTokens(g.wastedTokens)),
        g.copies.map((c) => `${c.agent}: ${skillLoc(c)}`).join('\n'),
      ]);
    }
    lines.push(dt.toString());
  }

  lines.push('');
  if (a.nearDuplicates.length === 0) {
    lines.push(chalk.dim('No near-duplicates (same body, different frontmatter).'));
  } else {
    lines.push(chalk.bold(`Near-duplicates (${a.nearDuplicates.length})`));
    lines.push(chalk.dim('  Same body bytes, different frontmatter — likely frontmatter drift.'));
    const nt = new Table({
      head: [chalk.bold('Name'), 'Variants', 'Per-copy', 'Wasted', 'Locations'],
      style: { head: [], border: [] },
      colWidths: [22, 9, 9, 8, 60],
      wordWrap: true,
    });
    for (const g of a.nearDuplicates) {
      nt.push([
        g.name,
        g.variants.length,
        fmtTokens(g.tokens),
        chalk.yellow(fmtTokens(g.wastedTokens)),
        g.variants
          .map((v) => `${v.agent} (${v.contentHash.slice(0, 7)}): ${skillLoc(v)}`)
          .join('\n'),
      ]);
    }
    lines.push(nt.toString());
  }

  lines.push('');
  if (a.conflicts.length === 0) {
    lines.push(chalk.dim('No name conflicts.'));
  } else {
    lines.push(chalk.bold(`Conflicts (${a.conflicts.length})`));
    const ct = new Table({
      head: [chalk.bold('Name'), 'Variants', 'Tokens', 'Locations'],
      style: { head: [], border: [] },
      colWidths: [22, 9, 9, 60],
      wordWrap: true,
    });
    for (const c of a.conflicts) {
      ct.push([
        c.name,
        c.variants.length,
        fmtTokens(c.tokens),
        c.variants.map((v) => `${v.agent} (${v.contentHash.slice(0, 7)}): ${skillLoc(v)}`).join('\n'),
      ]);
    }
    lines.push(ct.toString());
  }

  lines.push('');
  if (a.overlaps.length === 0) {
    lines.push(chalk.dim('No overlap above threshold.'));
  } else {
    const overlapHeading =
      a.overlapsTotal > a.overlaps.length
        ? `Overlap (showing top ${a.overlaps.length} of ${a.overlapsTotal})`
        : `Overlap (${a.overlaps.length})`;
    lines.push(chalk.bold(overlapHeading));
    const hasDeep = a.overlaps.some((o) => o.bodySimilarity !== undefined);
    const ot = new Table({
      head: hasDeep
        ? [chalk.bold('Sim'), 'Desc', 'Body', 'A', 'B', 'Save']
        : [chalk.bold('Sim'), 'A', 'B', 'Save'],
      style: { head: [], border: [] },
      colWidths: hasDeep ? [6, 6, 6, 30, 30, 8] : [6, 36, 36, 8],
      wordWrap: true,
    });
    for (const o of a.overlaps) {
      if (hasDeep) {
        ot.push([
          o.similarity.toFixed(2),
          o.descSimilarity.toFixed(2),
          o.bodySimilarity === undefined ? '-' : o.bodySimilarity.toFixed(2),
          `${o.a.name} (${o.a.agent})`,
          `${o.b.name} (${o.b.agent})`,
          fmtTokens(o.smallerTokens),
        ]);
      } else {
        ot.push([
          o.similarity.toFixed(2),
          `${o.a.name} (${o.a.agent})`,
          `${o.b.name} (${o.b.agent})`,
          fmtTokens(o.smallerTokens),
        ]);
      }
    }
    lines.push(ot.toString());
  }

  lines.push('');
  lines.push(chalk.bold('Estimated savings'));
  lines.push(
    `  Duplicates:      ${chalk.yellow(fmtTokens(a.savings.duplicateTokens))} tokens`
  );
  lines.push(
    `  Near-duplicates: ${chalk.yellow(fmtTokens(a.savings.nearDuplicateTokens))} tokens`
  );
  lines.push(
    `  Overlap:         ${chalk.yellow(fmtTokens(a.savings.overlapTokens))} tokens`
  );
  lines.push(
    `  Total:           ${chalk.green.bold(fmtTokens(a.savings.totalEstimated))} tokens`
  );

  return lines.join('\n');
}

export function renderJson(a: Analysis): string {
  const slim = (s: Skill) => ({
    agent: s.agent,
    name: s.name,
    description: s.description,
    file: s.file,
    sourceLabel: s.sourceLabel,
    tokens: s.tokens,
    bytes: s.bytes,
    contentHash: s.contentHash,
    bodyHash: s.bodyHash,
  });
  return JSON.stringify(
    {
      totalSkills: a.totalSkills,
      totalTokens: a.totalTokens,
      byAgent: a.byAgent,
      skills: a.skills.map(slim),
      duplicates: a.duplicates.map((g) => ({
        name: g.name,
        contentHash: g.contentHash,
        tokens: g.tokens,
        wastedTokens: g.wastedTokens,
        copies: g.copies.map(slim),
      })),
      nearDuplicates: a.nearDuplicates.map((g) => ({
        name: g.name,
        bodyHash: g.bodyHash,
        tokens: g.tokens,
        wastedTokens: g.wastedTokens,
        variants: g.variants.map(slim),
      })),
      conflicts: a.conflicts.map((c) => ({
        name: c.name,
        tokens: c.tokens,
        variants: c.variants.map(slim),
      })),
      overlapsTotal: a.overlapsTotal,
      overlaps: a.overlaps.map((o) => ({
        similarity: o.similarity,
        descSimilarity: o.descSimilarity,
        bodySimilarity: o.bodySimilarity,
        smallerTokens: o.smallerTokens,
        a: slim(o.a),
        b: slim(o.b),
      })),
      savings: a.savings,
    },
    null,
    2
  );
}
