"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("La sauvegarde utilise directement le personnage canonique renvoyé par le serveur", () => {
  const source = fs.readFileSync(path.join(__dirname, "../public/scripts/app.js"), "utf8");
  assert.match(source, /const savedCharacter = result\.character/);
  assert.doesNotMatch(source, /const savedCharacters = await window\.NiyyaAPI\.getMyCharacters\(\)/);
  assert.match(source, /openChat\(savedCharacter, null\)/);
  assert.match(source, /uuidPattern\.test\(String\(savedCharacter\.id \|\| ""\)\)/);
  assert.match(source, /Discuter avec mon personnage/);
});

test("Le formulaire de création n'affiche plus le conseil de sécurité sous les champs", () => {
  const source = fs.readFileSync(path.join(__dirname, "../public/scripts/app.js"), "utf8");
  assert.doesNotMatch(source, /Conseil : n'inclus pas de coordonnées personnelles/);
  assert.match(source, /form\.append\(status, submit\)/);
});

test("Chaque création sauvegardée reste accessible pour démarrer une conversation", () => {
  const source = fs.readFileSync(path.join(__dirname, "../public/scripts/app.js"), "utf8");
  assert.match(source, /const chat = element\("button", "chat-send creator-chat-button", "Discuter"\)/);
  assert.match(source, /openChat\(character, null\)/);
  assert.ok(source.indexOf("const chat = element") < source.indexOf('if (["none", "rejected"].includes(character.publication_status))'));
});
