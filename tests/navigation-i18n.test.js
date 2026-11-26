"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public/index.html"), "utf8");
const i18n = fs.readFileSync(path.join(root, "public/scripts/i18n.js"), "utf8");

test("bottom navigation contains the six agreed destinations", () => {
  const links = html.match(/<a class="nav-item(?: [^"]*)?" href=/g) || [];
  assert.equal(links.length, 6, "The bottom navigation must contain six links");
  for (const label of ["Accueil", "Explorer", "Communauté", "Créer", "Messages", "Profil"]) {
    assert.match(html, new RegExp(`<span class="nav-label">${label}</span>`));
  }
  assert.doesNotMatch(html, /<span class="nav-label">Favoris<\/span>/);
  assert.doesNotMatch(html, /<span class="nav-label">Mes conversations<\/span>/);
});

test("all supported languages map the six navigation labels without extra destinations", () => {
  const navMapping = i18n.match(/\[(t\.home, t\.exploreNav, t\.communityNav, t\.createNav, t\.messagesNav, t\.profile)\]/);
  assert.ok(navMapping, "Translations must map home, explore, community, create, messages and profile");
  assert.equal((i18n.match(/messagesNav:/g) || []).length, 4);
  assert.doesNotMatch(i18n, /\[t\.home, t\.exploreNav, t\.createNav, t\.favorites, t\.history, t\.profile\]/);
});
