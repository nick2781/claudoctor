import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadRegistry, resolveRegistryPack } from '../../src/lib/skillpacks/registry.js';

const originalRegistryUrl = process.env.CLAUDOCTOR_REGISTRY_URL;

afterEach(() => {
  if (originalRegistryUrl === undefined) {
    delete process.env.CLAUDOCTOR_REGISTRY_URL;
  } else {
    process.env.CLAUDOCTOR_REGISTRY_URL = originalRegistryUrl;
  }
});

describe('skill pack registry', () => {
  it('loads the bundled static registry by default', async () => {
    delete process.env.CLAUDOCTOR_REGISTRY_URL;

    const registry = await loadRegistry();

    expect(resolveRegistryPack(registry, 'starter-skills').source).toBe('gh:nick2781/claudoctor-starter-skills');
  });

  it('loads a static registry index from CLAUDOCTOR_REGISTRY_URL', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'claudoctor-registry-'));
    const indexPath = path.join(root, 'index.json');
    await fs.writeFile(
      indexPath,
      JSON.stringify({
        version: 1,
        packs: [
          {
            name: 'starter-skills',
            source: 'gh:nick2781/claudoctor-starter-skills',
            description: 'Starter pack.',
          },
        ],
      }),
      'utf8',
    );
    process.env.CLAUDOCTOR_REGISTRY_URL = indexPath;

    try {
      const registry = await loadRegistry();
      const pack = resolveRegistryPack(registry, 'starter-skills');

      expect(pack.source).toBe('gh:nick2781/claudoctor-starter-skills');
      expect(pack.description).toBe('Starter pack.');
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('loads a registry URL from ~/.claudoctor/config.json', async () => {
    const home = await fs.mkdtemp(path.join(os.tmpdir(), 'claudoctor-registry-home-'));
    const registryPath = path.join(home, 'enterprise-index.json');
    await fs.mkdir(path.join(home, '.claudoctor'), { recursive: true });
    await fs.writeFile(
      registryPath,
      JSON.stringify({
        version: 1,
        packs: [{ name: 'enterprise-skills', source: 'gh:acme/enterprise-skills' }],
      }),
      'utf8',
    );
    await fs.writeFile(
      path.join(home, '.claudoctor', 'config.json'),
      JSON.stringify({ registryUrl: registryPath }),
      'utf8',
    );
    delete process.env.CLAUDOCTOR_REGISTRY_URL;

    try {
      const registry = await loadRegistry(home);

      expect(resolveRegistryPack(registry, 'enterprise-skills').source).toBe('gh:acme/enterprise-skills');
    } finally {
      await fs.rm(home, { recursive: true, force: true });
    }
  });

  it('errors when a pack is missing from the registry', () => {
    expect(() => resolveRegistryPack({ version: 1, packs: [] }, 'missing-pack')).toThrow(
      /Skill pack "missing-pack" was not found/,
    );
  });
});
