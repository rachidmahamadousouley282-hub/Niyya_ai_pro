"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public/index.html"), "utf8");
const serviceWorker = fs.readFileSync(path.join(root, "public/service-worker.js"), "utf8");
const admin = fs.readFileSync(path.join(root, "public/admin.html"), "utf8");

test("The service worker precaches the exact CSS and JS URLs used by the app", () => {
  const assets = [...html.matchAll(/(?:href|src)="(\/(?:styles|scripts)\/[^"]+)"/g)]
    .map(match => match[1]);
  assert.ok(assets.length > 0);
  for (const asset of assets) {
    assert.ok(serviceWorker.includes(JSON.stringify(asset)), "Missing from shell cache: " + asset);
  }
});

test("The app cache version is advanced when shell assets change", () => {
  assert.match(serviceWorker, /CACHE_NAME = "niyya-shell-v44"/);
});

test("Admin assets use versioned URLs so cached dashboards receive updates", () => {
  assert.match(admin, /admin\.css\?v=admin-official-v2-20261127/);
  assert.match(admin, /admin\.js\?v=admin-support-v1-20261127/);
});


test("VIP offer entry points and settings action are wired", () => {
  assert.match(html, /id="vip-offer-button"/);
  assert.match(html, /id="vip-home-button"/);
  const app = fs.readFileSync(path.join(root, "public/scripts/app.js"), "utf8");
  assert.match(app, /getElementById\("vip-offer-button"\).*openVipOffers/);
  assert.match(app, /getElementById\("vip-home-button"\).*openVipOffers/);
  assert.doesNotMatch(app, /getElementById\("settings-button"\).*openAccountSettings/);
  const i18n = fs.readFileSync(path.join(root, "public/scripts/i18n.js"), "utf8");
  assert.match(i18n, /getElementById\("settings-button"\)\?\.addEventListener\("click", openSettings\)/);
  assert.match(i18n, /niyya-language-select/);
  assert.match(i18n, /niyya-response-length/);
  assert.match(i18n, /niyya-theme-select/);
  assert.match(app, /"Compte et sécurité"/);
  assert.match(app, /≈ \$2\.50 \/ mois · ≈ \$25 \/ an/);
  assert.doesNotMatch(app, /FCFA \/ mois/);
});


test("The create navigation item matches the other five destinations", () => {
  const styles = fs.readFileSync(path.join(root, "public/styles/main.css"), "utf8");
  assert.match(styles, /\.bottom-nav \.nav-item\.nav-create\s*\{[^}]*transform:\s*none\s*!important/);
  assert.match(styles, /\.bottom-nav \.nav-item\.nav-create > \.nav-icon\s*\{[^}]*flex:\s*0 0 35px/);
  assert.match(styles, /@media \(max-width: 600px\)[\s\S]*?\.bottom-nav \.nav-item\.nav-create > \.nav-icon\s*\{[^}]*flex-basis:\s*34px/);
  assert.match(styles, /grid-template-columns:\s*repeat\(6,\s*minmax\(0,\s*1fr\)\)/);
});

test("The community uses the same ◎ mark and the support centre is reachable from the profile menu", () => {
  assert.ok(html.includes('href="#community"><span class="nav-icon" aria-hidden="true">◎</span>'));
  const app = fs.readFileSync(path.join(root, "public/scripts/app.js"), "utf8");
  assert.match(app, /addMenu\("Centre d’assistance", "Contacter l’équipe NIYYA et suivre tes demandes"/);
  assert.match(app, /window.location.href = "\/support.html"/);
  const navigation = fs.readFileSync(path.join(root, "public/scripts/navigation.js"), "utf8");
  assert.match(navigation, /entry.href === "#community"\) icon.textContent = "◎"/);
});
