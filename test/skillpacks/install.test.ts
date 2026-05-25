import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execa } from 'execa';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getInstallRoot, installSkillPack, listSkillPacks, removeSkillPack } from '../../src/lib/skillpacks/install.js';

const tmpRoots: string[] = [];

async function makeTempRoot(prefix: string): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tmpRoots.push(root);
  return root;
}

async function makeGitPack(): Promise<{ repo: string; cleanup: () => Promise<void> }> {
  const root = await makeTempRoot('claudoctor-pack-repo-');
  await fs.mkdir(path.join(root, 'skills', 'hello'), { recursive: true });
  await fs.writeFile(
    path.join(root, 'skills', 'hello', 'SKILL.md'),
    '---\nname: hello\n---\n\nSay hello.\n',
    'utf8',
  );
  await execa('git', ['init'], { cwd: root });
  await execa('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
  await execa('git', ['config', 'user.name', 'Test User'], { cwd: root });
  await execa('git', ['add', '.'], { cwd: root });
  await execa('git', ['commit', '-m', 'seed skill pack'], { cwd: root });
  return { repo: root, cleanup: () => fs.rm(root, { recursive: true, force: true }) };
}

beforeAll(async () => {
  await execa('git', ['--version']);
});

afterAll(async () => {
  await Promise.all(tmpRoots.map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe('skill pack installation', () => {
  it('installs, lists, and removes a git skill pack under the configured home', async () => {
    const home = await makeTempRoot('claudoctor-home-');
    const pack = await makeGitPack();

    try {
      const installed = await installSkillPack({
        source: `git+file://${pack.repo}`,
        home,
        yes: true,
      });

      expect(installed.name).toBe(path.basename(pack.repo));
      expect(installed.installPath).toBe(path.join(getInstallRoot(home), installed.name));
      await expect(fs.stat(path.join(installed.installPath, 'skills', 'hello', 'SKILL.md'))).resolves.toBeTruthy();

      const list = await listSkillPacks({ home });
      expect(list.map((item) => item.name)).toEqual([installed.name]);

      await removeSkillPack(installed.name, { home });
      expect(await listSkillPacks({ home })).toEqual([]);
    } finally {
      await pack.cleanup();
    }
  });

  it('refuses to overwrite an existing pack unless force is enabled', async () => {
    const home = await makeTempRoot('claudoctor-home-');
    const pack = await makeGitPack();

    try {
      const first = await installSkillPack({ source: `git+file://${pack.repo}`, home, yes: true });

      await expect(installSkillPack({ source: `git+file://${pack.repo}`, home, yes: true })).rejects.toThrow(
        new RegExp(`Skill pack "${first.name}" is already installed`),
      );

      await expect(installSkillPack({ source: `git+file://${pack.repo}`, home, yes: true, force: true })).resolves.toEqual(
        expect.objectContaining({ name: first.name }),
      );
    } finally {
      await pack.cleanup();
    }
  });
});
