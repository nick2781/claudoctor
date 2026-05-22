# claudoctor

[English](README.md) · **简体中文**

> Agent skills 的 lint 工具。审计并清理你的 Claude Code / Codex / Cursor / Hermes skills —— 找出重复、冲突和 token 大户。

[![npm version](https://img.shields.io/npm/v/claudoctor.svg)](https://www.npmjs.com/package/claudoctor)
[![CI](https://github.com/nick2781/claudoctor/actions/workflows/ci.yml/badge.svg)](https://github.com/nick2781/claudoctor/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](package.json)

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

## 路线图

- **v0.1** —— `claudoctor skills`：静态分析、token 排序、重复 / 冲突 / overlap 检测 ✅
- **v0.2** —— `bodyHash` 近似重复检测、`--deep` body 相似度 overlap、项目级 `.cursor/rules`、`--exclude` glob 过滤 ✅
- **v0.3** —— 重复 / 近似重复的自动 fix / merge；HTML 报告；远端 skill-pack 仓库

发布说明见 [CHANGELOG.md](CHANGELOG.md)。

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
  cli.ts             commander 装配
  commands/skills.ts 顶层 `skills` 命令
  lib/
    sources.ts       每个 agent 的已知 skill 位置
    discover.ts      文件发现 + 哈希（contentHash / bodyHash）
    tokens.ts        @anthropic-ai/tokenizer 封装
    analyze.ts       重复 / 近似重复 / 冲突 / overlap 检测
    report.ts        text + json 渲染器
test/                vitest 单元测试 + fixtures
```

## 贡献

欢迎 Issue 和 PR。短版见 [CONTRIBUTING.md](CONTRIBUTING.md)：非琐碎改动请先开 issue，提交前跑 `pnpm test` 和 `pnpm lint`。

## License

[MIT](LICENSE) © Nick Yang
