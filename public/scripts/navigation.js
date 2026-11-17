
/* =================================
   NIYYA AI V2 — NAVIGATION
================================= */

(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {
    const navigationItems = document.querySelectorAll(".nav-item");

    navigationItems.forEach(item => {
      item.addEventListener("click", event => {
        const target = item.getAttribute("href");

        // Ne pas naviguer vers des pages non créées.
        if (!target || target === "#") {
          event.preventDefault();
        }

        navigationItems.forEach(link => {
          link.classList.remove("selected");
        });

        item.classList.add("selected");
      });
    });
  });
})();

