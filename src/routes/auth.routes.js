
"use strict";

const express = require("express");

const { pool } = require("../config/database");
const { createSession } = require("../services/session.service");
const { setSessionCookie } = require("../utils/cookies");

const router = express.Router();

/**
 * Création atomique d'un compte invité et de sa session.
 */
router.post("/guest", async (req, res) => {
  const client = await pool.connect();

  try {
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
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Erreur rollback :", rollbackError.message);
    }

    console.error("Erreur création invité :", error.message);

    return res.status(500).json({
      error: "Impossible de créer le compte invité."
    });

  } finally {
    client.release();
  }
});

module.exports = router;
