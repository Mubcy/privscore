// relayer-proxy/index.js
// Minimal, robust proxy using Node 18+ global fetch (no node-fetch import).
// Logs details for failed requests so you can see DNS/connection errors.

const express = require("express");
const path = require("path");
const fs = require("fs");
const helmet = require("helmet");
const cors = require("cors");
const bodyParser = require("body-parser");

const PORT = process.env.PORT || 3000;
const RELAYER_BASE = (process.env.RELAYER_BASE_URL || "https://relayer.zama.ai").replace(/\/$/, "");
const FRONTEND_DIST = process.env.FRONTEND_DIST || path.join(__dirname, "..", "frontend", "dist");
const DEV = process.env.NODE_ENV !== "production";

const app = express();

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl} from ${req.ip}`);
  next();
});

// allow local dev origins
app.use(cors({ origin: DEV ? ["http://localhost:5173", "http://127.0.0.1:5173"] : false }));

app.use(
  helmet({
    contentSecurityPolicy: DEV
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:"],
            connectSrc: ["'self'", "http://localhost:5173", "ws://localhost:5173", RELAYER_BASE],
          },
        }
      : undefined,
  })
);

app.use(bodyParser.json({ limit: "1mb" }));

app.get("/healthz", (req, res) => res.json({ ok: true }));

// POST /public-decrypt : forward to RELAYER_BASE/public-decrypt
app.post("/public-decrypt", async (req, res) => {
  const body = req.body || {};
  console.log("Proxy: /public-decrypt payload keys:", Object.keys(body));
  try {
    const url = RELAYER_BASE + "/public-decrypt";
    console.log("Proxy: forwarding to", url);

    // Use global fetch (Node 18+). See errors below in catch block.
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      // optional: increase timeout by using AbortController if needed
    });

    // Pass through status and response body
    const contentType = r.headers.get("content-type") || "";
    const text = await r.text();
    if (contentType.includes("application/json")) {
      try {
        const json = JSON.parse(text);
        res.status(r.status).json(json);
      } catch (err) {
        console.warn("Proxy: remote returned invalid JSON; returning raw text");
        res.status(r.status).send(text);
      }
    } else {
      res.status(r.status).send(text);
    }
  } catch (err) {
    // Very important: print full error so you can see DNS / ECONNREFUSED / etc.
    console.error("Proxy /public-decrypt fetch error:", err && err.stack ? err.stack : String(err));
    // Return a structured error that the frontend can display
    res.status(502).json({ error: "fetch failed", details: String(err && err.message ? err.message : err) });
  }
});

// serve frontend build if it exists
if (fs.existsSync(FRONTEND_DIST)) {
  console.log("Proxy: Serving frontend from", FRONTEND_DIST);
  app.use(express.static(FRONTEND_DIST));
  app.get("*", (req, res) => res.sendFile(path.join(FRONTEND_DIST, "index.html")));
} else {
  console.log("Proxy: No frontend build found at", FRONTEND_DIST);
}

app.listen(PORT, () => {
  console.log(`Relayer proxy listening on http://localhost:${PORT}`);
  console.log(`Relayer base url: ${RELAYER_BASE}`);
});
