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
  for (const label of ["Accueil", "Personnages", "Tendances", "Créer", "Messages", "Profil"]) {
    assert.match(html, new RegExp(`<span class="nav-label">${label}</span>`));
  }
  assert.doesNotMatch(html, /<span class="nav-label">Favoris<\/span>/);
  assert.doesNotMatch(html, /<span class="nav-label">Mes conversations<\/span>/);
});

test("all supported languages map the six navigation labels without extra destinations", () => {
  const navMapping = i18n.match(/\[(t\.home, t\.exploreNav, t\.trendingNav, t\.createNav, t\.messagesNav, t\.profile)\]/);
  assert.ok(navMapping, "Translations must map home, characters, trends, create, messages and profile");
  assert.equal((i18n.match(/messagesNav:/g) || []).length, 4);
  assert.doesNotMatch(i18n, /\[t\.home, t\.exploreNav, t\.createNav, t\.favorites, t\.history, t\.profile\]/);
});

test("character catalogue and trends are separate destinations", () => {
  assert.match(html, /id="discover"[^>]*aria-label="Catalogue des personnages"/);
  assert.match(html, /id="character-categories"/);
  assert.match(html, /id="creator-studio"/);
  assert.match(html, /id="character-search"/);
  assert.doesNotMatch(html, /<h2>🔥 Tendances mondiales<\/h2>/);
});


test("Top VIP shortcut remains available while the home VIP promotion stays removed", () => {
  assert.match(html, /id="vip-offer-button"/);
  assert.doesNotMatch(html, /vip-home-promo|vip-home-button/);
  const app = fs.readFileSync(path.join(__dirname, "../public/scripts/app.js"), "utf8");
  assert.match(app, /getElementById\("vip-offer-button"\).*openVipOffers/);
});

test("Navigation has one destination handler, avoiding duplicate opens", () => {
  const app = fs.readFileSync(path.join(__dirname, "../public/scripts/app.js"), "utf8");
  assert.equal((app.match(/document\.querySelectorAll\("\.bottom-nav \.nav-item"\)\.forEach\(item =>/g) || []).length, 1);
});
