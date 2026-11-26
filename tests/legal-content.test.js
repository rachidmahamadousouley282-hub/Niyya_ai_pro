"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const privacy = fs.readFileSync(path.join(root, "public/privacy.html"), "utf8");
const terms = fs.readFileSync(path.join(root, "public/terms.html"), "utf8");

test("Privacy policy describes public and private community data", () => {
  assert.match(privacy, /publications.*images jointes.*commentaires/s);
  assert.match(privacy, /publiques peuvent être consultées/);
  assert.match(privacy, /privées sont réservées à leur auteur/);
  assert.match(privacy, /Document de travail/);
});

test("Terms explain community visibility, member safety and moderation", () => {
  assert.match(terms, /visibilité publique ou privée/);
  assert.match(terms, /blocages et signalements/);
  assert.match(terms, /contenus signalés peuvent être examinés/);
  assert.match(terms, /Document de travail/);
});

test("Privacy page does not contain escaped newline sequences", () => {
  assert.doesNotMatch(privacy, /\\n/);
});
