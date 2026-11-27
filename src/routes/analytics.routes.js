"use strict";
const express = require("express");
const crypto = require("crypto");
const { rateLimit } = require("express-rate-limit");
const { query } = require("../config/database");
const router = express.Router();
const limiter = rateLimit({ windowMs: 60000, limit: 90, standardHeaders: "draft-8", legacyHeaders: false });
const VISITOR_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAGE_PATH = /^\/(?:[a-zA-Z0-9/_-]{0,90})(?:#[a-zA-Z0-9_-]{1,40})?$/;
router.post("/pageview", limiter, async (req, res) => {
  const origin = req.get("origin"), host = req.get("host");
  try {
    if (!origin || !host || new URL(origin).host !== host) return res.status(403).json({ error: "Origine non autorisée." });
  } catch { return res.status(403).json({ error: "Origine invalide." }); }
  const visitorId = typeof req.body?.visitorId === "string" ? req.body.visitorId : "";
  const pagePath = typeof req.body?.path === "string" ? req.body.path : "";
  if (!VISITOR_ID.test(visitorId) || !PAGE_PATH.test(pagePath)) return res.status(400).json({ error: "Événement de fréquentation invalide." });
  const visitorHash = crypto.createHash("sha256").update(visitorId).digest("hex");
  try {
    await query("INSERT INTO public.site_analytics_events (visitor_key_hash, page_path) VALUES ($1, $2)", [visitorHash, pagePath]);
    return res.status(202).json({ success: true });
  } catch (error) {
    console.error("Erreur de mesure de fréquentation :", error.message);
    return res.status(503).json({ error: "Mesure temporairement indisponible." });
  }
});
module.exports = router;
