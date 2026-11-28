/* NIYYA.ai V2 — consistent, simple navigation icons */
(() => {
  "use strict";
  document.addEventListener("DOMContentLoaded", () => {
    const nav = document.querySelector(".bottom-nav");
    if (!nav) return;
    const icons = {
      "#community": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 10.5 12 3.5l8.5 7M5.5 9.5v11h13v-11M9.5 20.5v-7h5v7"/></svg>',
      "#discover": '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.4-3.2 2.3-5 5.5-5s5.1 1.8 5.5 5M16 5.5a3 3 0 0 1 0 5.8M17 14c2.1.6 3.3 2.2 3.5 5"/></svg>',
      "#trending": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19.5V12M10 19.5V5M16 19.5V9M22 19.5H2"/></svg>',
      "#create": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
      "#messages": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H5l-1 2v-5.2A7.5 7.5 0 1 1 20 11.5Z"/><path d="M8 10h8M8 14h5"/></svg>',
      "#profile": '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>'
    };
    const entries = [
      ["#community","Accueil"],["#discover","Personnages"],["#trending","Tendances"],
      ["#create","Créer"],["#messages","Messages"],["#profile","Profil"]
    ];
    const rebuilt = entries.map(([href,label]) => {
      const item = document.createElement("a");
      item.className = "nav-item" + (href === "#create" ? " nav-create" : "");
      item.href = href;
      const icon = document.createElement("span");
      icon.className = "nav-icon";
      icon.setAttribute("aria-hidden","true");
      icon.innerHTML = icons[href];
      const text = document.createElement("span");
      text.className = "nav-label";
      text.textContent = label;
      item.append(icon,text);
      if (href === "#community") {
        const dot = document.createElement("span");
        dot.className = "nav-notification-dot";
        dot.dataset.navDot = "community";
        dot.hidden = true;
        dot.setAttribute("aria-hidden", "true");
        item.append(dot);
      }
      item.setAttribute("aria-label",label);
      item.title = label;
      if (href === "#community") {
        item.classList.add("selected");
        item.setAttribute("aria-current","page");
      }
      return item;
    });
    nav.replaceChildren(...rebuilt);
    if (window.NiyyaI18n) window.NiyyaI18n.apply(window.NiyyaI18n.getLanguage());
  });
})();
