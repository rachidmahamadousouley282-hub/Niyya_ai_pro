"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public/index.html"), "utf8");
const robots = fs.readFileSync(path.join(root, "public/robots.txt"), "utf8");
const sitemap = fs.readFileSync(path.join(root, "public/sitemap.xml"), "utf8");
const responsive = fs.readFileSync(path.join(root, "public/styles/responsive.css"), "utf8");

test("The public landing page has French SEO and social preview metadata", () => {
  assert.match(html, /<html\s+lang="fr"(?:\s|>)/);
  assert.match(html, /<title>NIYYA\.ai — Découvre, crée et imagine<\/title>/);
  assert.match(html, /name="description"/);
  assert.match(html, /rel="canonical"/);
  assert.match(html, /property="og:title"/);
  assert.match(html, /property="og:description"/);
  assert.match(html, /name="twitter:card"/);
  assert.match(html, /rel="icon" type="image\/svg\+xml" href="\/icons\/niyya-icon\.svg"/);
});

test("The landing page explains the product and labels the character search", () => {
  assert.match(html, /Découvre\. Imagine\. Crée ton univers\./);
  assert.match(html, /aria-label="Rechercher un personnage"/);
  assert.match(html, /<span aria-hidden="true">⌕<\/span>/);
  assert.ok(html.indexOf('id="character-grid"') > html.indexOf('id="discover"'));
  assert.doesNotMatch(html, /vip-home-title|vip-home-button|vip-home-promo/);
  assert.match(html, /viewport-fit=cover/);
});

test("Search crawlers are directed to the public homepage, not private areas", () => {
  assert.match(robots, /Disallow: \/api\//);
  assert.match(robots, /Disallow: \/admin\.html/);
  assert.match(robots, /Disallow: \/support\.html/);
  assert.match(robots, /Sitemap: https:\/\/niyya-ai-v2\.onrender\.com\/sitemap\.xml/);
  assert.match(sitemap, /<loc>https:\/\/niyya-ai-v2\.onrender\.com\/<\/loc>/);
});

test("Mobile layout respects iPhone safe areas around the bottom navigation", () => {
  assert.match(responsive, /viewport-fit=cover|safe-area-inset-bottom/);
  assert.match(responsive, /bottom: calc\(8px \+ env\(safe-area-inset-bottom, 0px\)\)/);
  assert.match(responsive, /padding-bottom: calc\(100px \+ env\(safe-area-inset-bottom, 0px\)\)/);
});
