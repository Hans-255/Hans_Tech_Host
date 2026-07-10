import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const root = path.dirname(new URL(import.meta.url).pathname);
const src = path.resolve(root, "..", "bot-dashboard", "dist", "public");
const dest = path.resolve(root, "..", "api-server", "dist", "public", "bot-dashboard");

if (!existsSync(src)) {
  throw new Error(`Frontend build output not found at ${src}. Run the bot-dashboard build first.`);
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log(`Copied frontend build from ${src} to ${dest}`);
