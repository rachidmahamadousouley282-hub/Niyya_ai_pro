
"use strict";

const crypto = require("crypto");
const { query } = require("../config/database");

function validateUserId(userId) {
  if (
    typeof userId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)
  ) {
    throw new Error("Identifiant utilisateur invalide.");
  }
}

function validateRequestId(requestId) {
  if (
    typeof requestId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)
  ) {
    throw new Error("Identifiant de requête invalide.");
  }
}

/**
 * Consomme un message.
 *
 * requestId doit être généré par le serveur appelant
 * et conservé pour toute nouvelle tentative de la même requête.
 */
async function consumeMessage(userId, requestId = crypto.randomUUID()) {
  validateUserId(userId);
  validateRequestId(requestId);

  const result = await query(
    `SELECT * FROM public.consume_message_v2($1, $2)`,
    [userId, requestId]
  );

  if (!result.rows.length) {
    throw new Error("Aucun resultat de consommation.");
  }

  const quota = result.rows[0];

  return {
    allowed: quota.allowed,
    reason: quota.reason,
    remaining: quota.remaining,
    tier: quota.tier,
    requestId
  };
}

/**
 * Rembourse une consommation après un échec de génération.
 *
 * Le même requestId ne peut être remboursé qu'une seule fois.
 */
async function refundMessage(userId, requestId) {
  validateUserId(userId);
  validateRequestId(requestId);

  const result = await query(
    `SELECT public.refund_message_v2($1, $2) AS refunded`,
    [userId, requestId]
  );

  if (!result.rows.length) {
    throw new Error("Aucun resultat de remboursement.");
  }

  return {
    refunded: result.rows[0].refunded === true,
    requestId
  };
}

/**
 * Attribution d'une récompense publicitaire.
 *
 * IMPORTANT :
 * Cette fonction doit être appelée uniquement par un composant
 * serveur après vérification authentifiée du webhook du fournisseur.
 *
 * Ne jamais transmettre cet objet directement depuis le navigateur.
 * Le champ event.verified n'est volontairement pas utilisé comme preuve.
 */
async function grantRewardedVideoAfterVerification(verifiedEvent) {
  if (!verifiedEvent || typeof verifiedEvent !== "object") {
    throw new Error("Evenement publicitaire invalide.");
  }

  const { userId, provider, providerEventId } = verifiedEvent;

  validateUserId(userId);

  if (
    typeof provider !== "string" ||
    !provider.trim() ||
    provider.trim().length > 100 ||
    typeof providerEventId !== "string" ||
    !providerEventId.trim() ||
    providerEventId.trim().length > 255
  ) {
    throw new Error("Parametres publicitaires invalides.");
  }

  const result = await query(
    `SELECT * FROM public.grant_rewarded_video_v2($1, $2, $3)`,
    [userId, provider.trim(), providerEventId.trim()]
  );

  if (!result.rows.length) {
    throw new Error("Aucun resultat de recompense.");
  }

  return result.rows[0];
}

module.exports = {
  consumeMessage,
  refundMessage,
  grantRewardedVideoAfterVerification
};
