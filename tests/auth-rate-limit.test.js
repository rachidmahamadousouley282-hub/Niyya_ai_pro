"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "../src/app.js"), "utf8");

test("Authentication rate limiting does not block normal session reads", () => {
  assert.match(app, /protectedAuthActions = new Set\(\["\/login", "\/guest", "\/register"\]\)/);
  assert.match(app, /req\.method === "POST" && protectedAuthActions\.has\(req\.path\)/);
  assert.match(app, /return next\(\);\s*\}\);\s*\n\s*app\.get\("\/api\/health"/);
});
