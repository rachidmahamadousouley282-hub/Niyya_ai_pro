"use strict";

(() => {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js?v=pwa-cache-v50-20261127", { scope: "/" })
      .catch(error => {
        // Offline support is optional; the online app must keep working if registration fails.
        console.warn("NIYYA offline support could not be enabled:", error.message);
      });
  });
})();
