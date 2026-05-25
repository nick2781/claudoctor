export type ParsedSkillSource = GitSkillSource | GitHubSkillSource | RegistrySkillSource;

export interface GitSkillSource {
  kind: 'git';
  cloneUrl: string;
  displaySource: string;
}

export interface GitHubSkillSource {
  kind: 'github';
  owner: string;
  repo: string;
  subpath?: string;
  ref?: string;
  cloneUrl: string;
  displaySource: string;
}

export interface RegistrySkillSource {
  kind: 'registry';
  name: string;
  displaySource: string;
}

const packNamePattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

export function isValidPackName(name: string): boolean {
  return packNamePattern.test(name);
}

export function parseSkillSource(input: string): ParsedSkillSource {
  const source = input.trim();
  if (source.length === 0) {
    throw new Error('Invalid skill pack source: value is empty.');
  }

  if (source.startsWith('git+')) {
    const cloneUrl = source.slice('git+'.length);
    if (cloneUrl.length === 0) {
      throw new Error(`Invalid skill pack source "${input}".`);
    }
    return { kind: 'git', cloneUrl, displaySource: cloneUrl };
  }

  if (source.startsWith('gh:')) {
    return parseGitHubShorthand(source, input);
  }

  if (!isValidPackName(source)) {
    throw new Error(`Invalid skill pack source "${input}".`);
  }
  return { kind: 'registry', name: source, displaySource: source };
}

export function inferPackName(source: ParsedSkillSource): string {
  if (source.kind === 'registry') return source.name;

  if (source.kind === 'github') {
    const suffix = source.subpath ? `-${lastPathSegment(source.subpath)}` : '';
    return normalizePackName(`${source.repo}${suffix}`);
  }

  return normalizePackName(stripGitSuffix(lastPathSegment(source.cloneUrl)));
}

function parseGitHubShorthand(source: string, original: string): GitHubSkillSource {
  const body = source.slice('gh:'.length);
  const [pathPart, ref] = splitOnce(body, '#');
  const parts = pathPart.split('/').filter(Boolean);
  if (parts.length < 2) {
    throw new Error(`Invalid GitHub skill pack source "${original}".`);
  }

  const [owner, repo, ...subpathParts] = parts;
  if (!owner || !repo) {
    throw new Error(`Invalid GitHub skill pack source "${original}".`);
  }

  const cloneUrl = `https://github.com/${owner}/${repo}.git`;
  const subpath = subpathParts.length > 0 ? subpathParts.join('/') : undefined;
  const displaySource = `${cloneUrl}${ref ? `#${ref}` : ''}${subpath ? `:${subpath}` : ''}`;
  return {
    kind: 'github',
    owner,
    repo,
    ...(subpath ? { subpath } : {}),
    ...(ref ? { ref } : {}),
    cloneUrl,
    displaySource,
  };
}

function splitOnce(value: string, delimiter: string): [string, string?] {
  const index = value.indexOf(delimiter);
  if (index === -1) return [value];
  return [value.slice(0, index), value.slice(index + delimiter.length)];
}

function lastPathSegment(value: string): string {
  const trimmed = value.replace(/[/:]+$/, '');
  const parts = trimmed.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? trimmed;
}

function stripGitSuffix(value: string): string {
  return value.endsWith('.git') ? value.slice(0, -'.git'.length) : value;
}

function normalizePackName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'skill-pack';
}
