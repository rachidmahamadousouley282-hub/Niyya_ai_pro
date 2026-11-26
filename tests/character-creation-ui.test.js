"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("L'atelier demande uniquement un nom, une description et un premier message", () => {
  const source = fs.readFileSync(path.join(__dirname, "../public/scripts/app.js"), "utf8");
  const fields = source.slice(source.indexOf('const fields = ['), source.indexOf('const controls = {};'));
  assert.match(fields, /\["name", "Nom du personnage"/);
  assert.match(fields, /\["description", "Description du personnage"/);
  assert.match(fields, /\["greeting", "Premier message"/);
  assert.doesNotMatch(fields, /tagline|shortBio|backstory|personalityPrompt|scenario|traits|tags/);
  assert.match(source, /shortBio: description\.slice\(0, 500\)/);
  assert.match(source, /backstory: description/);
  assert.match(source, /personalityPrompt: description/);
});

test("La modification retrouve un identifiant canonique si le formulaire reçoit un identifiant incomplet", () => {
  const source = fs.readFileSync(path.join(__dirname, "../public/scripts/app.js"), "utf8");
  assert.match(source, /let editCharacterId = existingCharacter\?\.id/);
  assert.match(source, /const owned = await window\.NiyyaAPI\.getMyCharacters\(\)/);
  assert.match(source, /updateCharacter\(editCharacterId, payload\)/);
  assert.match(source, /Discuter avec mon personnage/);
});

test("La validation des identifiants accepte tout UUID PostgreSQL canonique", () => {
  const route = fs.readFileSync(path.join(__dirname, "../src/routes/characters.routes.js"), "utf8");
  assert.match(route, /const UUID_REGEX = \/\^\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{12\}\$\/i/);
});

test("Le formulaire n'affiche plus le conseil de sécurité sous les champs", () => {
  const source = fs.readFileSync(path.join(__dirname, "../public/scripts/app.js"), "utf8");
  assert.doesNotMatch(source, /Conseil : n'inclus pas de coordonnées personnelles/);
  assert.match(source, /form\.append\(status, submit\)/);
});
