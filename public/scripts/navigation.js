/* =================================
   NIYYA.ai V2 — NAVIGATION
================================= */

(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {
    const nav = document.querySelector(".bottom-nav");
    if (!nav) return;

    // Keep exactly the five agreed destinations, in their intended order.
    const expected = [
      { href: "#", label: "Accueil" },
      { href: "#discover", label: "Explorer" },
      { href: "#create", label: "Créer" },
      { href: "#messages", label: "Messages" },
      { href: "#profile", label: "Profil" }
    ];

    const existing = Array.from(nav.querySelectorAll(":scope > .nav-item"));
    expected.forEach((entry, index) => {
      let item = existing.find(candidate => candidate.getAttribute("href") === entry.href);
      if (!item) {
        item = document.createElement("a");
        item.className = "nav-item";
        item.href = entry.href;
        const icon = document.createElement("span");
        icon.className = "nav-icon";
        icon.setAttribute("aria-hidden", "true");
        item.append(icon);
      }
      item.querySelectorAll(":scope > .nav-label").forEach((label, labelIndex) => {
        if (labelIndex > 0) label.remove();
      });
      let label = item.querySelector(":scope > .nav-label");
      if (!label) {
        label = document.createElement("span");
        label.className = "nav-label";
        item.append(label);
      }
      label.textContent = entry.label;
      item.setAttribute("aria-label", entry.label);
      item.title = entry.label;
      if (entry.href === "#create") item.classList.add("nav-create");
      nav.append(item);
    });

    // Remove obsolete/duplicate entries (including the old Favorites tab).
    const keep = new Set(expected.map(entry => entry.href));
    const seen = new Set();
    Array.from(nav.querySelectorAll(":scope > .nav-item")).forEach(item => {
      const href = item.getAttribute("href");
      if (!keep.has(href) || seen.has(href)) item.remove();
      else seen.add(href);
    });

    nav.querySelectorAll(".nav-item").forEach(item => {
      item.addEventListener("click", event => {
        const target = item.getAttribute("href");
        if (!target || target === "#") event.preventDefault();
        nav.querySelectorAll(".nav-item").forEach(link => {
          link.classList.remove("selected");
          link.removeAttribute("aria-current");
        });
        item.classList.add("selected");
        item.setAttribute("aria-current", "page");
      });
    });
  });
})();
