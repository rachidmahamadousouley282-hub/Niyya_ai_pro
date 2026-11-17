
const crypto = require("crypto");
const { query } = require("../config/database");

function getSessionToken(req) {
  const cookieHeader = req.headers.cookie || "";

  const cookies = cookieHeader.split(";");

  for (const cookie of cookies) {
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

    if (!token || token.length < 32 || token.length > 512) {
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
       FROM user_sessions s
       JOIN users u ON u.id = s.user_id
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

    req.user = {
      id: result.rows[0].user_id,
      role: result.rows[0].role,
      isGuest: result.rows[0].is_guest,
      sessionId: result.rows[0].session_id
    };

    next();
  } catch (error) {
    console.error("Erreur d'authentification :", error.message);

    return res.status(500).json({
      error: "Impossible de vérifier la session."
    });
  }
}

module.exports = {
  requireAuth
};
