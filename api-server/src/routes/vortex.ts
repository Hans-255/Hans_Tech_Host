import { Router } from "express";
import fs from "fs";
import path from "path";
import { exec } from "child_process";

const router = Router();

const CONFIG_ENV_PATH = path.resolve("/home/runner/workspace/vortex-xmd/config.env");
const PLUGINS_DIR     = path.resolve("/home/runner/workspace/vortex-xmd/plugins");

const CONFIG_DEFAULTS: Record<string, string> = {
  SESSION_ID: "",
  BOT_NAME: "VORTEX-XMD",
  OWNER_NAME: "HansTz",
  OWNER_NUMBER: "255753668403",
  DEV: "255753668403",
  MODE: "public",
  PREFIX: ".",
  AUTO_STATUS_SEEN: "true",
  AUTO_STATUS_REPLY: "false",
  AUTO_STATUS_REACT: "true",
  AUTO_STATUS_MSG: "*SEEN BY VORTEX XMD ⚡*",
  AUTO_TYPING: "true",
  AUTO_RECORDING: "false",
  AUTO_REACT: "false",
  AUTO_REPLY: "false",
  AUTO_STICKER: "false",
  READ_MESSAGE: "false",
  READ_CMD: "false",
  ALWAYS_ONLINE: "false",
  AUTO_BIO: "false",
  CHAT_BOT: "false",
  CUSTOM_REACT: "false",
  CUSTOM_REACT_EMOJIS: "💝,💖,💗,❤️,🧡,💛,💚,💙,💜",
  ANTI_LINK: "true",
  ANTI_BAD: "false",
  ADMIN_EVENTS: "false",
  WELCOME: "true",
  ANTI_VV: "true",
  ANTI_DELETE: "true",
  ANTI_DEL_PATH: "log",
  ANTI_CALL: "true",
  MENTION_REPLY: "false",
  MENU_IMAGE_URL: "https://raw.githubusercontent.com/Hans-255/Vortex-Xmd/main/assets/vortex.jpg",
  ALIVE_IMG: "https://raw.githubusercontent.com/Hans-255/Vortex-Xmd/main/assets/vortex.jpg",
  STICKER_NAME: "VORTEX-XMD",
  DESCRIPTION: "*© POWERED BY VORTEX-XMD | HansTz*",
  LIVE_MSG: "> Powered by *VORTEX-XMD | HansTz* ⚡",
  PUBLIC_MODE: "true",
};

function readConfigEnv(): Record<string, string> {
  const result: Record<string, string> = { ...CONFIG_DEFAULTS };
  if (!fs.existsSync(CONFIG_ENV_PATH)) return result;
  const lines = fs.readFileSync(CONFIG_ENV_PATH, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    result[key] = val;
  }
  return result;
}

function writeConfigEnv(config: Record<string, string>): void {
  const lines = Object.entries(config).map(([k, v]) => `${k}=${v}`);
  fs.writeFileSync(CONFIG_ENV_PATH, lines.join("\n") + "\n", "utf8");
}

// GET /api/vortex/config
router.get("/vortex/config", (_req, res) => {
  try {
    const config = readConfigEnv();
    res.json({ success: true, config });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PATCH /api/vortex/config
router.patch("/vortex/config", (req, res) => {
  try {
    const updates: Record<string, string> = req.body;
    const current = readConfigEnv();
    const merged = { ...current, ...updates };
    writeConfigEnv(merged);
    res.json({ success: true, config: merged });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/vortex/status
router.get("/vortex/status", (_req, res) => {
  exec("ps aux | grep 'vortex-xmd/index.js' | grep -v grep | wc -l", (err, stdout) => {
    const running = !err && parseInt(stdout.trim(), 10) > 0;
    const config = readConfigEnv();
    res.json({
      success: true,
      running,
      botName: config.BOT_NAME || "VORTEX-XMD",
      ownerName: config.OWNER_NAME || "HansTz",
      ownerNumber: config.OWNER_NUMBER || "255753668403",
      mode: config.MODE || "public",
      prefix: config.PREFIX || ".",
    });
  });
});

// POST /api/vortex/session  — update SESSION_ID, clear stale creds, restart bot
router.post("/vortex/session", (req, res) => {
  try {
    const raw: string = (req.body.sessionId || "").trim();
    if (!raw) return res.status(400).json({ success: false, error: "sessionId is required" });

    // Accept full "HansTz&<hash>" format or bare hash
    const sessionId = raw.replace(/^HansTz&/, "");

    // 1. Save to config.env
    const current = readConfigEnv();
    const merged = { ...current, SESSION_ID: sessionId };
    writeConfigEnv(merged);

    // 2. Also patch config.js fallback value so it survives env resets
    const CONFIG_JS = path.resolve("/home/runner/workspace/vortex-xmd/config.js");
    if (fs.existsSync(CONFIG_JS)) {
      const src = fs.readFileSync(CONFIG_JS, "utf8");
      const patched = src.replace(
        /SESSION_ID:\s*process\.env\.SESSION_ID\s*\|\|\s*"[^"]*"/,
        `SESSION_ID: process.env.SESSION_ID || "${sessionId}"`
      );
      fs.writeFileSync(CONFIG_JS, patched, "utf8");
    }

    // 3. Wipe stale session files
    const SESSIONS_DIR = path.resolve("/home/runner/workspace/vortex-xmd/sessions");
    if (fs.existsSync(SESSIONS_DIR)) {
      for (const f of fs.readdirSync(SESSIONS_DIR)) {
        if (f === "temp") continue;
        fs.rmSync(path.join(SESSIONS_DIR, f), { recursive: true, force: true });
      }
    }

    // 4. Restart bot process (workflow auto-restarts on exit)
    exec("pkill -f 'vortex-xmd/index.js' || true", () => {});

    return res.json({ success: true, sessionId, message: "Session updated — bot is restarting." });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/vortex/plugins
router.get("/vortex/plugins", (_req, res) => {
  try {
    const files = fs.readdirSync(PLUGINS_DIR)
      .filter(f => f.endsWith(".js"))
      .map(f => ({
        name: f.replace(".js", ""),
        file: f,
        size: fs.statSync(path.join(PLUGINS_DIR, f)).size,
      }));
    res.json({ success: true, plugins: files, total: files.length });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
