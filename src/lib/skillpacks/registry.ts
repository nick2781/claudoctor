import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface RegistryPack {
  name: string;
  source: string;
  description?: string;
}

export interface SkillPackRegistry {
  version: 1;
  packs: RegistryPack[];
}

interface ClaudoctorConfig {
  registryUrl?: string;
}

export async function loadRegistry(home = process.env.CLAUDOCTOR_HOME ?? os.homedir()): Promise<SkillPackRegistry> {
  const registryUrl = await resolveRegistryUrl(home);
  const raw = await readRegistryUrl(registryUrl);
  const parsed = JSON.parse(raw) as SkillPackRegistry;
  validateRegistry(parsed, registryUrl);
  return parsed;
}

export function resolveRegistryPack(registry: SkillPackRegistry, name: string): RegistryPack {
  const pack = registry.packs.find((item) => item.name === name);
  if (!pack) {
    throw new Error(`Skill pack "${name}" was not found in the registry.`);
  }
  return pack;
}

async function resolveRegistryUrl(home: string): Promise<string> {
  if (process.env.CLAUDOCTOR_REGISTRY_URL) {
    return process.env.CLAUDOCTOR_REGISTRY_URL;
  }

  const config = await readConfig(home);
  if (config.registryUrl) {
    return config.registryUrl;
  }

  return defaultRegistryPath();
}

async function readConfig(home: string): Promise<ClaudoctorConfig> {
  const configPath = path.join(home, '.claudoctor', 'config.json');
  try {
    return JSON.parse(await fs.readFile(configPath, 'utf8')) as ClaudoctorConfig;
  } catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') return {};
    throw err;
  }
}

async function readRegistryUrl(registryUrl: string): Promise<string> {
  if (/^https?:\/\//.test(registryUrl)) {
    const response = await fetch(registryUrl);
    if (!response.ok) {
      throw new Error(`Failed to load registry ${registryUrl}: HTTP ${response.status}.`);
    }
    return response.text();
  }

  const filePath = registryUrl.startsWith('file://') ? fileURLToPath(registryUrl) : registryUrl;
  return fs.readFile(filePath, 'utf8');
}

function defaultRegistryPath(): string {
  const candidates = [
    fileURLToPath(new URL('../registry/index.json', import.meta.url)),
    fileURLToPath(new URL('../../../registry/index.json', import.meta.url)),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (found) return found;
  return candidates[0]!;
}

function validateRegistry(value: SkillPackRegistry, registryUrl: string): void {
  if (value.version !== 1 || !Array.isArray(value.packs)) {
    throw new Error(`Invalid skill pack registry at ${registryUrl}.`);
  }
  for (const pack of value.packs) {
    if (!pack.name || !pack.source) {
      throw new Error(`Invalid skill pack entry in ${registryUrl}.`);
    }
  }
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err;
}
