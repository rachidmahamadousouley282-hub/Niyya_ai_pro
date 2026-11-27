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


test("Platform analytics separates period activity from lifetime totals", () => {
  assert.match(route, /AS new_members_period/);
  assert.match(route, /AS active_members/);
  assert.match(route, /m\.role = 'user'/);
  assert.match(route, /AS messages_period/);
  assert.match(route, /AS posts_period/);
  assert.match(route, /registrations: dailyMembers\.rows/);
  assert.match(route, /siteVisits: false/);
  assert.match(html, /id="global-new-members"/);
  assert.match(html, /id="global-period-messages"/);
  assert.match(html, /visites globales du site et le temps passé ne sont pas encore collectés/i);
  assert.match(script, /globalData\.daily/);
});
