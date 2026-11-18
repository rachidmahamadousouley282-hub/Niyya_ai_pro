
"use strict";

const SUPPORTED_PROVIDERS = Object.freeze([
  "openai",
  "anthropic",
  "google"
]);

const DEFAULT_PROVIDER = "openai";

function normalizeProvider(provider) {
  if (typeof provider !== "string") {
    return DEFAULT_PROVIDER;
  }

  const normalized = provider.trim().toLowerCase();

  return SUPPORTED_PROVIDERS.includes(normalized)
    ? normalized
    : DEFAULT_PROVIDER;
}

function getProviderConfig() {
  const provider = normalizeProvider(process.env.AI_PROVIDER);

  const configurations = {
    openai: {
      name: "openai",
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      apiKey: process.env.OPENAI_API_KEY
    },

    anthropic: {
      name: "anthropic",
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet",
      apiKey: process.env.ANTHROPIC_API_KEY
    },

    google: {
      name: "google",
      model: process.env.GOOGLE_MODEL || "gemini-2.5-flash",
      apiKey: process.env.GOOGLE_API_KEY
    }
  };

  const config = configurations[provider];

  if (!config.apiKey) {
    throw new Error(
      `Configuration API manquante pour le fournisseur ${provider}.`
    );
  }

  return {
    provider: config.name,
    model: config.model,
    apiKey: config.apiKey
  };
}

function getAvailableProviders() {
  return SUPPORTED_PROVIDERS.map(provider => ({
    name: provider,
    available: Boolean(
      process.env[
        provider === "openai"
          ? "OPENAI_API_KEY"
          : provider === "anthropic"
            ? "ANTHROPIC_API_KEY"
            : "GOOGLE_API_KEY"
      ]
    )
  }));
}

module.exports = {
  SUPPORTED_PROVIDERS,
  normalizeProvider,
  getProviderConfig,
  getAvailableProviders
};

