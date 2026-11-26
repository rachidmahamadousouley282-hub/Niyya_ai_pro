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
  assert.match(source, /api\("\/members\?limit=20&offset=0"\)/);
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
