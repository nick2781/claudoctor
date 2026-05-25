export interface Section {
  heading: string;
  level: number;
  body: string;
  startLine: number;
}

export interface Rule {
  text: string;
  line: number;
  section: string;
  imperative: boolean;
  emphasized: boolean;
}

export interface ClaudeMd {
  path: string;
  raw: string;
  frontmatter: Record<string, unknown>;
  body: string;
  sections: Section[];
  rules: Rule[];
  tokens: number;
  lineCount: number;
}

export type Severity = 'info' | 'warn' | 'error';

export type Category =
  | 'token-bloat'
  | 'rule-overload'
  | 'verbose'
  | 'vague'
  | 'counterproductive'
  | 'conflict'
  | 'missing-best-practice'
  | 'structural';

export interface Finding {
  id: string;
  severity: Severity;
  category: Category;
  message: string;
  line?: number;
  ruleText?: string;
  suggestion?: string;
  source: 'rules' | 'llm';
}

export interface DoctorReport {
  file: string;
  tokens: number;
  ruleCount: number;
  lineCount: number;
  findings: Finding[];
  summary: { errors: number; warnings: number; infos: number };
  meta: { llmUsed: boolean; rulesetVersion: string };
}

export interface LlmOptions {
  apiKey: string;
  model: string;
}
