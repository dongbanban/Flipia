# 07 — 项目代码注释中文化

**What to build:** 将项目中所有源代码注释（包括单行注释、多行注释、JSDoc、HTML 注释）统一翻译为中文，保持代码逻辑和行为完全不变。

**Blocked by:** 无 — 可立即开始。

**Status:** done

## Scope

- [x] `cloudfunctions/` — 3 个云函数的 `index.js` 和 `config.js`（共 6 个文件）
- [x] `miniprogram/lib/` — 工具函数库（content-security.ts, draw-engine.ts, dish-pool.ts, upload-image.ts, sanitize.ts, confirm.ts, init-data.ts）
- [x] `miniprogram/pages/` — 8 个页面的 `index.ts` 和 `index.wxml`
- [x] `miniprogram/components/` — 3 个组件的 `index.ts` 和 `index.wxml`
- [x] `miniprogram/config.ts` — 统一配置文件
- [x] `miniprogram/app.ts` — 应用入口
- [x] `miniprogram/typings.d.ts` — 类型声明
- [x] `tests/` — 7 个测试文件
- [x] `vitest.config.ts` — 测试配置

## 翻译原则

| 原则 | 说明 |
|------|------|
| 语义准确 | 保留原注释的技术含义和意图，不改变技术信息的表达 |
| 简洁中文 | 使用简体中文，避免生硬的直译，用开发者习惯的技术中文表达 |
| 保留代码引用 | 注释中包含的代码符号（函数名、变量名、路径、文件引用等）保持原文 |
| JSDoc 标签保留 | `@param`、`@returns`、`@typedef` 等标签保持英文，仅翻译其后的描述文字 |
| 分隔线保留 | 类似 `// ── section ──` 的分隔线保留视觉结构，翻译其中的分段名 |
| 已中文不翻 | 已经是中文的注释不重复翻译 |

## 不做的事

- 不翻译 URL、正则表达式、环境变量名、API 名等非注释字符串
- 不修改或翻译代码逻辑中的字符串字面量
- 不翻译 `console.log` 内部的调试字符串
- 不翻译导入/导出语句中的注释（如 `// eslint-disable` 等工具指令）
- 不翻译 `@ts-ignore`、`@ts-expect-error` 等编译器指令

## Verification

- [ ] `pnpm test` — 7 个测试套件、164 个测试全部通过（纯注释修改，应无行为变化）
- [ ] TypeScript 编译无新增错误
- [ ] 全局 grep 确认无不翻译的英文注释遗漏

## Comments

`当前提交` — 翻译 cloudfunctions/（64 条注释）、miniprogram/（~120 条注释）和 tests/（~14 条注释）中的全部英文注释为简体中文。164 tests 全部通过，无逻辑变更。
