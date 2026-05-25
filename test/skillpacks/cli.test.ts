import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execa } from 'execa';
import { afterAll, describe, expect, it } from 'vitest';

const tmpRoots: string[] = [];

async function makeTempRoot(prefix: string): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tmpRoots.push(root);
  return root;
}

async function makePackRepo(): Promise<string> {
  const repo = await makeTempRoot('claudoctor-cli-pack-');
  await fs.mkdir(path.join(repo, 'skills', 'cli-pack'), { recursive: true });
  await fs.writeFile(path.join(repo, 'skills', 'cli-pack', 'SKILL.md'), '---\nname: cli-pack\n---\n\nCLI pack.\n', 'utf8');
  await execa('git', ['init'], { cwd: repo });
  await execa('git', ['config', 'user.email', 'test@example.com'], { cwd: repo });
  await execa('git', ['config', 'user.name', 'Test User'], { cwd: repo });
  await execa('git', ['add', '.'], { cwd: repo });
  await execa('git', ['commit', '-m', 'seed cli pack'], { cwd: repo });
  return repo;
}

async function runCli(args: string[], env: Record<string, string>) {
  return execa('pnpm', ['tsx', 'src/cli.ts', ...args], {
    env,
    reject: false,
  });
}

afterAll(async () => {
  await Promise.all(tmpRoots.map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe('claudoctor skill CLI', () => {
  it('runs add/list/remove against a temporary home', async () => {
    const home = await makeTempRoot('claudoctor-cli-home-');
    const repo = await makePackRepo();
    const env = { CLAUDOCTOR_HOME: home };
    const expectedName = path.basename(repo);

    const add = await runCli(['skill', 'add', `git+file://${repo}`, '--yes'], env);
    expect(add.exitCode).toBe(0);
    expect(add.stdout).toContain(`Installed ${expectedName}`);

    const list = await runCli(['skill', 'list'], env);
    expect(list.exitCode).toBe(0);
    expect(list.stdout).toContain(expectedName);

    const remove = await runCli(['skill', 'remove', expectedName], env);
    expect(remove.exitCode).toBe(0);
    expect(remove.stdout).toContain(`Removed ${expectedName}`);

    const emptyList = await runCli(['skill', 'list'], env);
    expect(emptyList.exitCode).toBe(0);
    expect(emptyList.stdout).toContain('No skill packs installed.');
  });
});
