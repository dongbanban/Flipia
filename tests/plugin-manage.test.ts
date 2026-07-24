/* eslint-disable @typescript-eslint/no-var-requires */
import { describe, it, expect } from "vitest";

declare function require(name: string): any;

// ═══════════════════════════════════════════════════════════════════
//  类型定义
// ═══════════════════════════════════════════════════════════════════

/** 模拟文档记录 */
interface MockDoc {
  _id: string;
  [key: string]: unknown;
}

/** handler 返回的插件条目 */
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

/** 通用 handler 返回 */
interface HandlerResult {
  ok: boolean;
  error?: string;
  plugins?: PluginEntry[];
  unlocked?: boolean;
  alreadyUnlocked?: boolean;
  progressHint?: string;
  current?: number;
  target?: number;
  enabled?: boolean;
}

const handlers: {
  handleList: (db: MockDatabase, openid: string) => Promise<HandlerResult>;
  handleUnlock: (db: MockDatabase, event: Record<string, unknown>, openid: string) => Promise<HandlerResult>;
  handleToggle: (db: MockDatabase, event: Record<string, unknown>, openid: string) => Promise<HandlerResult>;
} = require("../cloudfunctions/plugin-manage/handlers.js");

// ═══════════════════════════════════════════════════════════════════
//  Mock 云数据库
// ═══════════════════════════════════════════════════════════════════

interface MockCollection {
  where(condition: Record<string, unknown>): MockQuery;
  doc(id: string): { update(opts: { data: Record<string, unknown> }): Promise<void>; get(): Promise<{ data: MockDoc | null }> };
  add(opts: { data: Record<string, unknown> }): Promise<{ _id: string }>;
}

interface MockQuery {
  skip(n: number): MockQuery;
  limit(n: number): MockQuery;
  field(fields: Record<string, boolean>): MockQuery;
  where(): MockQuery;
  count(): Promise<{ total: number }>;
  get(): Promise<{ data: MockDoc[] }>;
}

interface MockDatabase {
  collection(name: string): MockCollection;
  seed(name: string, docs: MockDoc[]): void;
  getAll(name: string): MockDoc[];
  reset(): void;
}

function createMockDb(): MockDatabase {
  const store: Record<string, MockDoc[]> = {};
  let nextId = 1;

  function ensureColl(name: string): MockDoc[] {
    if (!store[name]) store[name] = [];
    return store[name];
  }

  function filterDocs(docs: MockDoc[], condition: Record<string, unknown>): MockDoc[] {
    return docs.filter((doc) =>
      Object.entries(condition).every(([k, v]) => doc[k] === v),
    );
  }

  function projectFields(docs: MockDoc[], fields: Record<string, boolean>): MockDoc[] {
    return docs.map((doc) => {
      const projected: MockDoc = {} as MockDoc;
      for (const [k, include] of Object.entries(fields)) {
        if (include) (projected as Record<string, unknown>)[k] = doc[k];
      }
      return projected;
    });
  }

  class Query implements MockQuery {
    private _skip = 0;
    private _limit: number | null = null;
    private _field: Record<string, boolean> | null = null;

    constructor(
      private collName: string,
      private condition: Record<string, unknown>,
    ) {}

    skip(n: number): Query { this._skip = n; return this; }
    limit(n: number): Query { this._limit = n; return this; }
    field(fields: Record<string, boolean>): Query { this._field = fields; return this; }
    where(): Query { return this; }

    private _execute(): MockDoc[] {
      let docs = filterDocs(ensureColl(this.collName), this.condition);
      if (this._field) docs = projectFields(docs, this._field);
      if (this._skip > 0) docs = docs.slice(this._skip);
      if (this._limit !== null) docs = docs.slice(0, this._limit);
      return docs;
    }

    async count(): Promise<{ total: number }> {
      const filtered = filterDocs(ensureColl(this.collName), this.condition);
      return { total: filtered.length };
    }

    async get(): Promise<{ data: MockDoc[] }> {
      return { data: this._execute() };
    }
  }

  class CollectionRef implements MockCollection {
    constructor(private collName: string) {}

    where(condition: Record<string, unknown>): Query {
      return new Query(this.collName, condition);
    }

    doc(id: string) {
      const docs = ensureColl(this.collName);
      return {
        async update(opts: { data: Record<string, unknown> }) {
          const idx = docs.findIndex((d) => d._id === id);
          if (idx >= 0) {
            const existing = docs[idx];
            if (opts.data.plugins && existing.plugins) {
              docs[idx] = {
                ...existing,
                ...opts.data,
                plugins: { ...opts.data.plugins },
              };
            } else {
              docs[idx] = { ...existing, ...opts.data };
            }
          }
        },
        async get(): Promise<{ data: MockDoc | null }> {
          const found = docs.find((d) => d._id === id) || null;
          return { data: found };
        },
      };
    }

    async add(opts: { data: Record<string, unknown> }): Promise<{ _id: string }> {
      const id = `mock_${nextId++}`;
      const doc: MockDoc = { _id: id, ...opts.data } as MockDoc;
      ensureColl(this.collName).push(doc);
      return { _id: id };
    }
  }

  const db: MockDatabase = {
    collection(name: string): CollectionRef {
      return new CollectionRef(name);
    },
    seed(name: string, docs: MockDoc[]) {
      store[name] = docs.map((d) =>
        d._id ? d : { ...d, _id: `mock_${nextId++}` },
      );
    },
    getAll(name: string): MockDoc[] {
      return store[name] || [];
    },
    reset() {
      Object.keys(store).forEach((k) => delete store[k]);
      nextId = 1;
    },
  };

  return db;
}

// ═══════════════════════════════════════════════════════════════════
//  测试常量与工厂
// ═══════════════════════════════════════════════════════════════════

const TEST_USER = "test-openid-001";
const PLUGIN_ID = "demo-avatar";

/** 设置用户已设置头像 */
function seedUserWithAvatar(db: MockDatabase) {
  db.seed("users", [
    { _id: "u1", _openid: TEST_USER, avatarUrl: "cloud://test-avatar.png", nickName: "TestUser" },
  ]);
}

/** 设置用户未设置头像 */
function seedUserWithoutAvatar(db: MockDatabase) {
  db.seed("users", [
    { _id: "u1", _openid: TEST_USER, avatarUrl: "", nickName: "TestUser" },
  ]);
}

/** 创建一个在 users 查询时抛错的 db（用于测试插件评估中数据库查询失败） */
function createThrowingDb(): MockDatabase {
  const db = createMockDb();

  const dbProxy: MockDatabase = {
    seed: db.seed.bind(db),
    getAll: db.getAll.bind(db),
    reset: db.reset.bind(db),
    collection(name: string): MockCollection {
      const orig = db.collection(name);
      const origWhere = orig.where.bind(orig) as (c: Record<string, unknown>) => MockQuery;

      const proxiedCollection: MockCollection = {
        doc: orig.doc.bind(orig),
        add: orig.add.bind(orig),
        where(condition: Record<string, unknown>): MockQuery {
          const query = origWhere(condition);
          if (name === "users") {
            const throwingQuery: MockQuery = {
              skip(n: number) { return this; },
              limit(n: number) { return this; },
              field(_fields: Record<string, boolean>) { return this; },
              where() { return this; },
              count: () => Promise.reject(new Error("数据库连接失败")),
              get: () => Promise.reject(new Error("数据库连接失败")),
            };
            return throwingQuery;
          }
          return query;
        },
      };
      return proxiedCollection;
    },
  };

  return dbProxy;
}

// ═══════════════════════════════════════════════════════════════════
//  handleList
// ═══════════════════════════════════════════════════════════════════

describe("handleList", () => {
  it("新用户无 user_plugin 文档时自动创建并返回全 locked + disabled", async () => {
    const db = createMockDb();
    seedUserWithoutAvatar(db);

    const result = await handlers.handleList(db, TEST_USER);

    expect(result.ok).toBe(true);
    expect(result.plugins).toHaveLength(1);
    expect(result.plugins![0].id).toBe(PLUGIN_ID);
    expect(result.plugins![0].unlocked).toBe(false);
    expect(result.plugins![0].enabled).toBe(false);
    expect(result.plugins![0].progressHint).not.toBe("已解锁");

    // 验证文档已创建
    const docs = db.getAll("user_plugin");
    expect(docs).toHaveLength(1);
    expect(docs[0]._openid).toBe(TEST_USER);
    const plugins = docs[0].plugins as Record<string, { unlocked: boolean; enabled: boolean }>;
    expect(plugins[PLUGIN_ID]).toEqual({ unlocked: false, enabled: false });
  });

  it("已有用户返回正确状态和评估进度", async () => {
    const db = createMockDb();
    seedUserWithoutAvatar(db);

    // 预置 user_plugin 文档（未解锁）
    db.seed("user_plugin", [
      {
        _id: "up1",
        _openid: TEST_USER,
        plugins: { [PLUGIN_ID]: { unlocked: false, enabled: false } },
      },
    ]);

    // 首次调用 — 未设置头像，应该返回评估进度
    const result1 = await handlers.handleList(db, TEST_USER);

    expect(result1.ok).toBe(true);
    expect(result1.plugins![0].unlocked).toBe(false);
    expect(result1.plugins![0].progressHint).not.toBe("已解锁");

    // 设置头像 + 解锁
    const userDocs = db.getAll("users");
    userDocs[0].avatarUrl = "cloud://test-avatar.png";
    const pluginDocs = db.getAll("user_plugin");
    (pluginDocs[0].plugins as Record<string, { unlocked: boolean; enabled: boolean }>)[PLUGIN_ID].unlocked = true;

    const result2 = await handlers.handleList(db, TEST_USER);

    expect(result2.ok).toBe(true);
    expect(result2.plugins![0].unlocked).toBe(true);
    expect(result2.plugins![0].progressHint).toBe("已解锁");
  });

  it("清理不在 defs 中的废弃插件条目", async () => {
    const db = createMockDb();
    seedUserWithoutAvatar(db);

    db.seed("user_plugin", [
      {
        _id: "up1",
        _openid: TEST_USER,
        plugins: {
          [PLUGIN_ID]: { unlocked: false, enabled: false },
          "old-deprecated-plugin": { unlocked: true, enabled: true },
        },
      },
    ]);

    const result = await handlers.handleList(db, TEST_USER);

    expect(result.ok).toBe(true);
    expect(result.plugins).toHaveLength(1);
    expect(result.plugins![0].id).toBe(PLUGIN_ID);

    // 验证文档中废弃条目已清理
    const docs = db.getAll("user_plugin");
    const plugins = docs[0].plugins as Record<string, unknown>;
    expect(plugins).not.toHaveProperty("old-deprecated-plugin");
    expect(plugins).toHaveProperty(PLUGIN_ID);
  });

  it("补齐文档中缺失的新插件条目", async () => {
    const db = createMockDb();
    seedUserWithoutAvatar(db);

    db.seed("user_plugin", [
      { _id: "up1", _openid: TEST_USER, plugins: {} },
    ]);

    const result = await handlers.handleList(db, TEST_USER);

    expect(result.ok).toBe(true);
    expect(result.plugins).toHaveLength(1);
    expect(result.plugins![0].id).toBe(PLUGIN_ID);
    expect(result.plugins![0].unlocked).toBe(false);

    // 验证文档中已补齐
    const docs = db.getAll("user_plugin");
    const plugins = docs[0].plugins as Record<string, unknown>;
    expect(plugins).toHaveProperty(PLUGIN_ID);
    expect(plugins[PLUGIN_ID]).toEqual({ unlocked: false, enabled: false });
  });

  it("插件评估中数据库查询失败时返回错误", async () => {
    const db = createThrowingDb();

    const result = await handlers.handleList(db, TEST_USER);

    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════
//  handleUnlock
// ═══════════════════════════════════════════════════════════════════

describe("handleUnlock", () => {
  it("条件达标时写入 unlocked: true, enabled: true", async () => {
    const db = createMockDb();
    seedUserWithAvatar(db);

    await handlers.handleList(db, TEST_USER);

    const result = await handlers.handleUnlock(
      db,
      { pluginId: PLUGIN_ID },
      TEST_USER,
    );

    expect(result.ok).toBe(true);
    expect(result.unlocked).toBe(true);

    const docs = db.getAll("user_plugin");
    const plugins = docs[0].plugins as Record<string, { unlocked: boolean; enabled: boolean }>;
    expect(plugins[PLUGIN_ID].unlocked).toBe(true);
    expect(plugins[PLUGIN_ID].enabled).toBe(true);
  });

  it("条件不达标时返回进度不修改状态", async () => {
    const db = createMockDb();
    seedUserWithoutAvatar(db);

    await handlers.handleList(db, TEST_USER);

    const result = await handlers.handleUnlock(
      db,
      { pluginId: PLUGIN_ID },
      TEST_USER,
    );

    expect(result.ok).toBe(true);
    expect(result.unlocked).toBe(false);
    expect(result.progressHint).toBe("请先设置头像");

    const docs = db.getAll("user_plugin");
    const plugins = docs[0].plugins as Record<string, { unlocked: boolean }>;
    expect(plugins[PLUGIN_ID].unlocked).toBe(false);
  });

  it("已解锁插件幂等（重复调用不报错）", async () => {
    const db = createMockDb();
    seedUserWithAvatar(db);

    await handlers.handleList(db, TEST_USER);

    // 第一次解锁
    await handlers.handleUnlock(db, { pluginId: PLUGIN_ID }, TEST_USER);

    // 第二次解锁 — 应幂等返回
    const result = await handlers.handleUnlock(
      db,
      { pluginId: PLUGIN_ID },
      TEST_USER,
    );

    expect(result.ok).toBe(true);
    expect(result.alreadyUnlocked).toBe(true);
  });

  it("不存在的插件返回错误", async () => {
    const db = createMockDb();
    seedUserWithAvatar(db);

    await handlers.handleList(db, TEST_USER);

    const result = await handlers.handleUnlock(
      db,
      { pluginId: "nonexistent" },
      TEST_USER,
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe("插件不存在");
  });

  it("缺少 pluginId 返回错误", async () => {
    const db = createMockDb();

    const result = await handlers.handleUnlock(db, {}, TEST_USER);

    expect(result.ok).toBe(false);
    expect(result.error).toBe("缺少插件 ID");
  });

  it("插件评估中数据库查询失败时返回错误", async () => {
    const db = createMockDb();

    db.seed("user_plugin", [
      {
        _id: "up1",
        _openid: TEST_USER,
        plugins: { [PLUGIN_ID]: { unlocked: false, enabled: false } },
      },
    ]);

    const throwingDb = createThrowingDb();
    throwingDb.seed("user_plugin", [
      {
        _id: "up1",
        _openid: TEST_USER,
        plugins: { [PLUGIN_ID]: { unlocked: false, enabled: false } },
      },
    ]);

    const result = await handlers.handleUnlock(
      throwingDb,
      { pluginId: PLUGIN_ID },
      TEST_USER,
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════
//  handleToggle
// ═══════════════════════════════════════════════════════════════════

describe("handleToggle", () => {
  it("locked 插件拒绝操作", async () => {
    const db = createMockDb();
    db.seed("user_plugin", [
      {
        _id: "up1",
        _openid: TEST_USER,
        plugins: { [PLUGIN_ID]: { unlocked: false, enabled: false } },
      },
    ]);

    const result = await handlers.handleToggle(
      db,
      { pluginId: PLUGIN_ID, enabled: true },
      TEST_USER,
    );

    expect(result.ok).toBe(false);
    expect(result.error).toContain("未解锁");
  });

  it("unlocked 插件写入 enabled: true", async () => {
    const db = createMockDb();
    db.seed("user_plugin", [
      {
        _id: "up1",
        _openid: TEST_USER,
        plugins: { [PLUGIN_ID]: { unlocked: true, enabled: false } },
      },
    ]);

    const result = await handlers.handleToggle(
      db,
      { pluginId: PLUGIN_ID, enabled: true },
      TEST_USER,
    );

    expect(result.ok).toBe(true);
    expect(result.enabled).toBe(true);

    const docs = db.getAll("user_plugin");
    const plugins = docs[0].plugins as Record<string, { enabled: boolean }>;
    expect(plugins[PLUGIN_ID].enabled).toBe(true);
  });

  it("unlocked 插件写入 enabled: false", async () => {
    const db = createMockDb();
    db.seed("user_plugin", [
      {
        _id: "up1",
        _openid: TEST_USER,
        plugins: { [PLUGIN_ID]: { unlocked: true, enabled: true } },
      },
    ]);

    const result = await handlers.handleToggle(
      db,
      { pluginId: PLUGIN_ID, enabled: false },
      TEST_USER,
    );

    expect(result.ok).toBe(true);
    expect(result.enabled).toBe(false);

    const docs = db.getAll("user_plugin");
    const plugins = docs[0].plugins as Record<string, { enabled: boolean }>;
    expect(plugins[PLUGIN_ID].enabled).toBe(false);
  });

  it("不存在的插件返回错误", async () => {
    const db = createMockDb();
    db.seed("user_plugin", [
      {
        _id: "up1",
        _openid: TEST_USER,
        plugins: { [PLUGIN_ID]: { unlocked: true, enabled: false } },
      },
    ]);

    const result = await handlers.handleToggle(
      db,
      { pluginId: "nonexistent", enabled: true },
      TEST_USER,
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe("插件不存在");
  });

  it("缺少 pluginId 返回错误", async () => {
    const db = createMockDb();

    const result = await handlers.handleToggle(
      db,
      { enabled: true },
      TEST_USER,
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe("缺少插件 ID");
  });

  it("缺少 enabled 参数返回错误", async () => {
    const db = createMockDb();
    db.seed("user_plugin", [
      {
        _id: "up1",
        _openid: TEST_USER,
        plugins: { [PLUGIN_ID]: { unlocked: true, enabled: false } },
      },
    ]);

    const result = await handlers.handleToggle(
      db,
      { pluginId: PLUGIN_ID },
      TEST_USER,
    );

    expect(result.ok).toBe(false);
    expect(result.error).toContain("enabled");
  });

  it("enabled 不是 boolean 时返回错误", async () => {
    const db = createMockDb();
    db.seed("user_plugin", [
      {
        _id: "up1",
        _openid: TEST_USER,
        plugins: { [PLUGIN_ID]: { unlocked: true, enabled: false } },
      },
    ]);

    const result = await handlers.handleToggle(
      db,
      { pluginId: PLUGIN_ID, enabled: "yes" },
      TEST_USER,
    );

    expect(result.ok).toBe(false);
    expect(result.error).toContain("enabled");
  });
});
