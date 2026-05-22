import { defaultSources, filterSources } from '../lib/sources.js';
import { discover } from '../lib/discover.js';
import { analyze } from '../lib/analyze.js';
import { renderJson, renderText } from '../lib/report.js';

export interface SkillsOptions {
  json?: boolean;
  deep?: boolean;
  source?: string;
  top?: string;
  threshold?: string;
}

export async function runSkills(opts: SkillsOptions): Promise<void> {
  if (opts.deep) {
    process.stderr.write('[claudoctor] --deep not implemented in v0.1, ignoring.\n');
  }
  const wanted = opts.source
    ? opts.source.split(',').map((s) => s.trim()).filter(Boolean)
    : undefined;
  const sources = filterSources(defaultSources(), wanted);
  const skills = await discover(sources);
  let top = 20;
  if (opts.top !== undefined) {
    const parsed = parseInt(opts.top, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      process.stderr.write(`[claudoctor] --top ${opts.top} invalid, using 20.\n`);
    } else {
      top = parsed;
    }
  }
  const threshold = opts.threshold ? Math.min(1, Math.max(0, parseFloat(opts.threshold))) : 0.5;
  const result = analyze(skills, { overlapThreshold: threshold });
  if (opts.json) {
    process.stdout.write(renderJson(result) + '\n');
  } else {
    process.stdout.write(renderText(result, { top }) + '\n');
  }
}
