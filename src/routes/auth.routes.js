"use strict";

const express = require("express");

const { pool, query } = require("../config/database");
const { createSession } = require("../services/session.service");
const { setSessionCookie } = require("../utils/cookies");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/session", requireAuth, (req, res) => {
  return res.status(200).json({
    success: true,
    user: {
      id: req.user.id,
      isGuest: req.user.isGuest === true,
      role: req.user.role
    }
  });
});

router.post("/guest", async (req, res) => {
  let client;

  try {
    client = await pool.connect();

    await client.query("BEGIN");

    const result = await client.query(
      "SELECT public.create_guest_user() AS user_id"
    );

    const userId = result.rows[0]?.user_id;

    if (!userId) {
      throw new Error("Création du compte invité impossible.");
    }

    const session = await createSession(userId, client);

    await client.query("COMMIT");

    setSessionCookie(res, session.token);

    return res.status(201).json({
      success: true,
      user: {
        id: userId,
        isGuest: true
      },
      session: {
        expiresAt: session.expiresAt
      }
    });

  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Erreur rollback :", rollbackError.message);
      }
    }

    console.error("Erreur création invité :", error.message);

    return res.status(500).json({
      error: "Impossible de créer le compte invité."
    });

  } finally {
    if (client) {
      client.release();
    }
  }
});


function requireSameOrigin(req, res, next) {
  const origin = req.get("origin");
  const host = req.get("host");
  if (!origin || !host) {
    return res.status(403).json({ error: "Origine de requête non vérifiée." });
  }
  try {
    const parsed = new URL(origin);
    if (parsed.host !== host || (process.env.NODE_ENV === "production" && parsed.protocol !== "https:")) {
      return res.status(403).json({ error: "Origine de requête non autorisée." });
    }
  } catch {
    return res.status(403).json({ error: "Origine de requête invalide." });
  }
  return next();
}

router.post("/onboarding", requireAuth, requireSameOrigin, async (req, res) => {
  const body = req.body || {};
  const allowedAgeBands = new Set(["13_15", "16_17", "18_plus"]);
  if (!allowedAgeBands.has(body.ageBand)) {
    return res.status(400).json({ error: "Choisis une tranche d’âge valide." });
  }
  if (body.acceptedTerms !== true) {
    return res.status(400).json({ error: "Tu dois accepter les conditions pour continuer." });
  }

  const language = typeof body.language === "string" ? body.language.trim() : "";
  const country = typeof body.country === "string" ? body.country.trim().toUpperCase() : "";
  const pseudonym = typeof body.pseudonym === "string" ? body.pseudonym.trim() : "";

  try {
    const result = await query(
      "SELECT * FROM public.complete_onboarding_v2($1, $2, $3, $4, $5, $6)",
      [req.user.id, language, country, pseudonym, body.ageBand, "2.0"]
    );
    const outcome = result.rows[0];
    if (!outcome?.ok) {
      return res.status(400).json({ error: outcome?.message || "Impossible de terminer l’inscription." });
    }
    return res.status(200).json({
      success: true,
      ageBand: body.ageBand,
      creatorAccess: body.ageBand === "18_plus",
      messagesGranted: outcome.messages_granted
    });
  } catch (error) {
    console.error("Erreur onboarding :", error.message);
    return res.status(500).json({ error: "Impossible de terminer l’inscription pour le moment." });
  }
});

module.exports = router;
