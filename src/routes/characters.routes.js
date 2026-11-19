
"use strict";

const express = require("express");
const router = express.Router();

const { requireAuth } = require("../middleware/auth.middleware");
const characterEngine = require("../engines/character.engine");

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PUBLIC_CHARACTER_FIELDS = [
  "id",
  "slug",
  "name",
  "tagline",
  "avatar_url",
  "short_bio",
  "backstory",
  "profile_i18n",
  "personality_traits",
  "greeting",
  "category",
  "tags",
  "creator_pseudonym",
  "published_at",
  "created_at"
];

function publicCharacter(character) {
  if (!character) return null;

  const result = {};

  for (const field of PUBLIC_CHARACTER_FIELDS) {
    if (character[field] !== undefined) {
      result[field] = character[field];
    }
  }

  return result;
}

function parsePagination(value, fallback, maximum) {
  if (value === undefined) return fallback;

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    return null;
  }

  return Math.min(parsed, maximum);
}

// GET /api/characters
// Découverte des personnages publics et système.
router.get("/", async (req, res) => {
  try {
    const limit = parsePagination(req.query.limit, 20, 50);
    const offset = parsePagination(req.query.offset, 0, 10000);

    if (limit === null || offset === null) {
      return res.status(400).json({
        error: "Paramètres de pagination invalides."
      });
    }

    const characters =
      await characterEngine.listDiscoverableCharacters({
        limit,
        offset
      });

    return res.status(200).json({
      success: true,
      characters: Array.isArray(characters)
        ? characters.map(publicCharacter)
        : []
    });

  } catch (error) {
    console.error(
      "Erreur de découverte des personnages :",
      error.message
    );

    return res.status(500).json({
      error: "Impossible de charger les personnages."
    });
  }
});

// GET /api/characters/:characterId
// Consultation d'un personnage accessible à l'utilisateur.
router.get("/:characterId", requireAuth, async (req, res) => {
  try {
    const { characterId } = req.params;

    if (!UUID_REGEX.test(characterId)) {
      return res.status(400).json({
        error: "Identifiant de personnage invalide."
      });
    }

    const character =
      await characterEngine.getCharacterForConversation({
        characterId,
        userId: req.user.id
      });

    if (!character) {
      return res.status(404).json({
        error: "Personnage introuvable ou inaccessible."
      });
    }

    return res.status(200).json({
      success: true,
      character: publicCharacter(character)
    });

  } catch (error) {
    console.error(
      "Erreur de consultation du personnage :",
      error.message
    );

    return res.status(500).json({
      error: "Impossible de charger ce personnage."
    });
  }
});

module.exports = router;

