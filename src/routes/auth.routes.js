

"use strict";

const express = require("express");
const crypto = require("crypto");

const { query } = require("../config/database");
const { createSession } = require("../services/session.service");
const { setSessionCookie } = require("../utils/cookies");

const router = express.Router();

/**
 * Création d'un compte invité.
 */
router.post("/guest", async (req, res) => {
  try {
    const result = await query(
      "SELECT public.create_guest_user() AS user_id"
    );

    const userId = result.rows[0]?.user_id;

    if (!userId) {
      throw new Error("Création du compte invité impossible.");
    }

    const session = await createSession(userId);

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
    console.error("Erreur création invité :", error.message);

    return res.status(500).json({
      error: "Impossible de créer le compte invité."
    });
  }
});

module.exports = router;
