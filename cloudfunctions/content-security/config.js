module.exports = {
  // msgSecCheck v2 参数
  SCENE_MSG_SEC_CHECK: 2,
  VERSION_MSG_SEC_CHECK: 2,

  // mediaCheckAsync v2 参数
  MEDIA_TYPE_IMAGE: 2,
  VERSION_MEDIA_CHECK: 2,
  SCENE_MEDIA_CHECK: 1,

  // 微信违规内容错误码
  ERR_CODE_RISKY: 87014,

  // URL 过滤正则
  URL_REGEX: /https?:\/\/[^\s]+|ftp:\/\/[^\s]+/gi,

  // 数据库集合名称
  COLLECTION_CONTENT_CHECKS: "content_checks",

  // 检测状态
  STATUS_PENDING: "pending",

  // 结果建议值
  SUGGEST_RISKY: "risky",
};
