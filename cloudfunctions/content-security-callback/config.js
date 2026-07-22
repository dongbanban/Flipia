module.exports = {
  // Database collection names
  COLLECTION_DISHES: "dishes",
  COLLECTION_CONTENT_CHECKS: "content_checks",
  COLLECTION_DRAW_HISTORY: "draw_history",

  // Database field names
  FIELD_IMAGE_URL: "imageUrl",
  FIELD_IMAGES: "images",
  FIELD_TRACE_ID: "trace_id",
  FIELD_CLOUD_FILE_ID: "cloudFileID",
  FIELD_STATUS: "status",
  FIELD_SUGGEST: "suggest",
  FIELD_LABEL: "label",
  FIELD_RESULT_DETAIL: "resultDetail",
  FIELD_RESOLVED_AT: "resolvedAt",
  FIELD_UPDATED_AT: "updatedAt",

  // Query limits
  QUERY_LIMIT_HISTORY: 100,
  QUERY_LIMIT_SINGLE: 1,

  // Log truncation length
  LOG_TRUNCATE: 300,

  // Status values
  STATUS_RISKY: "risky",
  STATUS_PASS: "pass",

  // Event type strings
  EVENT_WXA_MEDIA_CHECK: "wxa_media_check",
  EVENT_TYPE_EVENT: "event",
};
