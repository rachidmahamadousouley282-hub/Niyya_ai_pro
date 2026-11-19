"use strict";

/* NIYYA.ai V2 — interface language preferences */
(() => {
  const STORAGE_KEY = "niyya-interface-language";
  const supported = ["fr", "en", "es", "ar"];
  const translations = {
    fr: {
      settings: "Paramètres", language: "Langue de l’interface",
      close: "Fermer", saved: "Langue enregistrée sur cet appareil.",
      heroEyebrow: "TON UNIVERS IA", heroTitle: "Un monde entier.",
      heroTitle2: "Une infinité d'histoires.",
      heroText: "Découvre des personnages, crée tes univers et commence une nouvelle aventure.",
      search: "Rechercher un personnage...", explore: "EXPLORER",
      categories: "Catégories", all: "Tous les personnages",
      handpicked: "SÉLECTION POUR TOI", discover: "À découvrir",
      viewAll: "Tout voir →", createEyebrow: "CRÉE TON UNIVERS",
      createTitle: "Ton imagination n'a pas de limites.",
      createText: "Donne vie à tes propres personnages et invente leurs histoires.",
      createButton: "＋ Créer un personnage", home: "Accueil",
      exploreNav: "Explorer", createNav: "Créer", favorites: "Favoris", profile: "Profil"
    },
    en: {
      settings: "Settings", language: "Interface language",
      close: "Close", saved: "Language saved on this device.",
      heroEyebrow: "YOUR AI UNIVERSE", heroTitle: "An entire world.",
      heroTitle2: "Endless stories.",
      heroText: "Discover characters, create your worlds and start a new adventure.",
      search: "Search for a character...", explore: "EXPLORE",
      categories: "Categories", all: "All characters",
      handpicked: "PICKED FOR YOU", discover: "Discover",
      viewAll: "View all →", createEyebrow: "CREATE YOUR UNIVERSE",
      createTitle: "Your imagination has no limits.",
      createText: "Bring your own characters to life and invent their stories.",
      createButton: "＋ Create a character", home: "Home",
      exploreNav: "Explore", createNav: "Create", favorites: "Favorites", profile: "Profile"
    },
    es: {
      settings: "Configuración", language: "Idioma de la interfaz",
      close: "Cerrar", saved: "Idioma guardado en este dispositivo.",
      heroEyebrow: "TU UNIVERSO IA", heroTitle: "Un mundo entero.",
      heroTitle2: "Historias infinitas.",
      heroText: "Descubre personajes, crea tus mundos y comienza una nueva aventura.",
      search: "Buscar un personaje...", explore: "EXPLORAR",
      categories: "Categorías", all: "Todos los personajes",
      handpicked: "SELECCIÓN PARA TI", discover: "Por descubrir",
      viewAll: "Ver todo →", createEyebrow: "CREA TU UNIVERSO",
      createTitle: "Tu imaginación no tiene límites.",
      createText: "Da vida a tus personajes e inventa sus historias.",
      createButton: "＋ Crear un personaje", home: "Inicio",
      exploreNav: "Explorar", createNav: "Crear", favorites: "Favoritos", profile: "Perfil"
    },
    ar: {
      settings: "الإعدادات", language: "لغة الواجهة",
      close: "إغلاق", saved: "تم حفظ اللغة على هذا الجهاز.",
      heroEyebrow: "عالمك للذكاء الاصطناعي", heroTitle: "عالم كامل.",
      heroTitle2: "قصص لا نهاية لها.",
      heroText: "اكتشف الشخصيات وأنشئ عوالمك وابدأ مغامرة جديدة.",
      search: "ابحث عن شخصية...", explore: "استكشف",
      categories: "الفئات", all: "كل الشخصيات",
      handpicked: "مختارة لك", discover: "اكتشف",
      viewAll: "عرض الكل ←", createEyebrow: "أنشئ عالمك",
      createTitle: "خيالك بلا حدود.",
      createText: "امنح الحياة لشخصياتك وابتكر قصصها.",
      createButton: "＋ أنشئ شخصية", home: "الرئيسية",
      exploreNav: "استكشف", createNav: "إنشاء", favorites: "المفضلة", profile: "الملف الشخصي"
    }
  };

  let current = supported.includes(localStorage.getItem(STORAGE_KEY))
    ? localStorage.getItem(STORAGE_KEY) : "fr";

  function apply(language) {
    current = supported.includes(language) ? language : "fr";
    const t = translations[current];
    document.documentElement.lang = current;
    document.documentElement.dir = current === "ar" ? "rtl" : "ltr";
    const set = (selector, value) => {
      const node = document.querySelector(selector);
      if (node && value) node.textContent = value;
    };
    set(".hero .eyebrow", t.heroEyebrow);
    const heroTitle = document.querySelector(".hero h1");
    if (heroTitle) {
      heroTitle.replaceChildren(document.createTextNode(t.heroTitle));
      heroTitle.append(document.createElement("br"));
      const span = document.createElement("span");
      span.textContent = t.heroTitle2;
      heroTitle.append(span);
    }
    set(".hero > p", t.heroText);
    const search = document.getElementById("character-search");
    if (search) search.placeholder = t.search;
    const headings = document.querySelectorAll(".section-heading h2");
    if (headings[0]) headings[0].textContent = t.categories;
    if (headings[1]) headings[1].textContent = t.discover;
    set(".category[data-category='all']", "✦ " + t.all);
    set(".creator-banner .eyebrow", t.createEyebrow);
    const creatorTitle = document.querySelector(".creator-banner h2");
    if (creatorTitle) {
      creatorTitle.replaceChildren(document.createTextNode(t.createTitle));
    }
    set(".creator-banner p", t.createText);
    set("#create-character", t.createButton);
    const nav = document.querySelectorAll(".nav-item");
    [t.home, t.exploreNav, t.createNav, t.favorites, t.profile].forEach((label, i) => {
      if (nav[i]) nav[i].lastChild.textContent = label;
    });
    const button = document.getElementById("settings-button");
    if (button) {
      button.setAttribute("aria-label", t.settings);
      button.title = t.settings;
    }
    document.querySelectorAll(".section-heading > a").forEach(link => {
      link.textContent = t.viewAll;
    });
    const eyebrow = document.querySelectorAll(".section-heading .eyebrow");
    if (eyebrow[0]) eyebrow[0].textContent = t.explore;
    if (eyebrow[1]) eyebrow[1].textContent = t.handpicked;
  }

  function openSettings() {
    document.querySelector(".niyya-modal")?.remove();
    const t = translations[current];
    const modal = document.createElement("div");
    modal.className = "niyya-modal";
    const panel = document.createElement("section");
    panel.className = "modal-panel language-settings";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    const title = document.createElement("h2");
    title.textContent = t.settings;
    const label = document.createElement("label");
    label.textContent = t.language;
    label.htmlFor = "niyya-language-select";
    const select = document.createElement("select");
    select.id = "niyya-language-select";
    select.className = "language-select";
    [["fr","Français"],["en","English"],["es","Español"],["ar","العربية"]].forEach(([value,name]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = name;
      option.selected = value === current;
      select.append(option);
    });
    const note = document.createElement("p");
    note.className = "language-saved";
    note.textContent = t.saved;
    const close = document.createElement("button");
    close.type = "button";
    close.className = "chat-send";
    close.textContent = t.close;
    close.addEventListener("click", () => modal.remove());
    select.addEventListener("change", () => {
      localStorage.setItem(STORAGE_KEY, select.value);
      apply(select.value);
      const updated = translations[current];
      title.textContent = updated.settings;
      label.textContent = updated.language;
      note.textContent = updated.saved;
      close.textContent = updated.close;
      document.documentElement.dir = current === "ar" ? "rtl" : "ltr";
    });
    panel.append(title, label, select, note, close);
    modal.append(panel);
    modal.addEventListener("click", event => {
      if (event.target === modal) modal.remove();
    });
    document.body.append(modal);
  }

  document.addEventListener("DOMContentLoaded", () => {
    apply(current);
    document.getElementById("settings-button")?.addEventListener("click", openSettings);
  });

  window.NiyyaI18n = Object.freeze({
    getLanguage: () => current,
    translate: key => translations[current][key] || translations.fr[key] || key,
    apply
  });
})();
