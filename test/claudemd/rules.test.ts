import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseClaudeMd } from '../../src/lib/claudemd/parse.js';
import { runRules } from '../../src/lib/claudemd/rules.js';

const fixture = (name: string) => path.join(process.cwd(), 'test/fixtures/claudemd', name);

async function findingIds(name: string): Promise<string[]> {
  const doc = await parseClaudeMd(fixture(name));
  return runRules(doc).map((finding) => finding.id);
}

describe('runRules', () => {
  it.each([
    ['token-bloat', 'bloated.md'],
    ['token-bloat-extreme', 'extreme.md'],
    ['rule-overload', 'overloaded.md'],
    ['verbose-rule', 'verbose.md'],
    ['vague-rule', 'vague.md'],
    ['emphasis-spam', 'emphasis-spam.md'],
    ['allcaps-shout', 'allcaps.md'],
    ['contradiction', 'contradiction.md'],
    ['missing-tone', 'missing-tone.md'],
    ['missing-tool-policy', 'missing-tools.md'],
  ])('detects %s in its hit fixture and not in the clean fixture', async (ruleId, hitFixture) => {
    await expect(findingIds(hitFixture)).resolves.toContain(ruleId);
    await expect(findingIds('well-formed.md')).resolves.not.toContain(ruleId);
  });

  it('does not flag the well-formed fixture', async () => {
    await expect(findingIds('well-formed.md')).resolves.toEqual([]);
  });
});
