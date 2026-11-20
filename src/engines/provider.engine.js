"use strict";

/**
 * NIYYA.ai V2
 * Provider Engine
 *
 * Le mode mock reste le mode par défaut.
 * Cloudflare Workers AI ne s'active que si le déploiement le demande
 * explicitement et si ses deux paramètres secrets sont présents.
 * Aucun fournisseur de secours payant n'est appelé automatiquement.
 */

const SUPPORTED_PROVIDERS = Object.freeze([
  "mock",
  "cloudflare",
  "openai",
  "anthropic",
  "google"
]);

const DEFAULT_PROVIDER = "mock";

const CLOUDFLARE_DEFAULT_MODEL = "@cf/zai-org/glm-4.7-flash";

function normalizeProvider(provider) {
  if (typeof provider !== "string" || !provider.trim()) {
    return DEFAULT_PROVIDER;
  }

  const normalized = provider.trim().toLowerCase();

  if (!SUPPORTED_PROVIDERS.includes(normalized)) {
    throw new Error("Fournisseur IA non pris en charge.");
  }

  return normalized;
}

function getProviderConfig() {
  const provider = normalizeProvider(
    process.env.AI_PROVIDER || DEFAULT_PROVIDER
  );

  if (provider === "mock") {
    return {
      provider: "mock",
      model: "niyya-mock-v1",
      mode: "free",
      apiKey: null
    };
  }

  if (provider === "cloudflare") {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiKey = process.env.CLOUDFLARE_API_TOKEN;

    if (!accountId || !apiKey) {
      throw new Error(
        "Cloudflare Workers AI n'est pas configuré : identifiant de compte ou jeton manquant."
      );
    }

    return {
      provider: "cloudflare",
      model: process.env.CLOUDFLARE_MODEL || CLOUDFLARE_DEFAULT_MODEL,
      mode: "cloudflare-free-tier",
      accountId,
      apiKey
    };
  }

  // Les autres fournisseurs restent désactivés : aucun fallback payant.
  throw new Error(
    "Ce fournisseur IA n'est pas activé dans NIYYA.ai."
  );
}

function getAvailableProviders() {
  return SUPPORTED_PROVIDERS.map(provider => {
    if (provider === "mock") {
      return {
        name: "mock",
        configured: true,
        mode: "free"
      };
    }

    if (provider === "cloudflare") {
      return {
        name: "cloudflare",
        configured: Boolean(
          process.env.CLOUDFLARE_ACCOUNT_ID &&
          process.env.CLOUDFLARE_API_TOKEN
        ),
        mode: "explicit-opt-in"
      };
    }

    return {
      name: provider,
      configured: false,
      mode: "disabled"
    };
  });
}

module.exports = {
  SUPPORTED_PROVIDERS,
  DEFAULT_PROVIDER,
  normalizeProvider,
  getProviderConfig,
  getAvailableProviders
};
