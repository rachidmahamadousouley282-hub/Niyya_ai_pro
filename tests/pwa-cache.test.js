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
  assert.ok(assets.includes("/scripts/analytics.js?v=site-traffic-v1-20261127"));
  assert.ok(assets.includes("/styles/experience.css?v=niyya-workspace-nav-v1-20261128"));
  for (const asset of assets) {
    assert.ok(serviceWorker.includes(JSON.stringify(asset)), "Missing from shell cache: " + asset);
  }
});

test("The app cache version is advanced when shell assets change", () => {
  assert.match(serviceWorker, /CACHE_NAME = "niyya-shell-v67"/);
});

test("Admin assets use versioned URLs so cached dashboards receive updates", () => {
  assert.match(admin, /admin\.css\?v=admin-official-image-v1-20261127/);
  assert.match(admin, /admin\.js\?v=admin-official-image-v1-20261127/);
});


test("VIP offer entry points and settings action are wired", () => {
  assert.match(html, /id="vip-offer-button"/);
  assert.doesNotMatch(html, /vip-home-button|vip-home-promo/);
  const app = fs.readFileSync(path.join(root, "public/scripts/app.js"), "utf8");
  assert.ok(app.includes('getElementById("vip-offer-button")?.addEventListener("click", openVipOffers)'));
  assert.match(app, /addMenu\("Offre VIP", "Découvrir les avantages premium", "✦", openVipOffers\)/);
  assert.match(app, /close\.addEventListener\("click", dismiss\)/);
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

test("The new home, character discovery and trends have distinct navigation destinations", () => {
  assert.ok(html.includes('href="#community"'));
  assert.ok(html.includes('href="#discover"'));
  assert.ok(html.includes('href="#trending"'));
  const app = fs.readFileSync(path.join(root, "public/scripts/app.js"), "utf8");
  assert.match(app, /addMenu\("Centre d’assistance", "Contacter l’équipe NIYYA et suivre tes demandes"/);
  assert.match(app, /window.location.href = "\/support.html"/);
  const navigation = fs.readFileSync(path.join(root, "public/scripts/navigation.js"), "utf8");
  assert.match(navigation, /\["#community","Accueil"\]/);
  assert.match(navigation, /\["#discover","Personnages"\]/);
  assert.match(navigation, /\["#trending","Tendances"\]/);
});


test("The refreshed landing page keeps real discovery and character creation actions", () => {
  assert.match(html, /class="home-action-primary" href="#discover"/);
  assert.match(html, /id="home-create-character"/);
  const app = fs.readFileSync(path.join(root, "public/scripts/app.js"), "utf8");
  assert.match(app, /getElementById\("home-create-character"\)\?\.addEventListener\("click", \(\) => openCreator\(\)\)/);
});


test("Community characters are not mislabeled as official NIYYA characters", () => {
  const app = fs.readFileSync(path.join(root, "public/scripts/app.js"), "utf8");
  const i18n = fs.readFileSync(path.join(root, "public/scripts/i18n.js"), "utf8");
  assert.match(app, /character\.creator_pseudonym === "NIYYA\.ai"/);
  assert.match(app, /isOfficialCharacter \? t\("officialTag"\) : t\("communityCharacterTag"\)/);
  assert.match(app, /isOfficialCharacter \? "NIYYA ORIGINAL" : t\("communityArtLabel"\)/);
  for (const label of ["communityCharacterTag", "communityArtLabel"]) {
    assert.equal((i18n.match(new RegExp(label + ":", "g")) || []).length, 4);
  }
});


test("All discovery categories have explicit translated labels", () => {
  const app = fs.readFileSync(path.join(root, "public/scripts/app.js"), "utf8");
  const i18n = fs.readFileSync(path.join(root, "public/scripts/i18n.js"), "utf8");
  for (const category of ["anime", "fantasy", "science-fiction"]) {
    assert.ok(app.includes('category === "' + category + '"'));
  }
  for (const key of ["categoryAnime", "categoryFantasy", "categoryScienceFiction"]) {
    assert.equal((i18n.match(new RegExp(key + ":", "g")) || []).length, 4);
  }
});


test("Explorer offers a working reset when search or category filters return no characters", () => {
  const app = fs.readFileSync(path.join(root, "public/scripts/app.js"), "utf8");
  const i18n = fs.readFileSync(path.join(root, "public/scripts/i18n.js"), "utf8");
  assert.match(app, /discovery-empty/);
  assert.match(app, /resetDiscovery/);
  assert.match(app, /activeCategory = "all"/);
  assert.match(app, /searchInput\.value = ""/);
  for (const key of ["resetDiscovery"]) {
    assert.equal((i18n.match(new RegExp(key + ":", "g")) || []).length, 4);
  }
});


test("Typing a discovery search filters the category row without moving the discovery section", () => {
  const app = fs.readFileSync(path.join(root, "public/scripts/app.js"), "utf8");
  const html = fs.readFileSync(path.join(root, "public/index.html"), "utf8");
  assert.match(app, /document\.querySelector\("\.category-list"\)\?\.closest\("\.section"\)/);
  assert.match(app, /categorySection\.hidden = searching/);
  assert.match(app, /homeHero\?\.classList\.toggle\("is-searching", searching\)/);
  assert.match(html, /app\.js\?v=niyya-workspace-nav-v1-20261128/);
});


test("Chat composer supports Enter to send, Shift+Enter for a newline, and automatic height", () => {
  const app = fs.readFileSync(path.join(root, "public/scripts/app.js"), "utf8");
  assert.match(app, /event\.key !== "Enter" \|\| event\.shiftKey \|\| event\.isComposing/);
  assert.match(app, /ui\.form\.requestSubmit\(\)/);
  assert.match(app, /Math\.min\(ui\.input\.scrollHeight, 120\)/);
  assert.match(app, /ui\.input\.addEventListener\("input", resizeChatInput\)/);
});

test("Each chat sends messages to its own captured conversation ID", () => {
  const app = fs.readFileSync(path.join(root, "public/scripts/app.js"), "utf8");
  assert.match(app, /let conversationId = null/);
  assert.match(app, /conversationId = created\.conversation\.id/);
  assert.match(app, /getMessages\(conversationId\)/);
  assert.match(app, /sendMessage\(conversationId,/);
  assert.doesNotMatch(app, /sendMessage\(activeConversation,/);
});


test("Home puts character discovery immediately after the hero and renders visible loading skeletons", () => {
  const discover = html.indexOf('id="discover"');
  const categories = html.indexOf('class="category-list"');
  const hero = html.indexOf('class="hero home-hero"');
  assert.ok(hero >= 0 && discover > hero && discover < categories);
  assert.match(html, /class="character-skeleton"/);
  assert.match(html, /character-loading-status/);
  const app = fs.readFileSync(path.join(root, "public/scripts/app.js"), "utf8");
  assert.match(app, /async function loadCharacters\(\)/);
  assert.match(app, /charactersSlow/);
  assert.match(app, /retryCharacters/);
  assert.match(app, /addEventListener\("click", loadCharacters\)/);
});

test("Character loading and retry messages are translated in all supported languages", () => {
  const i18n = fs.readFileSync(path.join(root, "public/scripts/i18n.js"), "utf8");
  for (const key of ["charactersLoading", "charactersSlow", "charactersError", "retryCharacters"]) {
    assert.equal((i18n.match(new RegExp(key + ":", "g")) || []).length, 4);
  }
});

test("Search hides only the category filters and leaves discovery directly below the hero", () => {
  const app = fs.readFileSync(path.join(root, "public/scripts/app.js"), "utf8");
  assert.match(app, /document\.querySelector\("\.category-list"\)\?\.closest\("\.section"\)/);
  assert.doesNotMatch(app, /homeHero\.after\(discoverSection\)/);
});

test("World trend rankings use recent database activity and separate official characters", () => {
 const route = fs.readFileSync(path.join(root, "src/routes/characters.routes.js"), "utf8");
 const api = fs.readFileSync(path.join(root, "public/scripts/api.js"), "utf8");
 const app = fs.readFileSync(path.join(root, "public/scripts/app.js"), "utf8");
 assert.match(route, /router\.get\("\/trending"/);
 assert.match(route, /INTERVAL '7 days'/);
 assert.match(route, /messages_7d/);
 assert.match(route, /PARTITION BY is_system/);
 assert.match(route, /trending: result\.rows\.filter/);
 assert.match(route, /official: result\.rows\.filter/);
 assert.match(api, /getTrendingCharacters/);
 assert.match(app, /loadTrending/);
 assert.match(html, /id="trending"/);
 assert.match(html, /data-trending-scope="official"/);
});

test("Character and trends navigation use separate standalone views", () => {
  const community = fs.readFileSync(path.join(root, "public/scripts/community.js"), "utf8");
  assert.match(community, /showStandaloneView\("characters"\)/);
  assert.match(community, /showStandaloneView\("trending"\)/);
  assert.match(community, /new Set\(\["discover", "character-categories", "creator-studio"\]\)/);
  assert.match(community, /Array\.from\(main\.children\)\.forEach\(section => \{ section\.hidden = false; \}\)/);
});
