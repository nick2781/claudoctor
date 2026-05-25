import { describe, expect, it } from 'vitest';
import { inferPackName, parseSkillSource } from '../../src/lib/skillpacks/source.js';

describe('skill pack source parsing', () => {
  it('parses git+ URLs and infers the pack name from the repository', () => {
    const source = parseSkillSource('git+https://github.com/acme/starter-skills.git');

    expect(source).toEqual({
      kind: 'git',
      cloneUrl: 'https://github.com/acme/starter-skills.git',
      displaySource: 'https://github.com/acme/starter-skills.git',
    });
    expect(inferPackName(source)).toBe('starter-skills');
  });

  it('parses GitHub shorthand with optional path and ref', () => {
    const source = parseSkillSource('gh:acme/agent-packs/codex#release-2026.5.25');

    expect(source).toEqual({
      kind: 'github',
      owner: 'acme',
      repo: 'agent-packs',
      subpath: 'codex',
      ref: 'release-2026.5.25',
      cloneUrl: 'https://github.com/acme/agent-packs.git',
      displaySource: 'https://github.com/acme/agent-packs.git#release-2026.5.25:codex',
    });
    expect(inferPackName(source)).toBe('agent-packs-codex');
  });

  it('treats a bare token as a registry pack name', () => {
    expect(parseSkillSource('starter-skills')).toEqual({
      kind: 'registry',
      name: 'starter-skills',
      displaySource: 'starter-skills',
    });
  });

  it('rejects unsafe registry pack names', () => {
    expect(() => parseSkillSource('../starter')).toThrow(/Invalid skill pack source/);
  });
});
