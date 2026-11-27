"use strict";
(() => {
  const STORAGE_KEY = "niyya_analytics_visitor_v1";
  function visitorId() {
    try {
      let value = localStorage.getItem(STORAGE_KEY);
      if (!value) {
        const bytes = new Uint8Array(16);
        window.crypto.getRandomValues(bytes);
        bytes[6] = (bytes[6] & 15) | 64;
        bytes[8] = (bytes[8] & 63) | 128;
        const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
        value = hex.slice(0,8)+"-"+hex.slice(8,12)+"-"+hex.slice(12,16)+"-"+hex.slice(16,20)+"-"+hex.slice(20);
        localStorage.setItem(STORAGE_KEY, value);
      }
      return value;
    } catch { return null; }
  }
  let lastPath = "";
  function trackPageView() {
    const path = (window.location.pathname || "/") + (window.location.hash || "");
    if (path === lastPath) return;
    lastPath = path;
    const id = visitorId();
    if (!id) return;
    fetch("/api/analytics/pageview", {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ visitorId: id, path }), keepalive: true
    }).catch(() => {});
  }
  window.addEventListener("DOMContentLoaded", trackPageView, { once: true });
  window.addEventListener("hashchange", trackPageView);
  window.addEventListener("popstate", trackPageView);
})();
