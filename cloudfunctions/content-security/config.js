module.exports = {
  // msgSecCheck v2 parameters
  SCENE_MSG_SEC_CHECK: 2,
  VERSION_MSG_SEC_CHECK: 2,

  // mediaCheckAsync v2 parameters
  MEDIA_TYPE_IMAGE: 2,
  VERSION_MEDIA_CHECK: 2,
  SCENE_MEDIA_CHECK: 1,

  // WeChat error code for risky content
  ERR_CODE_RISKY: 87014,

  // URL filter regex
  URL_REGEX: /https?:\/\/[^\s]+|ftp:\/\/[^\s]+/gi,

  // Database collection name
  COLLECTION_CONTENT_CHECKS: "content_checks",

  // Check status
  STATUS_PENDING: "pending",

  // Result suggest values
  SUGGEST_RISKY: "risky",
};
