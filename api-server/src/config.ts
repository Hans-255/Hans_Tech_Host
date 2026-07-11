// Central place for every external link/API used by the bot-deploy feature.
// Update a URL here once and it takes effect everywhere it's used.

export const LINKS = {
  // GitHub repo that gets deployed to Heroku when a user deploys a bot.
  BOT_REPO_OWNER: "Hans-255",
  BOT_REPO_NAME: "Hans-Xmd_v3",
  BOT_REPO_BRANCH: "main",

  // Heroku "Deploy to Heroku" button template (shown to the user after we
  // finish provisioning, in case they want to manage the app in their own
  // Heroku account/team).
  HEROKU_DEPLOY_TEMPLATE_URL:
    "https://dashboard.heroku.com/new?team=team-bots-23&template=https://github.com/Hans-255/Hans-Xmd_v3",

  // Where users get their WhatsApp SESSION_ID from before deploying a bot.
  GET_SESSION_ID_URL: "https://session-id-fc1f69d1fcb5.herokuapp.com",
};

// Default bot env config, mirrors the bot repo's own config.js exactly —
// only these keys are collected/sent when deploying a bot.
export const BOT_ENV_DEFAULTS: Record<string, string> = {
  SESSION_ID: "",
  PREFIX: ".",
  MODE: "public",
  OWNER_NAME: "©HansTz",
  OWNER_NUMBER: "",
  AUTO_STATUS_SEEN: "true",
  AUTO_READ: "false",
  AUTO_TYPING: "false",
  AUTO_RECORDING: "false",
  ALWAYS_ONLINE: "false",
  AUTO_REACT: "false",
  AUTOREACT_STATUS: "false",
  REJECT_CALL: "false",
};

export function botRepoTarballApiUrl(): string {
  return `https://api.github.com/repos/${LINKS.BOT_REPO_OWNER}/${LINKS.BOT_REPO_NAME}/tarball/${LINKS.BOT_REPO_BRANCH}`;
}

// Canonical public URL of this app, used when we need to hand Heroku a URL
// it can fetch (e.g. the bot-template tarball proxy). Prefer an explicitly
// configured value over the inbound request's host/protocol, since those
// can vary with proxies and aren't guaranteed to match the real public URL.
export function getPublicOrigin(requestOrigin: string): string {
  return process.env.PUBLIC_APP_URL || requestOrigin;
}
