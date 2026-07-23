import { describe, it, expect } from "vitest";
import { tdesignAdapter } from "../miniprogram/components/app-icon/adapters/tdesign";
import type { UnifiedIconProps } from "../miniprogram/components/app-icon/adapters/types";

// ── 语义名映射 ────────────────────────────────────────────────

describe("tdesignAdapter 语义名映射", () => {
  const semanticMappings: [string, string][] = [
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

  it.each(semanticMappings)("%s 映射为 TDesign 图标名 %s", (semantic, tName) => {
    const result = tdesignAdapter({ name: semantic });
    expect(result.componentType).toBe("t-icon");
    expect(result.props.name).toBe(tName);
  });

  it("未映射的名称原样透传为 t-icon name", () => {
    const result = tdesignAdapter({ name: "unknown-icon" });
    expect(result.componentType).toBe("t-icon");
    expect(result.props.name).toBe("unknown-icon");
  });
});

// ── 颜色处理 ──────────────────────────────────────────────────

describe("tdesignAdapter 颜色处理", () => {
  it("fillColor 优先级高于 color（两者都设置时 fillColor 用自己的，strokeColor 用 color）", () => {
    const result = tdesignAdapter({
      name: "CLOSE",
      fillColor: "$primary",
      color: "$green",
    });
    expect(result.props.fillColor).toBe("#c8815e");
    expect(result.props.strokeColor).toBe("#07c160");
  });

  it("仅设置 color 时同时用作 fillColor 和 strokeColor", () => {
    const result = tdesignAdapter({ name: "CLOSE", color: "$primary" });
    expect(result.props.fillColor).toBe("#c8815e");
    expect(result.props.strokeColor).toBe("#c8815e");
  });

  it("fillColor 和 color 都未设置时 fillColor 和 strokeColor 为空字符串", () => {
    const result = tdesignAdapter({ name: "CLOSE" });
    expect(result.props.fillColor).toBe("");
    expect(result.props.strokeColor).toBe("");
  });

  it("strokeColor 优先级高于 color（仅 strokeColor 用自己的）", () => {
    const result = tdesignAdapter({
      name: "ADD",
      strokeColor: "$green",
      color: "$primary",
    });
    expect(result.props.fillColor).toBe("#c8815e");
    expect(result.props.strokeColor).toBe("#07c160");
  });

  it("未知 $token 原样透传", () => {
    const result = tdesignAdapter({ name: "CLOSE", color: "$unknown-token" });
    expect(result.props.fillColor).toBe("$unknown-token");
    expect(result.props.strokeColor).toBe("$unknown-token");
  });

  it("普通色值不变", () => {
    const result = tdesignAdapter({ name: "CLOSE", color: "#abc123" });
    expect(result.props.fillColor).toBe("#abc123");
    expect(result.props.strokeColor).toBe("#abc123");
  });
});

// ── 描边属性透传 ──────────────────────────────────────────────

describe("tdesignAdapter 描边属性透传", () => {
  it("strokeColor 透传", () => {
    const result = tdesignAdapter({ name: "ADD", strokeColor: "$green" });
    expect(result.props.strokeColor).toBe("#07c160");
  });

  it("strokeWidth 透传", () => {
    const result = tdesignAdapter({ name: "ADD", strokeWidth: 4 });
    expect(result.props.strokeWidth).toBe(4);
  });

  it("strokeWidth 为默认值 2 时保留默认值", () => {
    const result = tdesignAdapter({ name: "ADD", strokeWidth: 2 });
    expect(result.props.strokeWidth).toBe(2);
  });

  it("strokeColor 未设置时为空字符串", () => {
    const result = tdesignAdapter({ name: "ADD" });
    expect(result.props.strokeColor).toBe("");
  });
});

// ── 尺寸默认值 ────────────────────────────────────────────────

describe("tdesignAdapter 尺寸默认值", () => {
  it("未传 size 时默认 24rpx", () => {
    const result = tdesignAdapter({ name: "SEARCH" });
    expect(result.props.size).toBe("24rpx");
  });

  it("传入 size 时使用传入值拼 rpx", () => {
    const result = tdesignAdapter({ name: "SEARCH", size: 48 });
    expect(result.props.size).toBe("48rpx");
  });
});

// ── brand 透传 ────────────────────────────────────────────────

describe("tdesignAdapter brand 透传", () => {
  it("brand 设置时透传", () => {
    const result = tdesignAdapter({ name: "CLOSE", brand: "tdesign" });
    expect(result.props.brand).toBe("tdesign");
  });

  it("brand 未设置时默认为 tdesign", () => {
    const result = tdesignAdapter({ name: "CLOSE" });
    expect(result.props.brand).toBe("tdesign");
  });
});

// ── 可选属性缺省 ──────────────────────────────────────────────

describe("tdesignAdapter 可选属性缺省", () => {
  it("所有可选 props 为空时的完整输出（始终包含默认值）", () => {
    const result = tdesignAdapter({ name: "ADD" });
    expect(result.componentType).toBe("t-icon");
    expect(result.props.name).toBe("add");
    expect(result.props.size).toBe("24rpx");
    expect(result.props.fillColor).toBe("");
    expect(result.props.strokeColor).toBe("");
    expect(result.props.strokeWidth).toBe(2);
    expect(result.props.brand).toBe("tdesign");
    expect(result.inlineStyle).toBe("");
  });

  it("CHEVRON_DOWN 无需旋转样式", () => {
    const result = tdesignAdapter({ name: "CHEVRON_DOWN" });
    expect(result.inlineStyle).toBe("");
    expect(result.props.name).toBe("chevron-down");
  });
});
