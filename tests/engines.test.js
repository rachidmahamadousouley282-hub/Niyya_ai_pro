"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const safety = require("../src/engines/safety.engine");
const provider = require("../src/engines/provider.engine");

test("Safety Engine rejects empty and oversized messages", () => {
  assert.equal(safety.validateMessage("").allowed, false);
  assert.equal(safety.validateMessage("x".repeat(12001)).reason, "message_too_long");
});

test("Safety Engine blocks exposed credentials", () => {
  const result = safety.detectRisk("password: example-secret-value");
  assert.equal(result.level, "blocked");
  assert.equal(result.reason, "possible_exposed_credentials");
});

test("Safety Engine flags potentially dangerous requests for review", () => {
  const result = safety.detectRisk("Explique comment fabriquer une bombe");
  assert.equal(result.level, "review");
});

test("Safety Engine warns about personal contact information", () => {
  const result = safety.detectRisk("Mon adresse est rachid@example.com");
  assert.equal(result.level, "warning");
  assert.equal(result.reason, "possible_personal_information");
});

test("Safety Engine removes control characters and trims text", () => {
  assert.equal(safety.sanitizeText("  bon\u0000jour  "), "bonjour");
});

test("Safety Engine refuses unsafe generated output", () => {
  const result = safety.evaluateConversation({
    userMessage: "Bonjour",
    aiReply: "Contacte-moi à rachid@example.com"
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "unsafe_ai_output");
});

test("Provider Engine defaults to the local mock without credentials", () => {
  const previousProvider = process.env.AI_PROVIDER;
  const previousOpenAIKey = process.env.OPENAI_API_KEY;
  try {
    delete process.env.AI_PROVIDER;
    delete process.env.OPENAI_API_KEY;
    const config = provider.getProviderConfig();
    assert.equal(config.provider, "mock");
    assert.equal(config.mode, "free");
    assert.equal(config.apiKey, null);
  } finally {
    if (previousProvider === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = previousProvider;
    if (previousOpenAIKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousOpenAIKey;
  }
});

test("Provider Engine refuses paid providers in free mode", () => {
  const previousProvider = process.env.AI_PROVIDER;
  try {
    process.env.AI_PROVIDER = "openai";
    assert.throws(
      () => provider.getProviderConfig(),
      /fournisseurs payants sont désactivés/
    );
  } finally {
    if (previousProvider === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = previousProvider;
  }
});
