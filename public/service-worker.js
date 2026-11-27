"use strict";

const CACHE_NAME = "niyya-shell-v47";
const SHELL_URLS = [
  "/",
  "/index.html",
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/niyya-icon.svg",
  "/styles/main.css?v=nav-equal-six-v1-20261127",
  "/styles/components.css?v=character-avatar-picker-v1-20261126",
  "/styles/responsive.css?v=responsive-safe-area-v1-20261127",
  "/scripts/i18n.js?v=six-tabs-labels-v4-20261126",
  "/scripts/api.js?v=creator-edit-v1-20261126",
  "/scripts/analytics.js?v=site-traffic-v1-20261127",
  "/scripts/onboarding.js",
  "/scripts/navigation.js?v=community-symbol-v1-20261127",
  "/scripts/app.js?v=support-menu-visible-v1-20261127",
  "/styles/community.css?v=community-admin-rosette-v2-20261127",
  "/styles/home.css?v=black-minimal-v3-20261126",
  "/styles/experience.css?v=experience-home-v1-20261127",
  "/scripts/community.js?v=community-admin-rosette-v2-20261127",
  "/scripts/pwa.js?v=pwa-cache-v46-20261127"
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
