"use strict";

const crypto = require("crypto");
const { query } = require("../config/database");

function getSessionToken(req) {
  const cookieHeader = req.headers.cookie || "";

  for (const cookie of cookieHeader.split(";")) {
    const separator = cookie.indexOf("=");

    if (separator === -1) continue;

    const name = cookie.slice(0, separator).trim();
    const value = cookie.slice(separator + 1).trim();

    if (name === "niyya_session") {
      try {
        return decodeURIComponent(value);
      } catch {
        return null;
      }
    }
  }

  return null;
}

async function requireAuth(req, res, next) {
  try {
    const token = getSessionToken(req);

    // Le service de session génère un jeton de 64 caractères hexadécimaux.
    if (
      typeof token !== "string" ||
      !/^[a-f0-9]{64}$/i.test(token)
    ) {
      return res.status(401).json({
        error: "Authentification requise."
      });
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const result = await query(
      `SELECT
         s.id AS session_id,
         u.id AS user_id,
         u.role,
         u.is_guest
       FROM public.user_sessions AS s
       INNER JOIN public.users AS u
         ON u.id = s.user_id
       WHERE s.refresh_token_hash = $1
         AND s.is_revoked = FALSE
         AND s.is_compromised = FALSE
         AND s.expires_at > NOW()
       LIMIT 1`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: "Session invalide ou expirée."
      });
    }

    const session = result.rows[0];

    req.user = {
      id: session.user_id,
      role: session.role,
      isGuest: session.is_guest,
      sessionId: session.session_id
    };

    return next();

  } catch (error) {
    console.error(
      "Erreur de vérification de session :",
      error.message
    );

    return res.status(500).json({
      error: "Impossible de vérifier la session."
    });
  }
}

module.exports = {
  requireAuth
};
