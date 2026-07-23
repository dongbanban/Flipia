import { describe, it, expect, beforeEach } from "vitest";
import {
  ICON_SEMANTIC_MAP,
  DEFAULT_ICON_BACKEND,
  getIconBackend,
  setIconBackend,
  resetIconBackend,
  COLOR_TOKENS,
} from "../miniprogram/lib/icon-config";

// ── 语义映射 ──────────────────────────────────────────────────

describe("ICON_SEMANTIC_MAP", () => {
  it("包含恰好 11 个语义名", () => {
    const keys = Object.keys(ICON_SEMANTIC_MAP);
    expect(keys).toHaveLength(11);
  });

  const exactMappings: [string, string][] = [
    ["CLOSE", "close"],
    ["ADD", "add"],
    ["CHEVRON_RIGHT", "chevron-right"],
    ["CHEVRON_DOWN", "chevron-down"],
    ["TOGGLE_ON", "check-circle-filled"],
    ["TOGGLE_OFF", "circle"],
    ["SEARCH", "search"],
    ["SHARE", "share"],
    ["AVATAR", "user-avatar"],
    ["MINUS", "minus"],
    ["HELP", "help"],
  ];

  it.each(exactMappings)("%s 映射为 TDesign 原生名 %s", (semantic, tdesign) => {
    expect(ICON_SEMANTIC_MAP[semantic]).toBe(tdesign);
  });

  it("未命中映射的语义名返回 undefined", () => {
    expect(ICON_SEMANTIC_MAP["nonexistent"]).toBeUndefined();
  });
});

// ── 默认常量 ──────────────────────────────────────────────────

describe("DEFAULT_ICON_BACKEND", () => {
  it("默认为 'tdesign'", () => {
    expect(DEFAULT_ICON_BACKEND).toBe("tdesign");
  });
});

// ── getIconBackend ────────────────────────────────────────────

describe("getIconBackend", () => {
  beforeEach(() => {
    resetIconBackend();
  });

  it("无 override 时返回全局默认值", () => {
    expect(getIconBackend()).toBe("tdesign");
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
    expect(getIconBackend("tdesign-image")).toBe("tdesign-image");
  });

  it("resetIconBackend 恢复为 'tdesign'", () => {
    setIconBackend("other");
    resetIconBackend();
    expect(getIconBackend()).toBe("tdesign");
  });
});

// ── 颜色令牌 ──────────────────────────────────────────────────

describe("COLOR_TOKENS", () => {
  it("包含恰好 6 个令牌", () => {
    const keys = Object.keys(COLOR_TOKENS);
    expect(keys).toHaveLength(6);
  });

  const tokenMappings: [string, string][] = [
    ["primary", "#c8815e"],
    ["text-secondary", "#888888"],
    ["text-light", "#ccc"],
    ["text-muted", "#999"],
    ["white", "#fff"],
    ["green", "#07c160"],
  ];

  it.each(tokenMappings)("%s 映射为 %s", (token, hex) => {
    expect(COLOR_TOKENS[token]).toBe(hex);
  });
});
