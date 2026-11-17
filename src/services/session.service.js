
"use strict";

const crypto = require("crypto");
const { query } = require("../config/database");

const SESSION_DURATION_DAYS = 30;

/**
 * Génère une empreinte SHA-256 du jeton.
 */
function hashToken(token) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

/**
 * Crée une nouvelle session sécurisée.
 */
async function createSession(userId) {
  if (!userId) {
    throw new Error("Identifiant utilisateur manquant.");
  }

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const familyId = crypto.randomUUID();

  const result = await query(
    `INSERT INTO public.user_sessions (
       user_id,
       refresh_token_hash,
       family_id,
       expires_at
     )
     VALUES (
       $1,
       $2,
       $3,
       NOW() + ($4 * INTERVAL '1 day')
     )
     RETURNING id, family_id, expires_at`,
    [
      userId,
      tokenHash,
      familyId,
      SESSION_DURATION_DAYS
    ]
  );

  if (!result.rows.length) {
    throw new Error("Impossible de créer la session.");
  }

  return {
    token,
    sessionId: result.rows[0].id,
    familyId: result.rows[0].family_id,
    expiresAt: result.rows[0].expires_at
  };
}

/**
 * Recherche une session à partir de son jeton.
 */
async function findSessionByToken(token) {
  if (
    typeof token !== "string" ||
    token.length !== 64 ||
    !/^[a-f0-9]{64}$/i.test(token)
  ) {
    return null;
  }

  const tokenHash = hashToken(token);

  const result = await query(
    `SELECT
       s.id AS session_id,
       s.user_id,
       s.family_id,
       s.expires_at,
       u.role,
       u.is_guest
     FROM public.user_sessions s
     JOIN public.users u ON u.id = s.user_id
     WHERE s.refresh_token_hash = $1
       AND s.is_revoked = FALSE
       AND s.is_compromised = FALSE
       AND s.expires_at > NOW()
     LIMIT 1`,
    [tokenHash]
  );

  if (!result.rows.length) {
    return null;
  }

  return result.rows[0];
}

module.exports = {
  hashToken,
  createSession,
  findSessionByToken
};
