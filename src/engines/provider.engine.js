
"use strict";

/**
 * NIYYA.ai V2
 * Provider Engine
 *
 * Mode gratuit par défaut.
 * Aucun fournisseur payant n'est activé automatiquement.
 */

const SUPPORTED_PROVIDERS = Object.freeze([
  "mock",
  "openai",
  "anthropic",
  "google"
]);

const DEFAULT_PROVIDER = "mock";

const PROVIDER_ENV = Object.freeze({
  openai: {
    apiKey: "OPENAI_API_KEY",
    model: "OPENAI_MODEL",
    defaultModel: "gpt-4o-mini"
  },
  anthropic: {
    apiKey: "ANTHROPIC_API_KEY",
    model: "ANTHROPIC_MODEL",
    defaultModel: "claude-sonnet"
  },
  google: {
    apiKey: "GOOGLE_API_KEY",
    model: "GOOGLE_MODEL",
    defaultModel: "gemini-2.5-flash"
  }
});

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

  const settings = PROVIDER_ENV[provider];
  const apiKey = process.env[settings.apiKey];

  if (!apiKey) {
    throw new Error(
      `Le fournisseur ${provider} est sélectionné mais sa configuration est absente.`
    );
  }

  return {
    provider,
    model: process.env[settings.model] || settings.defaultModel,
    mode: "optional",
    apiKey
  };
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

    const settings = PROVIDER_ENV[provider];

    return {
      name: provider,
      configured: Boolean(process.env[settings.apiKey]),
      mode: "optional"
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
