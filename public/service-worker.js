"use strict";

const CACHE_NAME = "niyya-shell-v10";
const SHELL_URLS = [
  "/",
  "/index.html",
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/niyya-icon.svg",
  "/styles/main.css?v=nav5-20261124",
  "/styles/components.css?v=settings-controls-v3-20261125",
  "/styles/responsive.css?v=nav5-20261124",
  "/scripts/i18n.js?v=settings-controls-v3-20261125",
  "/scripts/api.js?v=settings-controls-v3-20261125",
  "/scripts/onboarding.js",
  "/scripts/navigation.js?v=nav-labels-fix2-20261124",
  "/scripts/app.js?v=settings-controls-v3-20261125",
  "/styles/community.css?v=community-20261125",
  "/scripts/community.js?v=community-profile-edit-20261125",
  "/scripts/pwa.js?v=pwa-20261124"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(SHELL_URLS.map(url => cache.add(url)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("niyya-shell-") && key !== CACHE_NAME)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Never cache API responses, account data, messages, or private conversations.
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        return await fetch(request);
      } catch {
        return (await caches.match("/offline.html")) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && response.type === "basic") {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, response.clone());
      }
      return response;
    } catch {
      return cached || Response.error();
    }
  })());
});

