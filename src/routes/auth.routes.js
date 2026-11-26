"use strict";

const express = require("express");
const crypto = require("crypto");
const { promisify } = require("util");
const scrypt = promisify(crypto.scrypt);

const { pool, query } = require("../config/database");
const { createSession } = require("../services/session.service");
const { setSessionCookie, clearSessionCookie } = require("../utils/cookies");
const { requireAuth } = require("../middleware/auth.middleware");
const { isValidEmail } = require("../utils/validation");

const router = express.Router();

router.get("/session", requireAuth, async (req, res) => {
  return res.status(200).json({
    success: true,
    user: {
      id: req.user.id,
      isGuest: req.user.isGuest === true,
      role: req.user.role,
      email: req.user.email || null
    }
  });
});


const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = await scrypt(password, salt, 64, SCRYPT_OPTIONS);
  return "scrypt$" + salt.toString("hex") + "$" + Buffer.from(derived).toString("hex");
}

async function verifyPassword(password, stored) {
  if (typeof stored !== "string") return false;
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt" ||
      !/^[a-f0-9]{32}$/i.test(parts[1]) || !/^[a-f0-9]{128}$/i.test(parts[2])) return false;
  const expected = Buffer.from(parts[2], "hex");
  const actual = Buffer.from(await scrypt(password, Buffer.from(parts[1], "hex"), 64, SCRYPT_OPTIONS));
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

router.post("/register", requireAuth, requireSameOrigin, async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  if (!isValidEmail(email) || email.length > 254) {
    return res.status(400).json({ error: "Saisis une adresse e-mail valide." });
  }
  if (typeof password !== "string" || password.length < 10 || password.length > 128) {
    return res.status(400).json({ error: "Le mot de passe doit contenir entre 10 et 128 caractères." });
  }
  if (!req.user.isGuest) {
    return res.status(409).json({ error: "Ce compte possède déjà un accès permanent. Utilise la connexion si nécessaire." });
  }

  try {
    const passwordHash = await hashPassword(password);
    const result = await query(
      `UPDATE public.users
       SET email = $2, password_hash = $3, is_guest = FALSE, updated_at = NOW()
       WHERE id = $1 AND is_guest = TRUE AND email IS NULL
       RETURNING id, email, is_guest`,
      [req.user.id, email, passwordHash]
    );
    if (!result.rows.length) {
      return res.status(409).json({ error: "Ce compte invité ne peut plus être converti. Déconnecte-toi puis crée un nouveau compte." });
    }
    return res.status(201).json({
      success: true,
      user: { id: result.rows[0].id, email: result.rows[0].email, isGuest: false },
      message: "Compte créé. Tes conversations et tes favoris sont conservés."
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "Cette adresse e-mail est déjà associée à un compte. Utilise « Se connecter »." });
    }
    console.error("Erreur création compte permanent :", error.message);
    return res.status(500).json({ error: "Impossible de créer le compte pour le moment." });
  }
});

router.post("/login", requireSameOrigin, async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  if (!isValidEmail(email) || email.length > 254 ||
      typeof password !== "string" || password.length > 128) {
    return res.status(400).json({ error: "Adresse e-mail ou mot de passe invalide." });
  }

  try {
    const result = await query(
      "SELECT id, email, password_hash, is_guest FROM public.users WHERE lower(email) = $1 AND is_guest = FALSE LIMIT 1",
      [email]
    );
    const account = result.rows[0];
    const valid = account ? await verifyPassword(password, account.password_hash) : false;
    if (!valid) {
      return res.status(401).json({ error: "Adresse e-mail ou mot de passe incorrect." });
    }

    const session = await createSession(account.id);
    setSessionCookie(res, session.token);
    return res.status(200).json({
      success: true,
      user: { id: account.id, email: account.email, isGuest: false },
      session: { expiresAt: session.expiresAt }
    });
  } catch (error) {
    console.error("Erreur de connexion :", error.message);
    return res.status(500).json({ error: "Impossible de se connecter pour le moment." });
  }
});

router.post("/password", requireAuth, requireSameOrigin, async (req, res) => {
  const currentPassword = req.body && req.body.currentPassword;
  const newPassword = req.body && req.body.newPassword;
  if (typeof currentPassword !== "string" || currentPassword.length > 128 ||
      typeof newPassword !== "string" || newPassword.length < 10 || newPassword.length > 128) {
    return res.status(400).json({ error: "Le nouveau mot de passe doit contenir entre 10 et 128 caractères." });
  }
  if (req.user.isGuest) return res.status(403).json({ error: "Crée d'abord un compte permanent pour modifier ton mot de passe." });

  let client;
  try {
    const accountResult = await query(
      "SELECT password_hash FROM public.users WHERE id = $1 AND is_guest = FALSE LIMIT 1",
      [req.user.id]
    );
    const account = accountResult.rows[0];
    if (!account || !await verifyPassword(currentPassword, account.password_hash)) {
      return res.status(401).json({ error: "Ton mot de passe actuel est incorrect." });
    }

    const passwordHash = await hashPassword(newPassword);
    client = await pool.connect();
    await client.query("BEGIN");
    await client.query(
      "UPDATE public.users SET password_hash = $2, updated_at = NOW() WHERE id = $1",
      [req.user.id, passwordHash]
    );
    await client.query(
      "UPDATE public.user_sessions SET is_revoked = TRUE, updated_at = NOW() WHERE user_id = $1 AND id <> $2 AND is_revoked = FALSE",
      [req.user.id, req.user.sessionId]
    );
    await client.query("COMMIT");
    return res.status(200).json({ success: true, message: "Mot de passe modifié. Les autres sessions ont été déconnectées." });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    console.error("Erreur de modification du mot de passe :", error.message);
    return res.status(500).json({ error: "Impossible de modifier ton mot de passe pour le moment." });
  } finally {
    if (client) client.release();
  }
});

router.post("/logout", requireAuth, requireSameOrigin, async (req, res) => {
  try {
    await query("UPDATE public.user_sessions SET is_revoked = TRUE, updated_at = NOW() WHERE id = $1", [req.user.sessionId]);
    clearSessionCookie(res);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Erreur de déconnexion :", error.message);
    return res.status(500).json({ error: "Impossible de se déconnecter pour le moment." });
  }
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
