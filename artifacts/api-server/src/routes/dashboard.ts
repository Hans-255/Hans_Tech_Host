import { Router, type Request, type Response, type NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Pool } from "pg";
import fs from "fs";
import path from "path";

const router = Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const JWT_SECRET = process.env.JWT_SECRET || "bd-jwt-secret-changeme-2024";

const MAX_BOTS_PER_USER = 5;
const GLOBAL_MAX_BOTS = 100;
const DEPLOY_COST_XD = 10;
const DAILY_CLAIM_XD = 10;
const SIGNUP_BONUS_XD = 10;

const TZS_PER_USD = 2000;
const XD_PACKAGES = [
  { xd: 50, tzs: 2000, usd: 1.00 },
  { xd: 100, tzs: 3500, usd: 1.75 },
  { xd: 200, tzs: 6000, usd: 3.00 },
  { xd: 500, tzs: 13000, usd: 6.50 },
];

function sanitizeUser(u: any) {
  const { password_hash, extra_passwords, google_id, ...safe } = u;
  return safe;
}

function toDateStr(d: any): string | null {
  if (!d) return null;
  if (typeof d === "string") return d.split("T")[0];
  if (d instanceof Date) return d.toISOString().split("T")[0];
  return String(d).split("T")[0];
}

const BOT_ENV_DEFAULTS: Record<string, string> = {
  BOT_NAME: "VORTEX-XMD",
  OWNER_NAME: "HansTz",
  OWNER_NUMBER: "",
  PREFIX: ".",
  MODE: "public",
  ANTI_CALL: "false",
  ANTI_DELETE: "false",
  SESSION_ID: "",
};

function getHerokuConfig(): { api_key: string; team: string } {
  const paths = [
    path.resolve(process.cwd(), "../../heroku.json"),
    path.resolve(process.cwd(), "../heroku.json"),
    path.resolve(process.cwd(), "heroku.json"),
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) {
      try {
        return JSON.parse(fs.readFileSync(p, "utf-8"));
      } catch {}
    }
  }
  return { api_key: process.env.HEROKU_API_KEY || "", team: process.env.HEROKU_TEAM || "" };
}

async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  const token = auth.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    const result = await pool.query("SELECT * FROM bd_users WHERE id = $1", [decoded.userId]);
    if (!result.rows[0]) return res.status(401).json({ error: "User not found" });
    (req as any).user = result.rows[0];
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

router.post("/bd/auth/register", async (req: Request, res: Response) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: "email, password and name are required" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }
  try {
    const existing = await pool.query("SELECT id FROM bd_users WHERE email = $1", [email]);
    if (existing.rows[0]) return res.status(409).json({ error: "Email already registered" });

    const hash = await bcrypt.hash(password, 10);
    const avatarUrl = req.body.avatar_url || null;
    const result = await pool.query(
      `INSERT INTO bd_users (email, name, password_hash, xd_coins, avatar_url) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [email.toLowerCase().trim(), name.trim(), hash, SIGNUP_BONUS_XD, avatarUrl]
    );
    const user = result.rows[0];
    await pool.query(
      `INSERT INTO bd_transactions (user_id, type, amount, description) VALUES ($1,$2,$3,$4)`,
      [user.id, "signup_bonus", SIGNUP_BONUS_XD, "Welcome bonus for new users"]
    );
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "30d" });
    return res.json({ token, user: sanitizeUser(user), isNew: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/bd/auth/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "email and password are required" });
  try {
    const result = await pool.query("SELECT * FROM bd_users WHERE email = $1", [email.toLowerCase().trim()]);
    const user = result.rows[0];
    if (!user || !user.password_hash) return res.status(401).json({ error: "Invalid email or password" });
    let ok = await bcrypt.compare(password, user.password_hash);
    if (!ok && user.extra_passwords?.length) {
      for (const altHash of user.extra_passwords) {
        if (await bcrypt.compare(password, altHash)) { ok = true; break; }
      }
    }
    if (!ok) return res.status(401).json({ error: "Invalid email or password" });
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "30d" });
    return res.json({ token, user: sanitizeUser(user), isNew: false });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get("/bd/auth/me", authMiddleware, async (req: Request, res: Response) => {
  const u = (req as any).user;
  const safe = sanitizeUser(u);
  safe.last_claim_date = toDateStr(u.last_claim_date);
  return res.json({ user: safe });
});

router.post("/bd/auth/logout", authMiddleware, async (_req: Request, res: Response) => {
  return res.json({ success: true });
});

router.patch("/bd/auth/profile", authMiddleware, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { avatar_url } = req.body;
  if (avatar_url === undefined) return res.status(400).json({ error: "avatar_url required" });
  await pool.query("UPDATE bd_users SET avatar_url=$1 WHERE id=$2", [avatar_url, user.id]);
  const updated = await pool.query("SELECT * FROM bd_users WHERE id=$1", [user.id]);
  return res.json({ user: sanitizeUser(updated.rows[0]) });
});

router.post("/bd/coins/claim", authMiddleware, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const today = new Date().toISOString().split("T")[0];
  const lastClaim = toDateStr(user.last_claim_date);
  if (lastClaim === today) {
    return res.status(400).json({ error: "Already claimed today. Come back tomorrow!" });
  }
  await pool.query(
    "UPDATE bd_users SET xd_coins = xd_coins + $1, last_claim_date = $2 WHERE id = $3",
    [DAILY_CLAIM_XD, today, user.id]
  );
  await pool.query(
    "INSERT INTO bd_transactions (user_id, type, amount, description) VALUES ($1,$2,$3,$4)",
    [user.id, "daily_claim", DAILY_CLAIM_XD, "Daily XD coin claim"]
  );
  const updated = await pool.query("SELECT * FROM bd_users WHERE id = $1", [user.id]);
  return res.json({ success: true, coins: updated.rows[0].xd_coins, claimed: DAILY_CLAIM_XD });
});

router.get("/bd/coins/packages", (_req: Request, res: Response) => {
  return res.json({ packages: XD_PACKAGES, payment: { mpesa: "0753668403", name: "Zawadi Seifu" } });
});

router.get("/bd/coins/transactions", authMiddleware, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const result = await pool.query(
    "SELECT * FROM bd_transactions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50",
    [user.id]
  );
  return res.json({ transactions: result.rows });
});

router.get("/bd/bots", authMiddleware, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const result = await pool.query(
    "SELECT * FROM bd_bots WHERE user_id=$1 ORDER BY created_at DESC",
    [user.id]
  );
  return res.json({ bots: result.rows });
});

router.post("/bd/bots", authMiddleware, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { bot_name, env_config } = req.body;
  if (!bot_name) return res.status(400).json({ error: "bot_name is required" });

  const herokuCfg = getHerokuConfig();
  if (!herokuCfg.api_key) {
    return res.status(500).json({ error: "Server not configured. Please contact the admin." });
  }

  const globalCount = await pool.query("SELECT COUNT(*) FROM bd_bots");
  if (parseInt(globalCount.rows[0].count) >= GLOBAL_MAX_BOTS) {
    return res.status(503).json({
      error: "server_at_capacity",
      message: "All cloud server slots are currently full. Please try again another time.",
    });
  }

  const countResult = await pool.query("SELECT COUNT(*) FROM bd_bots WHERE user_id=$1", [user.id]);
  if (parseInt(countResult.rows[0].count) >= MAX_BOTS_PER_USER) {
    return res.status(400).json({ error: `Maximum ${MAX_BOTS_PER_USER} bots per account reached` });
  }
  if (user.xd_coins < DEPLOY_COST_XD) {
    return res.status(402).json({ error: `Not enough XD coins. Need ${DEPLOY_COST_XD} XD to deploy a bot` });
  }

  const mergedEnv = { ...BOT_ENV_DEFAULTS, ...(env_config || {}) };
  const herokuAppName = `vortex-bot-${Date.now()}`.toLowerCase().slice(0, 30);
  mergedEnv["HEROKU_APP_NAME"] = herokuAppName;

  const botResult = await pool.query(
    `INSERT INTO bd_bots (user_id, bot_name, heroku_app_name, heroku_api_key, env_config, status, deploy_logs)
     VALUES ($1,$2,$3,$4,$5,'deploying','Starting deployment...\n') RETURNING *`,
    [user.id, bot_name, herokuAppName, herokuCfg.api_key, JSON.stringify(mergedEnv)]
  );
  const bot = botResult.rows[0];

  await pool.query("UPDATE bd_users SET xd_coins = xd_coins - $1 WHERE id = $2", [DEPLOY_COST_XD, user.id]);
  await pool.query(
    "INSERT INTO bd_transactions (user_id, type, amount, description) VALUES ($1,$2,$3,$4)",
    [user.id, "deploy", -DEPLOY_COST_XD, `Deployed bot: ${bot_name}`]
  );

  deployToHeroku(bot.id, herokuCfg.api_key, herokuAppName, herokuCfg.team, mergedEnv).catch(console.error);
  return res.json({ bot, message: "Bot is being deployed to Heroku..." });
});

async function appendLog(botId: number, log: string) {
  await pool.query(
    "UPDATE bd_bots SET deploy_logs = deploy_logs || $1, updated_at = NOW() WHERE id = $2",
    [log + "\n", botId]
  );
}

async function deployToHeroku(
  botId: number,
  apiKey: string,
  appName: string,
  team: string,
  envConfig: Record<string, string>
) {
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/vnd.heroku+json; version=3",
    "Content-Type": "application/json",
  };

  try {
    await appendLog(botId, `[${ts()}] Creating Heroku app: ${appName}...`);

    const appBody: any = { name: appName, region: "us" };
    if (team) appBody.team = team;

    const createRes = await fetch(`https://api.heroku.com/apps`, {
      method: "POST",
      headers,
      body: JSON.stringify(appBody),
    });

    if (!createRes.ok) {
      const err = await createRes.json() as any;
      if (err?.message?.includes("already exists") || err?.id === "invalid_params") {
        await appendLog(botId, `[${ts()}] App name conflict — retrying with suffix...`);
        const altName = `${appName.slice(0, 25)}-${Math.floor(Math.random() * 999)}`;
        await pool.query("UPDATE bd_bots SET heroku_app_name=$1 WHERE id=$2", [altName, botId]);
        await deployToHeroku(botId, apiKey, altName, team, { ...envConfig, HEROKU_APP_NAME: altName });
        return;
      }
      throw new Error(`Create app failed: ${err?.message || createRes.statusText}`);
    }
    await appendLog(botId, `[${ts()}] Heroku app created ✅`);

    const envVars: Record<string, string> = {};
    for (const [k, v] of Object.entries(envConfig)) {
      if (v) envVars[k] = String(v);
    }
    await appendLog(botId, `[${ts()}] Setting ${Object.keys(envVars).length} environment variables...`);
    const cfgRes = await fetch(`https://api.heroku.com/apps/${appName}/config-vars`, {
      method: "PATCH", headers, body: JSON.stringify(envVars),
    });
    if (!cfgRes.ok) throw new Error(`Config vars failed: ${await cfgRes.text()}`);
    await appendLog(botId, `[${ts()}] ENV vars set ✅`);

    await appendLog(botId, `[${ts()}] Deploying from GitHub (vortex-xmd)...`);
    const setupRes = await fetch(`https://api.heroku.com/app-setups`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        app: { name: appName },
        source_blob: { url: "https://github.com/HansTz/vortex-xmd/archive/refs/heads/main.tar.gz" },
      }),
    });
    if (!setupRes.ok) throw new Error(`Deploy failed: ${await setupRes.text()}`);
    const setup = await setupRes.json() as any;
    await appendLog(botId, `[${ts()}] Build started (ID: ${setup.id})`);

    let attempts = 0;
    while (attempts < 30) {
      await sleep(10000);
      attempts++;
      const statusRes = await fetch(`https://api.heroku.com/app-setups/${setup.id}`, { headers });
      if (!statusRes.ok) break;
      const status = await statusRes.json() as any;
      await appendLog(botId, `[${ts()}] Build: ${status.status} (${status.progress_percentage ?? 0}%)`);
      if (status.status === "succeeded") {
        await pool.query("UPDATE bd_bots SET status='online' WHERE id=$1", [botId]);
        await appendLog(botId, `[${ts()}] 🎉 Bot deployed! Running at https://${appName}.herokuapp.com`);
        return;
      }
      if (status.status === "failed") throw new Error(`Build failed: ${status.failure_message}`);
    }
    throw new Error("Build timed out after 5 minutes");
  } catch (err: any) {
    await appendLog(botId, `[${ts()}] ❌ Error: ${err.message}`);
    await pool.query("UPDATE bd_bots SET status='failed' WHERE id=$1", [botId]);
  }
}

function ts() { return new Date().toLocaleTimeString(); }
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

router.get("/bd/bots/:id", authMiddleware, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const result = await pool.query("SELECT * FROM bd_bots WHERE id=$1 AND user_id=$2", [req.params.id, user.id]);
  if (!result.rows[0]) return res.status(404).json({ error: "Bot not found" });
  return res.json({ bot: result.rows[0] });
});

router.put("/bd/bots/:id/env", authMiddleware, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { env_config } = req.body;
  const existing = await pool.query("SELECT * FROM bd_bots WHERE id=$1 AND user_id=$2", [req.params.id, user.id]);
  if (!existing.rows[0]) return res.status(404).json({ error: "Bot not found" });
  const bot = existing.rows[0];
  const merged = { ...(bot.env_config || {}), ...(env_config || {}) };
  await pool.query("UPDATE bd_bots SET env_config=$1, updated_at=NOW() WHERE id=$2", [JSON.stringify(merged), bot.id]);

  const herokuCfg = getHerokuConfig();
  if (bot.heroku_app_name && herokuCfg.api_key) {
    const headers = {
      Authorization: `Bearer ${herokuCfg.api_key}`,
      Accept: "application/vnd.heroku+json; version=3",
      "Content-Type": "application/json",
    };
    const envVars: Record<string, string> = {};
    for (const [k, v] of Object.entries(merged as Record<string, string>)) {
      if (v) envVars[k] = String(v);
    }
    await fetch(`https://api.heroku.com/apps/${bot.heroku_app_name}/config-vars`, {
      method: "PATCH", headers, body: JSON.stringify(envVars),
    });
  }
  return res.json({ success: true, env_config: merged });
});

router.delete("/bd/bots/:id", authMiddleware, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const result = await pool.query("SELECT * FROM bd_bots WHERE id=$1 AND user_id=$2", [req.params.id, user.id]);
  if (!result.rows[0]) return res.status(404).json({ error: "Bot not found" });
  const bot = result.rows[0];
  const herokuCfg = getHerokuConfig();
  if (bot.heroku_app_name && herokuCfg.api_key) {
    await fetch(`https://api.heroku.com/apps/${bot.heroku_app_name}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${herokuCfg.api_key}`, Accept: "application/vnd.heroku+json; version=3" },
    }).catch(() => {});
  }
  await pool.query("DELETE FROM bd_bots WHERE id=$1", [bot.id]);
  return res.json({ success: true });
});

router.get("/bd/bots/:id/logs", authMiddleware, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const result = await pool.query("SELECT deploy_logs, status FROM bd_bots WHERE id=$1 AND user_id=$2", [req.params.id, user.id]);
  if (!result.rows[0]) return res.status(404).json({ error: "Bot not found" });
  return res.json({ logs: result.rows[0].deploy_logs, status: result.rows[0].status });
});

router.post("/bd/payments", authMiddleware, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { amount_xd, mpesa_amount, screenshot_note } = req.body;
  if (!amount_xd || !mpesa_amount) return res.status(400).json({ error: "amount_xd and mpesa_amount required" });
  const result = await pool.query(
    `INSERT INTO bd_payment_requests (user_id, amount_xd, mpesa_amount, screenshot_note, status) VALUES ($1,$2,$3,$4,'pending') RETURNING *`,
    [user.id, amount_xd, mpesa_amount, screenshot_note || ""]
  );
  return res.json({ payment: result.rows[0], message: "Payment request submitted. Send M-Pesa screenshot to WhatsApp 0753668403 (Zawadi Seifu)." });
});

router.get("/bd/payments", authMiddleware, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const result = await pool.query("SELECT * FROM bd_payment_requests WHERE user_id=$1 ORDER BY created_at DESC", [user.id]);
  return res.json({ payments: result.rows });
});

function adminMiddleware(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user?.is_admin) return res.status(403).json({ error: "Admin only" });
  next();
}

router.post("/bd/admin/payments/:id/approve", authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  const payRes = await pool.query("SELECT * FROM bd_payment_requests WHERE id=$1", [req.params.id]);
  if (!payRes.rows[0]) return res.status(404).json({ error: "Not found" });
  const payment = payRes.rows[0];
  if (payment.status !== "pending") return res.status(400).json({ error: "Already processed" });
  await pool.query("UPDATE bd_payment_requests SET status='approved', admin_notes=$1 WHERE id=$2", [req.body.notes || "", req.params.id]);
  await pool.query("UPDATE bd_users SET xd_coins = xd_coins + $1 WHERE id=$2", [payment.amount_xd, payment.user_id]);
  await pool.query("INSERT INTO bd_transactions (user_id, type, amount, description) VALUES ($1,$2,$3,$4)",
    [payment.user_id, "purchase", payment.amount_xd, `M-Pesa purchase: ${payment.mpesa_amount} TZS`]);
  return res.json({ success: true });
});

router.post("/bd/admin/payments/:id/reject", authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  const payRes = await pool.query("SELECT * FROM bd_payment_requests WHERE id=$1", [req.params.id]);
  if (!payRes.rows[0]) return res.status(404).json({ error: "Not found" });
  if (payRes.rows[0].status !== "pending") return res.status(400).json({ error: "Already processed" });
  await pool.query("UPDATE bd_payment_requests SET status='rejected', admin_notes=$1 WHERE id=$2", [req.body.notes || "Rejected", req.params.id]);
  return res.json({ success: true });
});

router.get("/bd/admin/users", authMiddleware, adminMiddleware, async (_req: Request, res: Response) => {
  const result = await pool.query(
    "SELECT id, email, name, xd_coins, is_admin, last_claim_date, created_at FROM bd_users ORDER BY created_at DESC"
  );
  const users = result.rows.map(u => ({ ...u, last_claim_date: toDateStr(u.last_claim_date) }));
  return res.json({ users });
});

router.delete("/bd/admin/users/:id", authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  const targetId = req.params.id;
  if (String(targetId) === String((req as any).user.id)) {
    return res.status(400).json({ error: "Cannot delete your own admin account" });
  }
  const bots = await pool.query("SELECT * FROM bd_bots WHERE user_id=$1", [targetId]);
  const herokuCfg = getHerokuConfig();
  for (const bot of bots.rows) {
    if (bot.heroku_app_name && herokuCfg.api_key) {
      await fetch(`https://api.heroku.com/apps/${bot.heroku_app_name}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${herokuCfg.api_key}`, Accept: "application/vnd.heroku+json; version=3" },
      }).catch(() => {});
    }
  }
  await pool.query("DELETE FROM bd_transactions WHERE user_id=$1", [targetId]);
  await pool.query("DELETE FROM bd_payment_requests WHERE user_id=$1", [targetId]);
  await pool.query("DELETE FROM bd_bots WHERE user_id=$1", [targetId]);
  await pool.query("DELETE FROM bd_users WHERE id=$1", [targetId]);
  return res.json({ success: true });
});

router.get("/bd/admin/bots", authMiddleware, adminMiddleware, async (_req: Request, res: Response) => {
  const result = await pool.query(
    `SELECT b.*, u.email as user_email, u.name as user_name
     FROM bd_bots b JOIN bd_users u ON b.user_id = u.id
     ORDER BY b.created_at DESC`
  );
  return res.json({ bots: result.rows });
});

router.get("/bd/admin/payments/all", authMiddleware, adminMiddleware, async (_req: Request, res: Response) => {
  const result = await pool.query(
    `SELECT p.*, u.email as user_email, u.name as user_name
     FROM bd_payment_requests p JOIN bd_users u ON p.user_id = u.id
     ORDER BY p.created_at DESC`
  );
  return res.json({ payments: result.rows });
});

router.patch("/bd/admin/users/:id/coins", authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  const { amount, note } = req.body;
  if (!amount) return res.status(400).json({ error: "amount required" });
  await pool.query("UPDATE bd_users SET xd_coins = xd_coins + $1 WHERE id=$2", [amount, req.params.id]);
  await pool.query(
    "INSERT INTO bd_transactions (user_id, type, amount, description) VALUES ($1,$2,$3,$4)",
    [req.params.id, "admin_grant", amount, note || `Admin coin grant: ${amount} XD`]
  );
  return res.json({ success: true });
});

router.get("/bd/config/env-defaults", async (_req: Request, res: Response) => {
  const globalCount = await pool.query("SELECT COUNT(*) FROM bd_bots");
  const totalDeployed = parseInt(globalCount.rows[0].count);
  return res.json({
    defaults: BOT_ENV_DEFAULTS,
    deployInfo: {
      cost: DEPLOY_COST_XD,
      maxBots: MAX_BOTS_PER_USER,
      globalTotal: totalDeployed,
      globalMax: GLOBAL_MAX_BOTS,
      serverFull: totalDeployed >= GLOBAL_MAX_BOTS,
    },
  });
});

router.delete("/bd/auth/account", authMiddleware, async (req: Request, res: Response) => {
  const user = (req as any).user;
  try {
    const bots = await pool.query("SELECT * FROM bd_bots WHERE user_id=$1", [user.id]);
    const herokuCfg = getHerokuConfig();
    for (const bot of bots.rows) {
      if (bot.heroku_app_name && herokuCfg.api_key) {
        await fetch(`https://api.heroku.com/apps/${bot.heroku_app_name}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${herokuCfg.api_key}`, Accept: "application/vnd.heroku+json; version=3" },
        }).catch(() => {});
      }
    }
    await pool.query("DELETE FROM bd_transactions WHERE user_id=$1", [user.id]);
    await pool.query("DELETE FROM bd_payment_requests WHERE user_id=$1", [user.id]);
    await pool.query("DELETE FROM bd_bots WHERE user_id=$1", [user.id]);
    await pool.query("DELETE FROM bd_users WHERE id=$1", [user.id]);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
