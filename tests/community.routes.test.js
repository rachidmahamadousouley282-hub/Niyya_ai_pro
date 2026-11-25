"use strict";
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
