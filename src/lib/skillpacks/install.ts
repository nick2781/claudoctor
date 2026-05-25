import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execa } from 'execa';
import { inferPackName, isValidPackName, parseSkillSource, type ParsedSkillSource } from './source.js';
import { loadRegistry, resolveRegistryPack } from './registry.js';

export interface InstallSkillPackOptions {
  source: string;
  home?: string;
  yes?: boolean;
  force?: boolean;
}

export interface InstalledSkillPack {
  name: string;
  installPath: string;
  source: string;
  description?: string;
}

export interface SkillPackInstallPreview {
  name: string;
  source: string;
  description?: string;
}

export interface SkillPackListItem {
  name: string;
  path: string;
}

interface ResolvedInstallSource {
  source: ParsedSkillSource;
  name: string;
  description?: string;
}

export function getInstallRoot(home = process.env.CLAUDOCTOR_HOME ?? os.homedir()): string {
  return path.join(home, '.claudoctor', 'skills');
}

export async function previewSkillPackInstall(source: string, home?: string): Promise<SkillPackInstallPreview> {
  const resolved = await resolveInstallSource(source, home ?? process.env.CLAUDOCTOR_HOME ?? os.homedir());
  return {
    name: resolved.name,
    source: resolved.source.displaySource,
    ...(resolved.description ? { description: resolved.description } : {}),
  };
}

export async function installSkillPack(options: InstallSkillPackOptions): Promise<InstalledSkillPack> {
  const home = options.home ?? process.env.CLAUDOCTOR_HOME ?? os.homedir();
  const resolved = await resolveInstallSource(options.source, home);
  const installRoot = getInstallRoot(home);
  const installPath = path.join(installRoot, resolved.name);

  if (!options.yes) {
    throw new Error(`Refusing to install ${resolved.source.displaySource} without confirmation. Pass --yes to continue.`);
  }

  if (await exists(installPath)) {
    if (!options.force) {
      throw new Error(`Skill pack "${resolved.name}" is already installed. Use --force to overwrite it.`);
    }
    await fs.rm(installPath, { recursive: true, force: true });
  }

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'claudoctor-skill-pack-'));
  try {
    const checkoutPath = path.join(tempRoot, 'repo');
    await cloneSource(resolved.source, checkoutPath);
    const sourcePath = resolved.source.kind === 'github' && resolved.source.subpath
      ? path.join(checkoutPath, resolved.source.subpath)
      : checkoutPath;
    await fs.mkdir(installRoot, { recursive: true });
    await fs.cp(sourcePath, installPath, { recursive: true, filter: (src) => path.basename(src) !== '.git' });
    return {
      name: resolved.name,
      installPath,
      source: resolved.source.displaySource,
      ...(resolved.description ? { description: resolved.description } : {}),
    };
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

export async function listSkillPacks(options: { home?: string } = {}): Promise<SkillPackListItem[]> {
  const installRoot = getInstallRoot(options.home ?? process.env.CLAUDOCTOR_HOME ?? os.homedir());
  try {
    const entries = await fs.readdir(installRoot, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({ name: entry.name, path: path.join(installRoot, entry.name) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') return [];
    throw err;
  }
}

export async function removeSkillPack(name: string, options: { home?: string } = {}): Promise<string> {
  if (!isValidPackName(name)) {
    throw new Error(`Invalid skill pack name "${name}".`);
  }
  const installPath = path.join(getInstallRoot(options.home ?? process.env.CLAUDOCTOR_HOME ?? os.homedir()), name);
  if (!(await exists(installPath))) {
    throw new Error(`Skill pack "${name}" is not installed.`);
  }
  await fs.rm(installPath, { recursive: true, force: true });
  return installPath;
}

async function resolveInstallSource(input: string, home: string): Promise<ResolvedInstallSource> {
  const source = parseSkillSource(input);
  if (source.kind !== 'registry') {
    return { source, name: inferPackName(source) };
  }

  const registry = await loadRegistry(home);
  const pack = resolveRegistryPack(registry, source.name);
  const parsed = parseSkillSource(pack.source);
  return {
    source: parsed,
    name: source.name,
    ...(pack.description ? { description: pack.description } : {}),
  };
}

async function cloneSource(source: ParsedSkillSource, checkoutPath: string): Promise<void> {
  if (source.kind === 'registry') {
    throw new Error('Registry sources must be resolved before cloning.');
  }

  await execa('git', ['clone', source.cloneUrl, checkoutPath]);
  if (source.kind === 'github' && source.ref) {
    await execa('git', ['checkout', source.ref], { cwd: checkoutPath });
  }
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') return false;
    throw err;
  }
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err;
}
