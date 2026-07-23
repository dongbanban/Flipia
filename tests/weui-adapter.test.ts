import { describe, it, expect } from "vitest";
import { weuiAdapter } from "../miniprogram/components/app-icon/adapters/weui";
import type { UnifiedIconProps } from "../miniprogram/components/app-icon/adapters/types";

// ── 单色 props 翻译 ──────────────────────────────────────────

describe("weuiAdapter 单色 props", () => {
  it("CLOSE 翻译为 WeUI close，color 转 CSS color，size 转 font-size", () => {
    const result = weuiAdapter({ name: "CLOSE", color: "#c8815e", size: 32 });
    expect(result.componentType).toBe("mp-icon");
    expect(result.props.icon).toBe("close");
    expect(result.props.type).toBe("outline");
    expect(result.inlineStyle).toContain("color:#c8815e");
    expect(result.inlineStyle).toContain("font-size:32rpx");
  });

  it("ADD 翻译为 WeUI add", () => {
    const result = weuiAdapter({ name: "ADD" });
    expect(result.props.icon).toBe("add");
  });

  it("CHEVRON_RIGHT 翻译为 WeUI arrow", () => {
    const result = weuiAdapter({ name: "CHEVRON_RIGHT" });
    expect(result.props.icon).toBe("arrow");
  });

  it("TOGGLE_ON 翻译为 WeUI done", () => {
    const result = weuiAdapter({ name: "TOGGLE_ON" });
    expect(result.props.icon).toBe("done");
  });

  it("TOGGLE_OFF 翻译为 WeUI close", () => {
    const result = weuiAdapter({ name: "TOGGLE_OFF" });
    expect(result.props.icon).toBe("close");
  });

  it("SEARCH 翻译为 WeUI search", () => {
    const result = weuiAdapter({ name: "SEARCH" });
    expect(result.props.icon).toBe("search");
  });

  it("SHARE 翻译为 WeUI share", () => {
    const result = weuiAdapter({ name: "SHARE" });
    expect(result.props.icon).toBe("share");
  });

  it("AVATAR 翻译为 WeUI me", () => {
    const result = weuiAdapter({ name: "AVATAR" });
    expect(result.props.icon).toBe("me");
  });

  it("MINUS 翻译为 WeUI delete", () => {
    const result = weuiAdapter({ name: "MINUS" });
    expect(result.props.icon).toBe("delete");
  });

  it("HELP 未映射时原样透传", () => {
    const result = weuiAdapter({ name: "HELP" });
    expect(result.props.icon).toBe("HELP");
  });

  it("未知图标名原样透传", () => {
    const result = weuiAdapter({ name: "unknown-icon" });
    expect(result.props.icon).toBe("unknown-icon");
  });
});

// ── 多色 props 被忽略 ────────────────────────────────────────

describe("weuiAdapter 多色 props 忽略", () => {
  it("fillColor 不出现在 inlineStyle 中", () => {
    const result = weuiAdapter({ name: "ADD", fillColor: "#ff0000" });
    expect(result.inlineStyle).not.toContain("fillColor");
    expect(result.inlineStyle).not.toContain("fill");
  });

  it("strokeColor 不出现在 inlineStyle 中", () => {
    const result = weuiAdapter({ name: "ADD", strokeColor: "#00ff00" });
    expect(result.inlineStyle).not.toContain("strokeColor");
    expect(result.inlineStyle).not.toContain("stroke");
  });

  it("strokeWidth 不出现在 inlineStyle 中", () => {
    const result = weuiAdapter({ name: "ADD", strokeWidth: 4 });
    expect(result.inlineStyle).not.toContain("strokeWidth");
    expect(result.inlineStyle).not.toContain("stroke");
  });

  it("brand 不出现在 props 中", () => {
    const result = weuiAdapter({ name: "ADD", brand: true });
    expect(result.props.brand).toBeUndefined();
  });
});

// ── CHEVRON_DOWN 旋转 ────────────────────────────────────────

describe("weuiAdapter CHEVRON_DOWN 旋转", () => {
  it("CHEVRON_DOWN 附加 transform:rotate(90deg)", () => {
    const result = weuiAdapter({ name: "CHEVRON_DOWN" });
    expect(result.inlineStyle).toContain("transform:rotate(90deg)");
  });

  it("CHEVRON_DOWN 与 CHEVRON_RIGHT 共用 arrow 图标", () => {
    const down = weuiAdapter({ name: "CHEVRON_DOWN" });
    const right = weuiAdapter({ name: "CHEVRON_RIGHT" });
    expect(down.props.icon).toBe("arrow");
    expect(right.props.icon).toBe("arrow");
  });

  it("CHEVRON_RIGHT 不含旋转样式", () => {
    const result = weuiAdapter({ name: "CHEVRON_RIGHT" });
    expect(result.inlineStyle).not.toContain("transform");
  });
});

// ── 空 props 默认值 ──────────────────────────────────────────

describe("weuiAdapter 默认值", () => {
  it("未传 size 时默认 24rpx", () => {
    const result = weuiAdapter({ name: "SEARCH" });
    expect(result.inlineStyle).toContain("font-size:24rpx");
  });

  it("未传 color 时不包含 color 样式", () => {
    const result = weuiAdapter({ name: "CLOSE" });
    expect(result.inlineStyle).not.toContain("color:");
  });

  it("所有可选 props 为空时的完整输出", () => {
    const result = weuiAdapter({ name: "ADD" });
    expect(result.componentType).toBe("mp-icon");
    expect(result.props.icon).toBe("add");
    expect(result.props.type).toBe("outline");
    expect(result.inlineStyle).toBe("font-size:24rpx");
  });
});
