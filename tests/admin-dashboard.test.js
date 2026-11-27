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
  assert.match(route, /AS returning_members_period/);
  assert.match(route, /dailyActiveMembers/);
  assert.match(route, /dailyComments/);
  assert.match(route, /AS comments_period/);
  assert.match(route, /AS likes_period/);
  assert.match(route, /AS follows_period/);
  assert.match(route, /m\.role = 'user'/);
  assert.match(route, /AS messages_period/);
  assert.match(route, /AS posts_period/);
  assert.match(route, /registrations: dailyMembers\.rows/);
  assert.match(route, /siteVisits: false/);
  assert.match(html, /id="global-new-members"/);
  assert.match(html, /id="global-period-messages"/);
  assert.match(html, /id="global-returning-members"/);
  assert.match(html, /id="global-period-comments"/);
  assert.match(html, /id="global-period-likes"/);
  assert.match(html, /id="global-period-follows"/);
  assert.match(html, /visites globales du site et le temps passé ne sont pas encore collectés/i);
  assert.match(script, /platform\.daily\?\.registrations/);
  assert.match(script, /platform\.daily\?\.activeMembers/);
  assert.match(script, /platform\.daily\?\.comments/);
  assert.match(script, /platform\.daily\?\.follows/);
});


test("Admin dashboard reports daily site visits, unique visitors, and growth", () => {
  const analyticsRoute = fs.readFileSync(path.join(root, "src/routes/analytics.routes.js"), "utf8");
  assert.match(route, /router\.get\("\/site-traffic"/);
  assert.match(route, /pageViewsPercent/);
  assert.match(route, /uniqueVisitorsPercent/);
  assert.match(analyticsRoute, /router\.post\("\/pageview"/);
  assert.match(analyticsRoute, /createHash\("sha256"\)/);
  assert.doesNotMatch(analyticsRoute, /req\.ip|user-agent/i);
  assert.match(html, /id="traffic-page-views"/);
  assert.match(html, /id="traffic-unique-visitors"/);
  assert.match(script, /renderTraffic\(data\)/);
  assert.match(script, /Pages vues du site/);
});


test("Traffic measurement is disclosed in the privacy notice and public pages", () => {
  const privacy = fs.readFileSync(path.join(root, "public/privacy.html"), "utf8");
  for (const page of ["support.html", "privacy.html", "terms.html"]) {
    const content = fs.readFileSync(path.join(root, "public", page), "utf8");
    assert.match(content, /analytics\.js\?v=site-traffic-v1-20261127/);
  }
  assert.match(privacy, /identifiant aléatoire pseudonymisé/i);
  assert.match(privacy, /ni l’adresse IP ni l’agent utilisateur/i);
  assert.match(html, /Navigateurs uniques estimés/);
});


test("Admin dashboard appears before secondary panels finish loading and offers retry on access failure", () => {
  assert.match(script, /dashboard\.hidden = false/);
  assert.match(script, /const characterRequest = requestJson/);
  assert.match(script, /const platformRequest = requestJson/);
  assert.match(script, /const trafficRequest = requestJson/);
  assert.match(script, /Promise\.allSettled\(\[platformRequest, trafficRequest\]\)/);
  assert.match(script, /Le serveur met trop de temps à répondre/);
  assert.match(script, /button\.textContent = "Réessayer"/);
  assert.match(html, /admin\.js\?v=admin-dashboard-v4-20261127/);
});
