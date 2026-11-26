"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { isValidEmail } = require("../src/utils/validation");

test("Email validation accepts ordinary addresses", () => {
  for (const email of [
    "test@example.com",
    "rachid@gmail.com",
    "hello.world@domain.fr",
    "name+tag@sub.domain.co"
  ]) assert.equal(isValidEmail(email), true, email);
});

test("Email validation rejects malformed addresses and whitespace", () => {
  for (const email of [
    "",
    "not-an-email",
    "missing-at.example.com",
    "missing-domain@",
    "missing-dot@example",
    "two@@example.com",
    "with space@example.com",
    "name@example .com",
    "name@example.com "
  ]) assert.equal(isValidEmail(email), false, JSON.stringify(email));
  assert.equal(isValidEmail(null), false);
  assert.equal(isValidEmail(123), false);
  assert.equal(isValidEmail("a".repeat(250) + "@example.com"), false);
});
