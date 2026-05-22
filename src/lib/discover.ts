import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import fg from 'fast-glob';
import matter from 'gray-matter';
import { tokens } from './tokens.js';
import type { AgentKind, SourceRoot } from './sources.js';

export interface Skill {
  agent: AgentKind;
  sourceLabel: string;
  root: string;
  file: string;
  relPath: string;
  name: string;
  description: string;
  body: string;
  raw: string;
  bytes: number;
  tokens: number;
  contentHash: string;
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function deriveName(file: string, fmName: unknown, fallback: string): string {
  if (typeof fmName === 'string' && fmName.trim()) return fmName.trim();
  const dir = path.basename(path.dirname(file));
  if (dir && dir !== '.') return dir;
  return fallback;
}

export async function discover(
  sources: SourceRoot[],
  opts?: { exclude?: string[] },
): Promise<Skill[]> {
  const out: Skill[] = [];
  const seen = new Set<string>();

  for (const src of sources) {
    if (!(await exists(src.root))) continue;
    const files = await fg(src.patterns, {
      cwd: src.root,
      absolute: true,
      ignore: opts?.exclude,
      followSymbolicLinks: false,
      onlyFiles: true,
      suppressErrors: true,
      dot: true,
    });
    for (const file of files) {
      const realFile = path.resolve(file);
      if (seen.has(realFile)) continue;
      seen.add(realFile);

      let raw: string;
      try {
        raw = await fs.readFile(realFile, 'utf8');
      } catch {
        continue;
      }
      const parsed = matter(raw);
      const fm = parsed.data ?? {};
      const body = parsed.content ?? '';
      const fallback = path.basename(realFile, path.extname(realFile));
      const name = deriveName(realFile, fm.name, fallback);
      const description =
        typeof fm.description === 'string' ? fm.description.trim() : '';
      const bytes = Buffer.byteLength(raw, 'utf8');
      const hash = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);

      out.push({
        agent: src.agent,
        sourceLabel: src.label,
        root: src.root,
        file: realFile,
        relPath: path.relative(src.root, realFile),
        name,
        description,
        body,
        raw,
        bytes,
        tokens: tokens(raw),
        contentHash: hash,
      });
    }
  }
  return out;
}
