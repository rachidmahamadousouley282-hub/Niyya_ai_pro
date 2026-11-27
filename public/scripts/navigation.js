/* =================================
   NIYYA.ai V2 — NAVIGATION
================================= */

(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {
    const nav = document.querySelector(".bottom-nav");
    if (!nav) return;

    const expected = [
      { href: "#community", label: "Accueil" },
      { href: "#discover", label: "Personnages" },
      { href: "#trending", label: "Tendances" },
      { href: "#create", label: "Créer" },
      { href: "#messages", label: "Messages" },
      { href: "#profile", label: "Profil" }
    ];

    // Rebuild all six destinations cleanly. Preserve each existing SVG, but discard
    // every old label/extra child so each destination can display one label only.
    const oldItems = Array.from(nav.children).filter(node => node.matches(".nav-item"));
    const rebuilt = expected.map(entry => {
      const old = oldItems.find(node => node.getAttribute("href") === entry.href);
      const item = document.createElement("a");
      item.className = "nav-item" + (entry.href === "#create" ? " nav-create" : "");
      item.href = entry.href;

      const icon = old?.querySelector(":scope > .nav-icon")?.cloneNode(true)
        || document.createElement("span");
      icon.className = "nav-icon";
      if (entry.href === "#community") icon.textContent = "⌂";
      if (entry.href === "#trending") icon.textContent = "↗";
      icon.setAttribute("aria-hidden", "true");

      const label = document.createElement("span");
      label.className = "nav-label";
      label.textContent = entry.label;

      item.append(icon, label);
      item.setAttribute("aria-label", entry.label);
      item.title = entry.label;
      if (entry.href === "#community") {
        item.classList.add("selected");
        item.setAttribute("aria-current", "page");
      }
      return item;
    });

    nav.replaceChildren(...rebuilt);

    // The language module runs earlier in DOMContentLoaded; reapply the saved
    // language after rebuilding so non-French labels are not reset to French.
    if (window.NiyyaI18n) {
      window.NiyyaI18n.apply(window.NiyyaI18n.getLanguage());
    }
  });
})();
