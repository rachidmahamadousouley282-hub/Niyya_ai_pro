"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "public/scripts/app.js"), "utf8");
const onboarding = fs.readFileSync(path.join(root, "public/scripts/onboarding.js"), "utf8");
const auth = fs.readFileSync(path.join(root, "src/routes/auth.routes.js"), "utf8");

test("New visitors must register while existing permanent accounts keep login access", () => {
  assert.match(app, /if \(session\.user\?\.isGuest\)\s*\{\s*await openAccountSettings\(\{ required: true \}\)/);
  assert.match(app, /window\.NiyyaAPI\.login\(\{ email: email\.value, password: password\.value \}\)/);
  assert.match(app, /if \(!required && event\.target === modal\) dismiss\(\)/);
});

test("Required onboarding cannot be dismissed before the profile is completed", () => {
  assert.match(onboarding, /function open\(\{ onComplete, required = false \} = \{\}\)/);
  assert.match(onboarding, /close\.hidden = required/);
  assert.match(onboarding, /if \(!required && event\.target === modal\) dismiss\(\)/);
});

test("Successful required onboarding still closes its modal", () => {
  assert.match(onboarding, /await window\.NiyyaAPI\.completeOnboarding\([\s\S]*?\);\s*modal\.remove\(\);/);
});

test("Account creation does not mark an email as verified", () => {
  assert.match(auth, /SET email = \$2, password_hash = \$3, is_guest = FALSE/);
  assert.doesNotMatch(auth, /SET[^;]*email_verified_at\s*=/s);
});

test("Completing required profile setup reloads the app to hydrate the community identity", () => {
  assert.match(app, /NiyyaOnboarding\.open\(\{ required: true, onComplete: \(\) => window\.location\.reload\(\) \}\)/);
});
