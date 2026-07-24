/**
 * 插件注册表。
 * 所有已注册插件在此声明其 id、元信息和对应的自定义处理模块。
 * 新增插件：在此数组追加条目，并在 custom-handlers/ 下创建对应的处理文件。
 */
module.exports = [
  {
    id: "demo-avatar",
    name: "头像解锁",
    description: "设置头像后即可解锁此功能",
    handler: "./custom-handlers/demo-avatar",
  },
];
