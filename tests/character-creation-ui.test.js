"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("Un personnage enregistré peut être essayé immédiatement depuis le formulaire", () => {
  const source = fs.readFileSync(path.join(__dirname, "../public/scripts/app.js"), "utf8");
  assert.match(source, /const chatNow = element\("button", "chat-send creator-submit", "Discuter avec mon personnage"\)/);
  assert.match(source, /openChat\(result\.character, null\)/);
  assert.match(source, /PERSONNAGE ENREGISTRÉ/);
});

test("Chaque création sauvegardée reste accessible pour démarrer une conversation", () => {
  const source = fs.readFileSync(path.join(__dirname, "../public/scripts/app.js"), "utf8");
  assert.match(source, /const chat = element\("button", "chat-send creator-chat-button", "Discuter"\)/);
  assert.match(source, /openChat\(character, null\)/);
  assert.ok(source.indexOf("const chat = element") < source.indexOf('if (["none", "rejected"].includes(character.publication_status))'));
});
