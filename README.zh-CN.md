# claudoctor

[English](README.md) · **简体中文**

> Agent skills 与 CLAUDE.md 的 lint 工具。审计并清理你的 Claude Code / Codex / Cursor / Hermes skills —— 找出重复、冲突和 token 大户 —— 同时诊断 CLAUDE.md 里啰嗦 / 含糊 / 反效果的规则。

[![npm version](https://img.shields.io/npm/v/claudoctor.svg)](https://www.npmjs.com/package/claudoctor)
[![CI](https://github.com/nick2781/claudoctor/actions/workflows/ci.yml/badge.svg)](https://github.com/nick2781/claudoctor/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](package.json)

Versioned with **CalVer** (`YYYY.M.D`)。

**状态：早期。可在真实数据上跑通，1.0 之前 API 仍可能调整。**

## 为什么需要它

你装过 `obra/superpowers`，又抄过几个流行 skill 包，先往 `~/.claude/skills/` 丢了一份，又往 `~/.codex/skills/` 丢了一份。你的 Claude Code / Codex 系统提示已经膨胀到几百 KB —— 充斥着互相重叠的 skill、意外的重复，以及静默的命名冲突。你不知道实际加载了什么，更不知道每一轮对话被它们吃掉了多少 token。

`claudoctor` 扫描磁盘上已知的 skill 位置并告诉你结果。只做静态分析 —— 不执行代码、不联网。

## 安装

```bash
# 一次性运行
npx claudoctor skills

# 或全局安装
npm install -g claudoctor
claudoctor skills
```

需要 Node.js ≥ 18。

## 用法

```bash
claudoctor skills                            # 人类可读报告
claudoctor skills --json                     # 机器可读，便于管道处理
claudoctor skills --source claude,codex      # 按 agent 限定来源
claudoctor skills --exclude '**/openclaw-imports/**'
claudoctor skills --deep                     # 同时分词 body 计算 overlap（O(N²)，更慢）
claudoctor skills --fix                      # dry-run 重复清理，然后确认
claudoctor skills --top 30 --threshold 0.6   # 调整排行数量 + overlap 敏感度
```

### 它报告什么

- **Token 排行** —— 按 token 成本排出的 top skills（基于 `@anthropic-ai/tokenizer`）
- **重复（Duplicates）** —— 跨 agent / 路径字节完全相同的 `SKILL.md`
- **近似重复（Near-duplicates）** —— body 相同，frontmatter 漂移
- **冲突（Conflicts）** —— 相同 skill `name`，内容不同
- **重叠（Overlap）** —— `name + description` 语义相似（token 集合上的 Jaccard）；加 `--deep` 时还会比较 body token
- **节省估算** —— 移除重复 / 近似重复 / 每对 overlap 中较小那个之后能省回的 token（不重复计算）

### 示例输出

```
claudoctor skills
Scanned 393 skills, 2462.2k tokens total.

By agent
┌────────┬────────┬─────────┐
│ Agent  │ Skills │ Tokens  │
├────────┼────────┼─────────┤
│ hermes │ 283    │ 2186.2k │
│ claude │ 104    │ 259.6k  │
│ codex  │ 6      │ 16.4k   │
└────────┴────────┴─────────┘

Duplicates (55)         ...
Near-duplicates (5)     ...
Conflicts (57)          ...
Overlap (showing top 50 of 224)
Estimated savings: ~499.0k tokens
```

### 扫描位置

| Agent   | 路径 |
|---------|------|
| claude  | `~/.claude/skills/`、`~/.claude/plugins/cache/`、`~/.claude/plugins/marketplaces/` |
| codex   | `~/.codex/skills/` |
| hermes  | `~/.hermes/skills/` |
| cursor  | `~/.cursor/rules/`、`$PWD/.cursor/rules/` |
| project | `$PWD/.claude/skills/` |

`--exclude` 接受逗号分隔的 glob 列表，会转发给 fast-glob 的 `ignore` —— 用来屏蔽 `openclaw-imports/` 这类嘈杂镜像目录，免改源码。

### JSON 输出

`--json` 会输出完整的 `Analysis` 对象（skills、duplicates、nearDuplicates、conflicts、overlaps、savings）。管道喂给 `jq`、推到看板、跨机器 diff 都行。

```bash
claudoctor skills --json | jq '.savings'
claudoctor skills --json | jq '.duplicates[] | {name, copies, wastedTokens}'
```

## `claudoctor dedup`

自动修复重复 skill 文件和重复 CLAUDE.md 段落，然后交互式处理 near-duplicate。

```bash
claudoctor dedup                         # 打印 dry-run diff，确认后再改
claudoctor dedup --yes                   # 非交互应用 exact duplicate 修复
claudoctor dedup --threshold 0.85        # 降低 near-duplicate merge 阈值
claudoctor dedup --claudemd ./CLAUDE.md  # 显式指定 CLAUDE.md 文件
claudoctor dedup --skip-claudemd         # 只处理 skill 文件
```

exact duplicate 是机械安全修复：优先保留出现最多的 source location，其次保留
路径最浅的一份，并删除其他完全相同的 skill 文件。CLAUDE.md 重复段落保留路径
最浅 / 出现最早的一段，移除后续副本。真正写入前会先打印 dry-run diff；传
`--yes` 或交互输入 `y` 才会应用。

near-duplicate 不会盲目自动合并。在交互式终端中，`claudoctor dedup` 会展示
A/B diff，并允许 keep both、merge into A、merge into B 或 skip。非交互场景
只报告并跳过 near-duplicate。

## `claudoctor claudemd`

诊断 `CLAUDE.md`。识别 token 膨胀、规则过载、含糊 / 啰嗦 / 反效果的指令、缺失的最佳实践小节（Tone、Tools…）和自相矛盾的规则；可选地让 Claude 再做一次交叉复核，补静态规则漏掉的问题。

```bash
claudoctor claudemd                         # 先找 ./CLAUDE.md，再找 ~/.claude/CLAUDE.md
claudoctor claudemd path/to/CLAUDE.md       # 显式路径
claudoctor claudemd --json                  # 机器可读 DoctorReport
claudoctor claudemd --text                  # 终端彩色文本
claudoctor claudemd --llm                   # 通过 Claude API 交叉复核
claudoctor claudemd --no-llm                # 即使设了 ANTHROPIC_API_KEY 也跳过 LLM
claudoctor claudemd --model claude-haiku-4-5-20251001
claudoctor claudemd --output report.md      # 写入文件
```

LLM 复核是可选的：设了 `ANTHROPIC_API_KEY` 就默认开；想关用 `--no-llm`。缺 key 时自动降级到纯静态规则，并在 stderr 打一行提示。

### 它报告什么

- **Token 膨胀** —— 单文件超过 5 000 / 15 000 token（warn / error）
- **规则过载** —— 单个文件里 `MUST` / `NEVER` 这类祈使规则太多
- **啰嗦 / 含糊** —— 过长的规则、weasel 词（"适当"、"在合适时"）
- **反效果** —— 已知会让 agent 行为变差的模式
- **冲突** —— 同一小节内自相矛盾的规则
- **缺失最佳实践小节** —— Tone、Tools、Workflow……
- **结构问题** —— 缺 frontmatter、坏标题、emphasis 滥用
- **LLM 交叉复核**（可选）—— 让 Claude 读全文，补静态规则漏掉的问题

只要出现 `error` 级别 finding，退出码就是 `1`（方便接 CI）。

## 路线图

- **v0.1** —— `claudoctor skills`：静态分析、token 排序、重复 / 冲突 / overlap 检测 ✅
- **v0.2** —— `bodyHash` 近似重复检测、`--deep` body 相似度 overlap、项目级 `.cursor/rules`、`--exclude` glob 过滤 ✅
- **v0.3** —— `claudoctor claudemd`：静态 + LLM 双重诊断 CLAUDE.md（token 膨胀、规则过载、含糊 / 啰嗦 / 反效果、缺失最佳实践小节）；md / text / JSON 输出 ✅
- **下一次 CalVer release** —— 重复 / 近似重复的自动 fix / merge；HTML 报告；远端 skill-pack 仓库

发布说明见 [CHANGELOG.md](CHANGELOG.md)。

## 版本号规则

claudoctor 使用 CalVer（日期版本号），不再使用 SemVer。

- 正式版本使用 `YYYY.M.D`，不补零。例如：`2026.5.25`。
- 同一天需要二次或多次发版时追加 `.N`：`2026.5.25.1`、`2026.5.25.2`。
- `0.3.0` 之后的下一次正式发版就是首个 CalVer release。

## 发布流程

1. 更新 `CHANGELOG.md` 的发布说明。
2. 将 `package.json` 的 `version` 改为对应 CalVer。
3. 提交发版改动。
4. 创建同名 git tag，例如 `2026.5.25`。
5. 基于该 tag 创建 GitHub Release。
6. npm publish 单独决策；不要把 npm 发布作为该流程的自动步骤。

## 开发

```bash
pnpm install
pnpm dev skills      # 从源码直跑
pnpm build           # 通过 tsup 打包 → dist/cli.mjs
pnpm test            # vitest
pnpm lint            # tsc --noEmit
```

源码结构：

```
src/
  cli.ts                  commander 装配
  commands/
    skills.ts             顶层 `skills` 命令
    dedup.ts              重复清理命令
    claudemd.ts           顶层 `claudemd` 命令
  lib/
    sources.ts            每个 agent 的已知 skill 位置
    discover.ts           文件发现 + 哈希（contentHash / bodyHash）
    tokens.ts             @anthropic-ai/tokenizer 封装
    analyze.ts            重复 / 近似重复 / 冲突 / overlap 检测
    dedup.ts              exact fix 计划 + near-duplicate merge 辅助函数
    report.ts             text + json 渲染器（skills）
    claudemd/
      types.ts            DoctorReport / Finding / Rule 契约
      parse.ts            CLAUDE.md → frontmatter + sections + rules
      rules.ts            驱动 rules.data.ts 的规则引擎
      rules.data.ts       声明式规则定义
      llm.ts              可选的 Claude API 交叉复核
      report.ts           md / text / json 渲染器（claudemd）
test/                     vitest 单元测试 + fixtures
```

## 贡献

欢迎 Issue 和 PR。短版见 [CONTRIBUTING.md](CONTRIBUTING.md)：非琐碎改动请先开 issue，提交前跑 `pnpm test` 和 `pnpm lint`。

## License

[MIT](LICENSE) © Nick Yang
