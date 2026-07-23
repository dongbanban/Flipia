import { describe, it, expect, beforeEach } from "vitest";
import {
  ICON_SEMANTIC_MAP,
  DEFAULT_ICON_BACKEND,
  getIconBackend,
  setIconBackend,
  resetIconBackend,
} from "../miniprogram/lib/icon-config";

// ── 语义映射 ──────────────────────────────────────────────────

describe("ICON_SEMANTIC_MAP", () => {
  it("包含恰好 11 个语义名", () => {
    const keys = Object.keys(ICON_SEMANTIC_MAP);
    expect(keys).toHaveLength(11);
  });

  const exactMappings: [string, string][] = [
    ["success", "success"],
    ["info", "info"],
    ["warning", "warn"],
    ["error", "cancel"],
    ["loading", "waiting"],
    ["search", "search"],
    ["close", "clear"],
    ["download", "download"],
    ["confirm", "success_no_circle"],
    ["hint", "info"],
    ["safe-success", "success"],
  ];

  it.each(exactMappings)("%s 映射为 WeUI 原生名 %s", (semantic, weui) => {
    expect(ICON_SEMANTIC_MAP[semantic]).toBe(weui);
  });

  it("未命中映射的语义名返回 undefined", () => {
    expect(ICON_SEMANTIC_MAP["nonexistent"]).toBeUndefined();
  });

  it("不包含驼峰式语义名的冗余键", () => {
    const keys = Object.keys(ICON_SEMANTIC_MAP);
    // 除 kebab 的 "safe-success" 外，其余均应为全小写单词
    const invalid = keys.filter((k) => k !== "safe-success" && k !== k.toLowerCase());
    expect(invalid).toEqual([]);
  });
});

// ── 默认常量 ──────────────────────────────────────────────────

describe("DEFAULT_ICON_BACKEND", () => {
  it("默认为 'weui'", () => {
    expect(DEFAULT_ICON_BACKEND).toBe("weui");
  });
});

// ── getIconBackend ────────────────────────────────────────────

describe("getIconBackend", () => {
  beforeEach(() => {
    resetIconBackend();
  });

  it("无 override 时返回全局默认值", () => {
    expect(getIconBackend()).toBe("weui");
  });

  it("传入 override 时返回 override", () => {
    expect(getIconBackend("image")).toBe("image");
  });

  it("override 为空字符串时返回全局默认值（空字符串为 falsy）", () => {
    expect(getIconBackend("")).toBe(DEFAULT_ICON_BACKEND);
  });

  it("setIconBackend 修改全局默认后 getIconBackend 无 override 返回新值", () => {
    setIconBackend("custom-svg");
    expect(getIconBackend()).toBe("custom-svg");
  });

  it("全局默认修改后 override 仍然优先", () => {
    setIconBackend("custom-svg");
    expect(getIconBackend("weui-image")).toBe("weui-image");
  });

  it("resetIconBackend 恢复为 'weui'", () => {
    setIconBackend("other");
    resetIconBackend();
    expect(getIconBackend()).toBe("weui");
  });
});
