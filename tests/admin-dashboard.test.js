"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public/admin.html"), "utf8");
const script = fs.readFileSync(path.join(root, "public/scripts/admin.js"), "utf8");
const route = fs.readFileSync(path.join(root, "src/routes/admin.routes.js"), "utf8");

test("Admin dashboard exposes a private AI configuration diagnostic", () => {
  assert.match(html, /id="ai-provider-status"/);
  assert.match(script, /\/api\/admin\/system-status/);
  assert.match(route, /router\.get\("\/system-status"/);
  assert.match(route, /req\.user\.role !== "admin"/);
});

test("Admin dashboard provides community report review actions", () => {
  assert.match(html, /id="community-reports"/);
  assert.match(script, /\/api\/community\/moderation\/reports/);
  assert.match(script, /decision\s*\}\)/);
});

test("Official account announcements can be composed and recent posts reviewed", () => {
  assert.match(html, /id="official-announcement-form"/);
  assert.match(html, /id="official-announcement-body"[^>]*maxlength="600"/);
  assert.match(script, /\/api\/admin\/official\/announcements/);
  assert.match(route, /router\.get\("\/official\/announcements"/);
  assert.match(route, /router\.post\("\/official\/announcements"/);
});
