"use strict";

const express = require("express");
const { query } = require("../config/database");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();
const LANGUAGES = new Set(["fr", "en", "es", "ar"]);
const RESPONSE_LENGTHS = new Set(["short", "normal", "long"]);

function requireSameOrigin(req, res, next) {
  const origin = req.get("origin");
  const host = req.get("host");
  const fetchSite = req.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return res.status(403).json({ error: "Requête inter-origine refusée." });
  }
  if (!origin || !host) return res.status(403).json({ error: "Origine non vérifiée." });
  try {
    const parsed = new URL(origin);
    if (parsed.host !== host || (process.env.NODE_ENV === "production" && parsed.protocol !== "https:")) {
      return res.status(403).json({ error: "Origine non autorisée." });
    }
  } catch {
    return res.status(403).json({ error: "Origine invalide." });
  }
  return next();
}

router.get("/", requireAuth, async (req, res) => {
  try {
    const result = await query(
      "SELECT language_code, response_length, thinking_pause FROM public.users WHERE id = $1 LIMIT 1",
      [req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Compte introuvable." });
    const row = result.rows[0];
    return res.status(200).json({
      success: true,
      settings: {
        language: LANGUAGES.has(row.language_code) ? row.language_code : "fr",
        responseLength: RESPONSE_LENGTHS.has(row.response_length) ? row.response_length : "normal",
        thinkingPause: row.thinking_pause !== false
      }
    });
  } catch (error) {
    console.error("Erreur lecture paramètres :", error.message);
    return res.status(500).json({ error: "Impossible de charger les paramètres." });
  }
});

router.patch("/", requireAuth, requireSameOrigin, async (req, res) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const updates = [];
  const values = [];
  const add = (column, value) => {
    values.push(value);
    updates.push(column + " = $" + values.length);
  };

  if (Object.prototype.hasOwnProperty.call(body, "language")) {
    if (!LANGUAGES.has(body.language)) return res.status(400).json({ error: "Langue non prise en charge." });
    add("language_code", body.language);
  }
  if (Object.prototype.hasOwnProperty.call(body, "responseLength")) {
    if (!RESPONSE_LENGTHS.has(body.responseLength)) return res.status(400).json({ error: "Longueur de réponse invalide." });
    add("response_length", body.responseLength);
  }
  if (Object.prototype.hasOwnProperty.call(body, "thinkingPause")) {
    if (typeof body.thinkingPause !== "boolean") return res.status(400).json({ error: "Préférence de pause invalide." });
    add("thinking_pause", body.thinkingPause);
  }
  if (!updates.length) return res.status(400).json({ error: "Aucun paramètre valide à enregistrer." });

  values.push(req.user.id);
  try {
    const result = await query(
      "UPDATE public.users SET " + updates.join(", ") + ", updated_at = NOW() WHERE id = $" + values.length +
      " RETURNING language_code, response_length, thinking_pause",
      values
    );
    if (!result.rows.length) return res.status(404).json({ error: "Compte introuvable." });
    const row = result.rows[0];
    return res.status(200).json({
      success: true,
      settings: {
        language: LANGUAGES.has(row.language_code) ? row.language_code : "fr",
        responseLength: RESPONSE_LENGTHS.has(row.response_length) ? row.response_length : "normal",
        thinkingPause: row.thinking_pause !== false
      }
    });
  } catch (error) {
    console.error("Erreur enregistrement paramètres :", error.message);
    return res.status(500).json({ error: "Impossible d'enregistrer les paramètres." });
  }
});

module.exports = router;
