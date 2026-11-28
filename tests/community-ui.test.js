"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("Community admin review tab is built after the session role is resolved", () => {
  const source = fs.readFileSync(path.join(__dirname, "../public/scripts/community.js"), "utf8");
  assert.match(source, /const visibleTabs = isAdmin\s*\?/);
  assert.match(source, /visibleTabs\.forEach/);
  assert.ok(source.indexOf('isAdmin=session?.user?.role==="admin"') < source.indexOf('setTab("all")'));
});

test("Image-only posts are accepted by the database constraint, text-only posts keep their minimum", () => {
  const migration = fs.readFileSync(path.join(__dirname, "../database/migrations/0013_image_only_posts.sql"), "utf8");
  assert.match(migration, /media_data IS NOT NULL AND char_length\(btrim\(body\)\) BETWEEN 0 AND 600/);
  assert.match(migration, /media_data IS NULL AND char_length\(btrim\(body\)\) BETWEEN 2 AND 600/);
});


test("Community member discovery includes a directory, search, profile and follow actions", () => {
  const source = fs.readFileSync(path.join(__dirname, "../public/scripts/community.js"), "utf8");
  assert.match(source, /\["search","Découvrir"\]/);
  assert.match(source, /api\("\/members\?limit=20&offset="\+offset\)/);
  assert.match(source, /api\("\/search\?q="/);
  assert.match(source, /showProfile\(member\.id\)/);
  assert.ok(source.includes('api("/profiles/"+encodeURIComponent(member.id)+"/follow"'));
});

test("Member discovery supports loading additional pages without replacing current results", () => {
  const source = fs.readFileSync(path.join(__dirname, "../public/scripts/community.js"), "utf8");
  assert.match(source, /api\("\/members\?limit=20&offset="\+offset\)/);
  assert.match(source, /data\.hasMore&&members\.length/);
  assert.match(source, /Charger plus de membres/);
  assert.match(source, /loadMembers\("",true\)/);
});

test("Community sync uses authenticated server-sent events and a slow fallback", () => {
  const source = fs.readFileSync(path.join(__dirname, "../public/scripts/community.js"), "utf8");
  assert.match(source, /new EventSource\("\/api\/community\/events"\)/);
  assert.match(source, /addEventListener\("feed_changed"/);
  assert.match(source, /addEventListener\("activity"/);
  assert.match(source, /120000/);
  assert.match(source, /document\.addEventListener\("visibilitychange"/);
  assert.match(source, /window\.addEventListener\("focus"/);
  assert.doesNotMatch(source, /location\.reload\(/);
});
test("Community event service uses PostgreSQL notifications and user-scoped streams", () => {
  const service = fs.readFileSync(path.join(__dirname, "../src/services/community-events.service.js"), "utf8");
  const routes = fs.readFileSync(path.join(__dirname, "../src/routes/community.routes.js"), "utf8");
  assert.match(service, /LISTEN/);
  assert.match(service, /pg_notify/);
  assert.match(service, /subscribersByUser/);
  assert.match(routes, /router\.get\("\/events", requireAuth/);
  assert.match(routes, /subscribeCommunityUser\(req\.user\.id, res\)/);
});


test("Official and verified badges stay beside names across feed, profiles and member discovery", () => {
  const source = fs.readFileSync(path.join(__dirname, "../public/scripts/community.js"), "utf8");
  assert.match(source, /const verifiedBadge = \(isOfficial, isVerified\)/);
  assert.ok(source.includes("appendNameWithBadge(nameWrap, post.author_name, post.is_official, post.is_verified, post.is_founder, post.author_is_admin)"));
  assert.ok(source.includes("appendNameWithBadge(profileName, p.pseudonym, p.is_official, p.is_verified, p.is_founder, p.is_admin)"));
  assert.ok(source.includes("appendNameWithBadge(details, member.pseudonym, member.is_official, member.is_verified, member.is_founder, member.is_admin)"));
  assert.ok(source.includes("appendNameWithBadge(officialCopy, account.pseudonym, account.is_official, account.is_verified, account.is_founder, account.is_admin)"));
  assert.match(source, /Compte reconnu par NIYYA/);
  assert.match(source, /M12 1\.8 14\.7 4/);




});

test("Following feed distinguishes no followed accounts from followed accounts without posts", () => {
  const source = fs.readFileSync(path.join(__dirname, "../public/scripts/community.js"), "utf8");
  assert.match(source, /data\.followedCount > 0/);
  assert.match(source, /Tu suis déjà /);
});


test("Verification badge stays on the same unwrapped line as account name", () => {
  const styles = fs.readFileSync(path.join(__dirname, "../public/styles/community.css"), "utf8");
  assert.match(styles, /\.community-name-line\{[^}]*flex-wrap:nowrap/);
  assert.match(styles, /\.community-name-line strong\{[^}]*white-space:nowrap/);
  assert.match(styles, /\.community-name-line \.community-verified-badge\{[^}]*flex:0 0 16px/);
});

test("The blue NIYYA recognition rosette appears for admin accounts across community identities", () => {
  const source = fs.readFileSync(path.join(__dirname, "../public/scripts/community.js"), "utf8");
  const routes = fs.readFileSync(path.join(__dirname, "../src/routes/community.routes.js"), "utf8");
  assert.match(source, /const adminBadge = isAdmin =>/);
  assert.match(source, /aria-label", "Compte reconnu par NIYYA"/);
  assert.match(routes, /\(u\.role = 'admin'\) AS is_admin/);
  assert.match(routes, /is_admin: user\.is_admin/);
  assert.match(source, /appendNameWithBadge\(author,comment\.author_name,false,false,comment\.is_founder,comment\.is_admin\)/);
});

test("Community feed becomes the landing view after account initialization", () => {
  const source = fs.readFileSync(path.join(__dirname, "../public/scripts/community.js"), "utf8");
  const app = fs.readFileSync(path.join(__dirname, "../public/scripts/app.js"), "utf8");
  assert.match(source, /Promise\.resolve\(window\.NiyyaAccessReady\)\.then\(openCommunity\)/);
  assert.match(app, /window\.NiyyaAccessReady = accessReady/);
  assert.match(source, /Ton fil d’actualité/);
});

test("Personal account opens as a full-screen page without a close button",()=>{const app=fs.readFileSync(path.join(__dirname,"../public/scripts/app.js"),"utf8");assert.match(app,/element\("div", "niyya-account-page"\)/);const start=app.indexOf("async function openAccount()"),end=app.indexOf("async function openAccountSettings");assert.doesNotMatch(app.slice(start,end),/modal-close/);assert.match(app,/document\.querySelector\("\.niyya-account-page"\)\?\.remove\(\)/);});
test("Member profile is full-screen and notification state uses a discreet dot",()=>{const community=fs.readFileSync(path.join(__dirname,"../public/scripts/community.js"),"utf8"),navigation=fs.readFileSync(path.join(__dirname,"../public/scripts/navigation.js"),"utf8"),app=fs.readFileSync(path.join(__dirname,"../public/scripts/app.js"),"utf8");assert.match(community,/el\("section","community-profile-view"\)/);assert.match(community,/hideSubpageClose\(\)/);assert.match(navigation,/dot\.dataset\.navDot = "community"/);assert.match(app,/data-nav-dot="community"/);assert.match(app,/\/api\/community\/notifications/);assert.doesNotMatch(app,/9\+/);});

test("Personal profile has no close control and is styled as a full-screen page", () => {
  const app = fs.readFileSync(path.join(__dirname, "../public/scripts/app.js"), "utf8");
  const css = fs.readFileSync(path.join(__dirname, "../public/styles/main.css"), "utf8");
  const start = app.indexOf("async function openAccount()");
  const end = app.indexOf("async function openAccountSettings");
  assert.doesNotMatch(app.slice(start, end), /modal-close/);
  assert.match(css, /\.niyya-account-page\s*\{[\s\S]*position:\s*fixed/);
});
test("Navigation uses a discreet notification dot, not a numeric badge", () => {
  const app = fs.readFileSync(path.join(__dirname, "../public/scripts/app.js"), "utf8");
  const nav = fs.readFileSync(path.join(__dirname, "../public/scripts/navigation.js"), "utf8");
  const css = fs.readFileSync(path.join(__dirname, "../public/styles/main.css"), "utf8");
  assert.match(nav, /nav-notification-dot/);
  assert.match(nav, /data-nav-dot = "community"/);
  assert.match(app, /data-nav-dot="community"/);
  assert.doesNotMatch(app, /9\+/);
  assert.match(css, /\.nav-notification-dot/);
});
test("Public member profile has no return-to-feed button and remains full-screen", () => {
  const community = fs.readFileSync(path.join(__dirname, "../public/scripts/community.js"), "utf8");
  const css = fs.readFileSync(path.join(__dirname, "../public/styles/community.css"), "utf8");
  assert.doesNotMatch(community, /← Retour au fil/);
  assert.match(css, /\.community-profile-view\s*\{[\s\S]*position:\s*fixed/);
});
