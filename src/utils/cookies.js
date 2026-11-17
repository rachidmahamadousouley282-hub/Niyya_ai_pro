

"use strict";

const COOKIE_NAME = "niyya_session";

const SESSION_DURATION_DAYS = 30;

function getCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000
  };
}

function setSessionCookie(res, token) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/i.test(token)) {
    throw new Error("Jeton de session invalide.");
  }

  res.cookie(COOKIE_NAME, token, getCookieOptions());
}

function clearSessionCookie(res) {
  const options = getCookieOptions();

  delete options.maxAge;

  res.clearCookie(COOKIE_NAME, options);
}

module.exports = {
  COOKIE_NAME,
  setSessionCookie,
  clearSessionCookie
};
