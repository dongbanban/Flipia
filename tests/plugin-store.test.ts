import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

// ═══════════════════════════════════════════════════════════════════
//  类型定义
// ═══════════════════════════════════════════════════════════════════

/** 云函数返回的插件条目 */
interface PluginEntry {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
  enabled: boolean;
  progressHint: string;
  current: number;
  target: number;
}

/** 云函数 list 返回值 */
interface ListResult {
  ok: boolean;
  plugins?: PluginEntry[];
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════
//  Mock
// ═══════════════════════════════════════════════════════════════════

const mockCallFunction = vi.fn();
const mockShowModal = vi.fn();

// 在模块导入前注入 wx mock
vi.stubGlobal("wx", {
  cloud: {
    callFunction: mockCallFunction,
  },
  showModal: mockShowModal,
});

// 模块顶层引用了 @/config，需要提前 mock
vi.mock("@/config", () => ({
  CLOUD: { envId: "mock-env-id" },
}));

// 动态导入模块（mock 必须在导入前设置好）
let pluginStore: {
  load: () => Promise<void>;
  isEnabled: (id: string) => boolean;
};

beforeAll(async () => {
  pluginStore = await import("../miniprogram/stores/plugin-store");
});

// ═══════════════════════════════════════════════════════════════════
//  测试工厂
// ═══════════════════════════════════════════════════════════════════

/** 构造一份成功的 list 返回 */
function buildListResult(plugins: Partial<PluginEntry>[]): ListResult {
  return {
    ok: true,
    plugins: plugins.map((p, i) => ({
      id: p.id ?? `plugin-${i}`,
      name: p.name ?? "测试插件",
      description: p.description ?? "测试用",
      unlocked: p.unlocked ?? true,
      enabled: p.enabled ?? false,
      progressHint: p.progressHint ?? "已解锁",
      current: p.current ?? 1,
      target: p.target ?? 1,
    })),
  };
}

/** 构造一份失败的 list 返回 */
function buildErrorResult(error: string): ListResult {
  return { ok: false, error };
}

// ═══════════════════════════════════════════════════════════════════
//  测试用例
// ═══════════════════════════════════════════════════════════════════

describe("plugin-store", () => {
  beforeEach(() => {
    mockCallFunction.mockReset();
    mockShowModal.mockReset();

    // 重新加载以重置内部状态
    // 注意：模块级变量 loaded / enabledMap 在导入时初始化
    // 需要特殊处理 —— 通过 load 成功调用来重置状态
  });

  describe("isEnabled（未加载时）", () => {
    it("任意插件 ID 均返回 false", () => {
      expect(pluginStore.isEnabled("any-plugin")).toBe(false);
      expect(pluginStore.isEnabled("demo-avatar")).toBe(false);
      expect(pluginStore.isEnabled("")).toBe(false);
    });
  });

  describe("load() 成功", () => {
    it("缓存单个插件的启用状态", async () => {
      mockCallFunction.mockResolvedValue({
        result: buildListResult([{ id: "demo-avatar", enabled: true }]),
      });

      await pluginStore.load();

      expect(pluginStore.isEnabled("demo-avatar")).toBe(true);
    });

    it("缓存多个插件的启用状态", async () => {
      mockCallFunction.mockResolvedValue({
        result: buildListResult([
          { id: "plugin-a", enabled: true },
          { id: "plugin-b", enabled: false },
          { id: "plugin-c", enabled: true },
        ]),
      });

      await pluginStore.load();

      expect(pluginStore.isEnabled("plugin-a")).toBe(true);
      expect(pluginStore.isEnabled("plugin-b")).toBe(false);
      expect(pluginStore.isEnabled("plugin-c")).toBe(true);
    });

    it("不存在的插件 ID 返回 false", async () => {
      mockCallFunction.mockResolvedValue({
        result: buildListResult([{ id: "demo-avatar", enabled: true }]),
      });

      await pluginStore.load();

      expect(pluginStore.isEnabled("nonexistent")).toBe(false);
    });

    it("空插件列表时任意 ID 返回 false", async () => {
      mockCallFunction.mockResolvedValue({
        result: buildListResult([]),
      });

      await pluginStore.load();

      expect(pluginStore.isEnabled("demo-avatar")).toBe(false);
    });

    it("重复调用 load 覆盖旧缓存", async () => {
      // 第一次：plugin-a 启用
      mockCallFunction.mockResolvedValueOnce({
        result: buildListResult([{ id: "plugin-a", enabled: true }]),
      });
      await pluginStore.load();
      expect(pluginStore.isEnabled("plugin-a")).toBe(true);

      // 第二次：switch-a 禁用
      mockCallFunction.mockResolvedValueOnce({
        result: buildListResult([{ id: "plugin-a", enabled: false }]),
      });
      await pluginStore.load();
      expect(pluginStore.isEnabled("plugin-a")).toBe(false);
    });

    it("重复调用 load 清除已移除的插件条目", async () => {
      mockCallFunction.mockResolvedValueOnce({
        result: buildListResult([
          { id: "plugin-a", enabled: true },
          { id: "plugin-b", enabled: true },
        ]),
      });
      await pluginStore.load();
      expect(pluginStore.isEnabled("plugin-a")).toBe(true);
      expect(pluginStore.isEnabled("plugin-b")).toBe(true);

      // 第二次：plugin-b 已移除
      mockCallFunction.mockResolvedValueOnce({
        result: buildListResult([{ id: "plugin-a", enabled: true }]),
      });
      await pluginStore.load();

      expect(pluginStore.isEnabled("plugin-a")).toBe(true);
      expect(pluginStore.isEnabled("plugin-b")).toBe(false);
    });
  });

  describe("load() 失败", () => {
    it("云函数返回 ok: false 时弹出提示并保持未加载状态", async () => {
      mockCallFunction.mockResolvedValue({
        result: buildErrorResult("数据查询失败"),
      });

      await pluginStore.load();

      expect(mockShowModal).toHaveBeenCalledTimes(1);
      const callArgs = mockShowModal.mock.calls[0][0] as Record<string, unknown>;
      expect(callArgs.title).toBe("加载失败");
      expect(callArgs.content).toContain("刷新");

      // 保持未加载状态
      expect(pluginStore.isEnabled("any")).toBe(false);
    });

    it("云函数调用抛出网络异常时弹出提示并保持未加载状态", async () => {
      mockCallFunction.mockRejectedValue(new Error("Network error"));

      await pluginStore.load();

      expect(mockShowModal).toHaveBeenCalledTimes(1);

      // 保持未加载状态
      expect(pluginStore.isEnabled("any")).toBe(false);
    });

    it("云函数返回缺少 plugins 字段时弹出提示", async () => {
      mockCallFunction.mockResolvedValue({
        result: { ok: true },
      });

      await pluginStore.load();

      expect(mockShowModal).toHaveBeenCalledTimes(1);
      expect(pluginStore.isEnabled("any")).toBe(false);
    });

    it("失败不静默：控制台有日志输出", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      mockCallFunction.mockRejectedValue(new Error("Boom"));

      await pluginStore.load();

      expect(consoleSpy).toHaveBeenCalledWith(
        "[plugin-store] 加载失败",
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });
});
