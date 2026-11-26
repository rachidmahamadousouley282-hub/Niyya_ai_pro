"use strict";
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
process.env.DATABASE_URL ||= "postgres://niyya_test:niyya_test@127.0.0.1:5432/niyya_test";
const router = require("../src/routes/community.routes");
const routes = router.stack.filter(layer => layer.route).map(layer => ({
  path: layer.route.path,
  methods: Object.keys(layer.route.methods).filter(method => layer.route.methods[method])
}));
test("Community API exposes feed, profiles, posts, comments, follows and reports", () => {
  const has = (method, path) => routes.some(route => route.path === path && route.methods.includes(method));
  assert.equal(has("get", "/feed"), true);
  assert.equal(has("get", "/events"), true);
  assert.equal(has("get", "/members"), true);
  assert.equal(has("get", "/search"), true);
  assert.equal(has("get", "/profiles/me"), true);
  assert.equal(has("patch", "/profiles/me"), true);
  assert.equal(has("post", "/posts"), true);
  assert.equal(has("post", "/profiles/:userId/follow"), true);
  assert.equal(has("post", "/posts/:postId/like"), true);
  assert.equal(has("get", "/posts/:postId/comments"), true);
  assert.equal(has("post", "/posts/:postId/comments"), true);
  assert.equal(has("post", "/posts/:postId/report"), true);
  assert.equal(has("get", "/moderation/reports"), true);
  assert.equal(has("patch", "/moderation/reports/:reportId"), true);
});


test("Community API registers each method and path only once", () => {
  const keys = routes.map(route => route.methods.map(method => method + " " + route.path));
  const flattened = keys.flat();
  assert.equal(new Set(flattened).size, flattened.length, "Duplicate route handlers make API behavior ambiguous");
});

test("Community API exposes profile relations, blocking, media and notifications", () => {
  const has = (method, path) => routes.some(route => route.path === path && route.methods.includes(method));
  assert.equal(has("get", "/profiles/:userId/relations"), true);
  assert.equal(has("post", "/profiles/:userId/block"), true);
  assert.equal(has("get", "/posts/:postId/media"), true);
  assert.equal(has("get", "/profiles/:userId/posts"), true);
  assert.equal(has("get", "/notifications"), true);
  assert.equal(has("post", "/comments/:commentId/report"), true);
});


test("Public image posts require pre-publication administrator review", () => {
  const has = (method, path) => routes.some(route => route.path === path && route.methods.includes(method));
  assert.equal(has("get", "/moderation/image-posts"), true);
  assert.equal(has("patch", "/moderation/image-posts/:postId"), true);
  const migration = fs.readFileSync(path.join(__dirname, "../database/migrations/0012_image_post_review.sql"), "utf8");
  const source = fs.readFileSync(path.join(__dirname, "../src/routes/community.routes.js"), "utf8");
  assert.match(migration, /pending_review/);
  assert.match(source, /image\s*&&\s*visibility\s*===\s*"public"\s*\?\s*"pending_review"\s*:\s*"published"/);
  assert.match(source, /req\.user\.role\s*!==\s*"admin"/);
  assert.match(source, /item\.status\s*===\s*"pending_review"[\s\S]{0,100}req\.user\.role\s*===\s*"admin"/);
});


test("Official NIYYA account API and admin announcement route are protected", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/routes/community.routes.js"), "utf8");
  const admin = fs.readFileSync(path.join(__dirname, "../src/routes/admin.routes.js"), "utf8");
  assert.match(source, /router\.get\("\/official", optionalAuth/);
  assert.match(source, /u\.is_official = TRUE/);
  assert.match(admin, /router\.post\("\/official\/announcements", requireAuth/);
  assert.match(admin, /req\.user\.role !== "admin"/);
  assert.match(admin, /INSERT INTO public\.community_posts \(author_user_id, body, visibility, status\)/);
});
