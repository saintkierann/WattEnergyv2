import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import dotenv from "dotenv";

// Load server-only secrets (ANTHROPIC_API_KEY) for the local dev proxy below.
// These never get exposed to the client — only the dev middleware reads them.
dotenv.config({ path: ".env.local" });
dotenv.config();

// Dev-only middleware that mirrors the Vercel /api/analyze-meal function, so
// `npm run dev` gives you the same scanner endpoint locally.
function devApi(): Plugin {
  return {
    name: "watt-dev-api",
    configureServer(server) {
      server.middlewares.use("/api/analyze-meal", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }
        let data = "";
        req.on("data", (c) => (data += c));
        req.on("end", async () => {
          try {
            const body = JSON.parse(data || "{}");
            const { analyzeMealCore } = await import("./src/server/analyzeMeal.ts");
            const { status, json } = await analyzeMealCore(body);
            res.statusCode = status;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(json));
          } catch (e: any) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Dev proxy error: " + (e?.message || e) }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devApi()],
});
