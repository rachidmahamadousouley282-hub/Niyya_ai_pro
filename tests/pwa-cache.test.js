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
  assert.match(serviceWorker, /CACHE_NAME = "niyya-shell-v28"/);
});

test("Admin assets use versioned URLs so cached dashboards receive updates", () => {
  assert.match(admin, /admin\.css\?v=admin-diagnostics-v1-20261126/);
  assert.match(admin, /admin\.js\?v=admin-diagnostics-v1-20261126/);
});
