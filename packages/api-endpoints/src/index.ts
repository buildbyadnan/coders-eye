export const API_ENDPOINTS = {
  HEALTH: "/health",
  WEBHOOK_GITHUB: "/webhook/github",
  REVIEW_CREATE: "/api/reviews",
  REVIEW_GET: "/api/reviews/:id",
  REVIEW_LIST: "/api/reviews",
  REPO_LIST: "/api/repos",
  REPO_SYNC: "/api/repos/sync",
  ORG_SETTINGS: "/api/org/settings",
} as const;
