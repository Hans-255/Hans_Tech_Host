import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// API routes
app.use("/api", router);

// Serve built frontend at /bot-dashboard/
const frontendDir = path.join(__dirname, "public", "bot-dashboard");
app.use("/bot-dashboard", express.static(frontendDir));
// Express v5: wildcards must be named — use regex instead
app.get(/^\/bot-dashboard(\/.*)?$/, (_req, res) => {
  res.sendFile(path.join(frontendDir, "index.html"));
});

// Root redirect
app.get("/", (_req, res) => res.redirect("/bot-dashboard/"));

export default app;
