import os from 'node:os';
import path from 'node:path';

export type AgentKind = 'claude' | 'codex' | 'cursor' | 'hermes' | 'project';

export interface SourceRoot {
  agent: AgentKind;
  label: string;
  root: string;
  patterns: string[];
}

const home = os.homedir();
const cwd = process.cwd();

export function defaultSources(): SourceRoot[] {
  return [
    {
      agent: 'claude',
      label: 'claude/user',
      root: path.join(home, '.claude'),
      patterns: ['skills/**/SKILL.md'],
    },
    {
      agent: 'claude',
      label: 'claude/plugins-cache',
      root: path.join(home, '.claude/plugins/cache'),
      patterns: ['*/*/*/skills/**/SKILL.md'],
    },
    {
      agent: 'claude',
      label: 'claude/plugins-marketplaces',
      root: path.join(home, '.claude/plugins/marketplaces'),
      patterns: ['*/plugins/*/skills/**/SKILL.md'],
    },
    {
      agent: 'codex',
      label: 'codex/user',
      root: path.join(home, '.codex'),
      patterns: ['skills/**/SKILL.md'],
    },
    {
      agent: 'hermes',
      label: 'hermes/user',
      root: path.join(home, '.hermes'),
      patterns: ['skills/**/SKILL.md'],
    },
    {
      agent: 'cursor',
      label: 'cursor/user',
      root: path.join(home, '.cursor'),
      patterns: ['rules/**/*.mdc', 'rules/**/*.md'],
    },
    {
      agent: 'project',
      label: 'project/.claude',
      root: cwd,
      patterns: ['.claude/skills/**/SKILL.md'],
    },
  ];
}

export function filterSources(sources: SourceRoot[], wanted?: string[]): SourceRoot[] {
  if (!wanted || wanted.length === 0) return sources;
  const set = new Set(wanted.map((s) => s.trim().toLowerCase()));
  return sources.filter((s) => set.has(s.agent));
}
