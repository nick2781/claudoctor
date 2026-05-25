import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseClaudeMd } from '../../src/lib/claudemd/parse.js';
import { runRules } from '../../src/lib/claudemd/rules.js';
import type { ClaudeMd, Rule, Section } from '../../src/lib/claudemd/types.js';

function rule(text: string, line: number): Rule {
  return {
    text,
    line,
    section: 'Rules',
    imperative: /^(always|never|do not|don't|must|should|avoid|use|prefer|stop|only|if)\b/i.test(text),
    emphasized: /\b(NEVER|ALWAYS|MUST|IMPORTANT|DO NOT)\b/.test(text),
  };
}

function doc(overrides: Partial<ClaudeMd> = {}): ClaudeMd {
  const raw = overrides.raw ?? '# Rules\n\n- Use clear output.\n';
  const sections: Section[] = overrides.sections ?? [{ heading: 'Rules', level: 1, body: '- Use clear output.', startLine: 1 }];
  const rules = overrides.rules ?? [rule('Use clear output.', 3)];
  return {
    path: 'CLAUDE.md',
    raw,
    frontmatter: {},
    body: raw,
    sections,
    rules,
    tokens: 12,
    lineCount: raw.split(/\r?\n/).length,
    ...overrides,
  };
}

const fixturePath = (name: string): string => path.join(process.cwd(), 'test/fixtures/claudemd', name);
const ids = (findings: ReturnType<typeof runRules>): string[] => findings.map((finding) => finding.id);

describe('runRules', () => {
  it.each([
    ['token-bloat', doc({ tokens: 5001 }), doc({ tokens: 5000 })],
    ['token-bloat-extreme', doc({ tokens: 15001 }), doc({ tokens: 15000 })],
    [
      'rule-overload',
      doc({ rules: Array.from({ length: 51 }, (_, index) => rule(`Always verify rule ${index}.`, index + 3)) }),
      doc({ rules: Array.from({ length: 50 }, (_, index) => rule(`Always verify rule ${index}.`, index + 3)) }),
    ],
    [
      'verbose-rule',
      doc({
        rules: [
          rule(
            'Always document every possible operational detail in a single instruction that keeps expanding through many clauses, caveats, exceptions, reminders, contextual notes, and extra warnings until the rule is too long to scan during ordinary coding work.',
            3,
          ),
        ],
      }),
      doc({ rules: [rule('Always document relevant verification steps.', 3)] }),
    ],
    ['vague-rule', doc({ rules: [rule('Be helpful.', 3)] }), doc({ rules: [rule('Use exact file paths in findings.', 3)] })],
    [
      'emphasis-spam',
      doc({
        rules: [
          { ...rule('ALWAYS verify commands.', 3), emphasized: true },
          { ...rule('NEVER leak secrets.', 4), emphasized: true },
          { ...rule('Use exact file paths.', 5), emphasized: false },
        ],
      }),
      doc({
        rules: [
          { ...rule('Always verify commands.', 3), emphasized: true },
          { ...rule('Use exact file paths.', 4), emphasized: false },
          { ...rule('Prefer project scripts.', 5), emphasized: false },
          { ...rule('Avoid unrelated edits.', 6), emphasized: false },
        ],
      }),
    ],
    [
      'allcaps-shout',
      doc({ rules: [rule('ALWAYS VERIFY EVERY SINGLE TOOL RESULT BEFORE CLAIMING THAT THE TASK IS COMPLETE', 3)] }),
      doc({ rules: [rule('Always verify tool results before claiming completion.', 3)] }),
    ],
    [
      'contradiction',
      doc({ rules: [rule('Always use pnpm.', 3), rule('Never use pnpm.', 4)] }),
      doc({ rules: [rule('Always use pnpm.', 3), rule('Never leak secrets.', 4)] }),
    ],
    [
      'missing-tone',
      doc({ sections: [{ heading: 'Tools', level: 1, body: 'Use pnpm.', startLine: 1 }] }),
      doc({ sections: [{ heading: 'Tone', level: 1, body: 'Use concise replies.', startLine: 1 }] }),
    ],
    [
      'missing-tool-policy',
      doc({ sections: [{ heading: 'Tone', level: 1, body: 'Use concise replies.', startLine: 1 }] }),
      doc({ sections: [{ heading: 'Tools', level: 1, body: 'Use pnpm.', startLine: 1 }] }),
    ],
  ])('reports %s for hit docs and not for miss docs', (id, hit, miss) => {
    expect(ids(runRules(hit))).toContain(id);
    expect(ids(runRules(miss))).not.toContain(id);
  });

  it('maps rule check results to Finding contract fields', () => {
    const [finding] = runRules(doc({ tokens: 5001 }));

    expect(finding).toMatchObject({
      id: 'token-bloat',
      category: 'token-bloat',
      severity: 'warn',
      source: 'rules',
    });
  });

  it('runs the required rules against fixture hit and miss examples', async () => {
    const cases = [
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
    ] as const;
    const missDoc = await parseClaudeMd(fixturePath('well-formed.md'));
    const missIds = ids(runRules(missDoc));

    for (const [id, fixture] of cases) {
      const hitDoc = await parseClaudeMd(fixturePath(fixture));
      expect(ids(runRules(hitDoc))).toContain(id);
      expect(missIds).not.toContain(id);
    }
  });
});
