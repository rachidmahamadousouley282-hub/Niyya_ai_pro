"use strict";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function isValidEmail(value) {
  if (typeof value !== "string") return false;
  return value.length <= 254 && EMAIL_REGEX.test(value);
}

module.exports = { isValidEmail };
