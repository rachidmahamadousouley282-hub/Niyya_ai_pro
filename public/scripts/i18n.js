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
      exploreNav: "Explorer", communityNav: "Communauté", createNav: "Créer", favorites: "Favoris", profile: "Profil", categoryComedy: "Humour", categoryFriendship: "Amitié", categoryMystery: "Mystère", categoryOriginal: "Autres", categoryAdventure: "Aventure", categoryAnime: "Anime", categoryFantasy: "Fantaisie", categoryScienceFiction: "Science-fiction", profileTitle: "À propos", story: "Son histoire", personality: "Personnalité", traits: "Traits de caractère", greeting: "Sa première phrase", creator: "Créé par", startChat: "Commencer à discuter", profileUnavailable: "La fiche de ce personnage est momentanément indisponible.", noStory: "Son histoire sera bientôt disponible.", noGreeting: "La conversation n’a pas encore de phrase d’accueil.", fictional: "PERSONNAGE FICTIF", demoNotice: "Les personnages NIYYA.ai sont fictifs.", connecting: "Connexion à NIYYA.ai…", writeMessage: "Écris ton message…", send: "Envoyer", you: "TOI", niyya: "NIYYA", startConversation: "Commence la conversation. Le quota et les conditions d’accès sont vérifiés côté serveur.", preparing: "Le personnage prépare sa réponse…", createUnavailable: "La création de personnages n’est pas encore activée. Les profils et conversations existants sont chargés depuis la base V2.", noCharacters: "Aucun personnage ne correspond à ces critères.", resetDiscovery: "Effacer les filtres", officialTag: "Personnage officiel NIYYA.ai", communityCharacterTag: "Créé par la communauté", communityArtLabel: "COMMUNAUTÉ", discoverButton: "Découvrir", genericError: "Impossible d’ouvrir cette conversation.", history: "Mes conversations", historyLoading: "Chargement de tes conversations…", historyEmpty: "Tes conversations apparaîtront ici après ton premier échange.", historyError: "Impossible de charger tes conversations.", messagesNav: "Messages", charactersLoading: "Loading characters…", charactersSlow: "The server is taking a little longer to respond…", charactersError: "Characters are temporarily unavailable. Check your connection and try again.", retryCharacters: "Try again", charactersLoading: "Chargement des personnages…", charactersSlow: "Le serveur met un peu plus de temps à répondre…", charactersError: "Les personnages ne sont pas disponibles pour le moment. Vérifie ta connexion puis réessaie.", retryCharacters: "Réessayer"
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
      exploreNav: "Explore", communityNav: "Community", createNav: "Create", favorites: "Favorites", profile: "Profile", categoryComedy: "Comedy", categoryFriendship: "Friendship", categoryMystery: "Mystery", categoryOriginal: "Other", categoryAdventure: "Adventure", categoryAnime: "Anime", categoryFantasy: "Fantasy", categoryScienceFiction: "Science fiction", profileTitle: "About", story: "Backstory", personality: "Personality", traits: "Character traits", greeting: "First message", creator: "Created by", startChat: "Start chatting", profileUnavailable: "This character profile is temporarily unavailable.", noStory: "This character’s story will be available soon.", noGreeting: "No opening message has been added yet.", fictional: "FICTIONAL CHARACTER", demoNotice: "NIYYA.ai characters are fictional.", connecting: "Connecting to NIYYA.ai…", writeMessage: "Write your message…", send: "Send", you: "YOU", niyya: "NIYYA", startConversation: "Start the conversation. Quotas and access rules are checked by the server.", preparing: "The character is preparing a reply…", createUnavailable: "Character creation is not available yet. Existing profiles and conversations are loaded from the V2 database.", noCharacters: "No characters match these filters.", resetDiscovery: "Clear filters", officialTag: "Official NIYYA.ai character", communityCharacterTag: "Community-created", communityArtLabel: "COMMUNITY", discoverButton: "Discover", genericError: "Unable to open this conversation.", history: "My conversations", historyLoading: "Loading your conversations…", historyEmpty: "Your conversations will appear here after your first chat.", historyError: "Unable to load your conversations.", messagesNav: "Messages"
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
      exploreNav: "Explorar", communityNav: "Comunidad", createNav: "Crear", favorites: "Favoritos", profile: "Perfil", categoryComedy: "Humor", categoryFriendship: "Amistad", categoryMystery: "Misterio", categoryOriginal: "Otros", categoryAdventure: "Aventura", categoryAnime: "Anime", categoryFantasy: "Fantasía", categoryScienceFiction: "Ciencia ficción", profileTitle: "Acerca de", story: "Su historia", personality: "Personalidad", traits: "Rasgos", greeting: "Su primera frase", creator: "Creado por", startChat: "Empezar a conversar", profileUnavailable: "Este perfil no está disponible temporalmente.", noStory: "La historia estará disponible pronto.", noGreeting: "Todavía no hay un mensaje inicial.", fictional: "PERSONAJE FICTICIO", demoNotice: "Los personajes de NIYYA.ai son ficticios.", connecting: "Conectando con NIYYA.ai…", writeMessage: "Escribe tu mensaje…", send: "Enviar", you: "TÚ", niyya: "NIYYA", startConversation: "Comienza la conversación. El servidor comprueba las cuotas y las condiciones de acceso.", preparing: "El personaje está preparando su respuesta…", createUnavailable: "La creación de personajes aún no está disponible. Los perfiles y conversaciones existentes se cargan desde la base de datos V2.", noCharacters: "Ningún personaje coincide con estos filtros.", resetDiscovery: "Borrar filtros", officialTag: "Personaje oficial de NIYYA.ai", communityCharacterTag: "Creado por la comunidad", communityArtLabel: "COMUNIDAD", discoverButton: "Descubrir", genericError: "No se pudo abrir esta conversación.", history: "Mis conversaciones", historyLoading: "Cargando tus conversaciones…", historyEmpty: "Tus conversaciones aparecerán aquí después del primer intercambio.", historyError: "No se pudieron cargar tus conversaciones.", messagesNav: "Mensajes", charactersLoading: "Cargando personajes…", charactersSlow: "El servidor está tardando un poco más en responder…", charactersError: "Los personajes no están disponibles por ahora. Comprueba tu conexión e inténtalo de nuevo.", retryCharacters: "Reintentar"
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
      exploreNav: "استكشف", communityNav: "المجتمع", createNav: "إنشاء", favorites: "المفضلة", profile: "الملف الشخصي", categoryComedy: "كوميديا", categoryFriendship: "صداقة", categoryMystery: "غموض", categoryOriginal: "أخرى", categoryAdventure: "مغامرة", categoryAnime: "أنمي", categoryFantasy: "فانتازيا", categoryScienceFiction: "خيال علمي", profileTitle: "نبذة", story: "قصته", personality: "الشخصية", traits: "الصفات", greeting: "الرسالة الأولى", creator: "أنشأها", startChat: "ابدأ المحادثة", profileUnavailable: "ملف هذه الشخصية غير متاح مؤقتًا.", noStory: "ستتوفر قصتها قريبًا.", noGreeting: "لم تتم إضافة رسالة ترحيب بعد.", fictional: "شخصية خيالية", demoNotice: "شخصيات NIYYA.ai خيالية.", connecting: "جارٍ الاتصال بـ NIYYA.ai…", writeMessage: "اكتب رسالتك…", send: "إرسال", you: "أنت", niyya: "NIYYA", startConversation: "ابدأ المحادثة. يتحقق الخادم من الحصة وشروط الوصول.", preparing: "الشخصية تُحضّر ردها…", createUnavailable: "إنشاء الشخصيات غير متاح بعد. يتم تحميل الملفات الشخصية والمحادثات الحالية من قاعدة بيانات V2.", noCharacters: "لا توجد شخصيات تطابق عوامل التصفية هذه.", resetDiscovery: "مسح عوامل التصفية", officialTag: "شخصية رسمية من NIYYA.ai", communityCharacterTag: "من إنشاء المجتمع", communityArtLabel: "المجتمع", discoverButton: "اكتشف", genericError: "تعذّر فتح هذه المحادثة.", history: "محادثاتي", historyLoading: "جارٍ تحميل محادثاتك…", historyEmpty: "ستظهر محادثاتك هنا بعد أول محادثة.", historyError: "تعذّر تحميل محادثاتك.", messagesNav: "الرسائل", charactersLoading: "جارٍ تحميل الشخصيات…", charactersSlow: "يستغرق الخادم وقتًا أطول قليلًا للرد…", charactersError: "الشخصيات غير متاحة مؤقتًا. تحقق من الاتصال وحاول مرة أخرى.", retryCharacters: "إعادة المحاولة"
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
    const navLabels = document.querySelectorAll(".bottom-nav .nav-item > .nav-label");
    [t.home, t.exploreNav, t.communityNav, t.createNav, t.messagesNav, t.profile].forEach((label, i) => {
      if (navLabels[i]) navLabels[i].textContent = label;
    });
    const historyButton = document.getElementById("conversations-button");
    if (historyButton) {
      historyButton.setAttribute("aria-label", t.history);
      historyButton.title = t.history;
    }
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
    document.dispatchEvent(new CustomEvent("niyya:language-changed", { detail: { language: current } }));
  }

  const THEME_STORAGE_KEY = "niyya-theme";

  function getTheme() {
    return localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
  }

  function applyTheme(theme) {
    const selected = theme === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = selected;
    localStorage.setItem(THEME_STORAGE_KEY, selected);
    return selected;
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

    const languageLabel = document.createElement("label");
    languageLabel.textContent = t.language;
    languageLabel.htmlFor = "niyya-language-select";
    const languageSelect = document.createElement("select");
    languageSelect.id = "niyya-language-select";
    languageSelect.className = "language-select";
    [["fr","Français"],["en","English"],["es","Español"],["ar","العربية"]].forEach(([value,name]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = name;
      option.selected = value === current;
      languageSelect.append(option);
    });

    const lengthLabel = document.createElement("label");
    lengthLabel.textContent = current === "en" ? "Reply length" : current === "es" ? "Longitud de las respuestas" : current === "ar" ? "طول الردود" : "Longueur des réponses";
    lengthLabel.htmlFor = "niyya-response-length";
    const lengthSelect = document.createElement("select");
    lengthSelect.id = "niyya-response-length";
    lengthSelect.className = "language-select";
    const lengthOptions = current === "en"
      ? [["short","Short"],["normal","Balanced"],["long","Detailed"]]
      : current === "es"
        ? [["short","Cortas"],["normal","Equilibradas"],["long","Detalladas"]]
        : current === "ar"
          ? [["short","قصيرة"],["normal","متوازنة"],["long","مفصلة"]]
          : [["short","Courtes"],["normal","Équilibrées"],["long","Détaillées"]];
    lengthOptions.forEach(([value,name]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = name;
      lengthSelect.append(option);
    });

    const themeLabel = document.createElement("label");
    themeLabel.textContent = current === "en" ? "Appearance" : current === "es" ? "Apariencia" : current === "ar" ? "المظهر" : "Apparence";
    themeLabel.htmlFor = "niyya-theme-select";
    const themeSelect = document.createElement("select");
    themeSelect.id = "niyya-theme-select";
    themeSelect.className = "language-select";
    const themeOptions = current === "en"
      ? [["dark","Dark"],["light","Light"]]
      : current === "es"
        ? [["dark","Oscuro"],["light","Claro"]]
        : current === "ar"
          ? [["dark","داكن"],["light","فاتح"]]
          : [["dark","Sombre"],["light","Clair"]];
    themeOptions.forEach(([value,name]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = name;
      option.selected = value === getTheme();
      themeSelect.append(option);
    });
    themeSelect.addEventListener("change", () => applyTheme(themeSelect.value));

    const pauseLabel = document.createElement("label");
    pauseLabel.className = "settings-toggle";
    const pauseCheckbox = document.createElement("input");
    pauseCheckbox.type = "checkbox";
    pauseCheckbox.id = "niyya-thinking-pause";
    const pauseText = document.createElement("span");
    pauseText.textContent = current === "en" ? "Show thinking indicator" : current === "es" ? "Mostrar indicador de reflexión" : current === "ar" ? "إظهار مؤشر التفكير" : "Afficher l’indicateur de réflexion";
    pauseLabel.append(pauseCheckbox, pauseText);
    pauseCheckbox.addEventListener("change", () => save({ thinkingPause: pauseCheckbox.checked }));

    const policyLinks = document.createElement("div");
    policyLinks.className = "settings-policy-links";
    const termsLink = document.createElement("a");
    termsLink.href = "/terms.html";
    termsLink.textContent = current === "en" ? "Terms of use" : current === "es" ? "Términos de uso" : current === "ar" ? "شروط الاستخدام" : "Conditions d’utilisation";
    const privacyLink = document.createElement("a");
    privacyLink.href = "/privacy.html";
    privacyLink.textContent = current === "en" ? "Privacy policy" : current === "es" ? "Política de privacidad" : current === "ar" ? "سياسة الخصوصية" : "Politique de confidentialité";
    policyLinks.append(termsLink, privacyLink);

    const note = document.createElement("p");
    note.className = "language-saved";
    note.setAttribute("role", "status");
    note.textContent = t.saved;
    const close = document.createElement("button");
    close.type = "button";
    close.className = "chat-send";
    close.textContent = t.close;
    close.addEventListener("click", () => modal.remove());

    let settingsReady = false;
    let saveInProgress = false;
    const ensureSettingsSession = async () => {
      try {
        await window.NiyyaAPI.getSession();
      } catch {
        await window.NiyyaAPI.createGuest();
      }
    };
    const save = async payload => {
      if (!settingsReady || saveInProgress) return;
      saveInProgress = true;
      note.textContent = current === "en" ? "Saving…" : current === "es" ? "Guardando…" : current === "ar" ? "جارٍ الحفظ…" : "Enregistrement…";
      try {
        await window.NiyyaAPI.updateSettings(payload);
        if (Object.prototype.hasOwnProperty.call(payload, "thinkingPause")) {
          localStorage.setItem("niyya-thinking-pause", payload.thinkingPause ? "1" : "0");
        }
        note.textContent = translations[current].saved;
      } catch (error) {
        note.textContent = error.message || (current === "en" ? "Could not save settings." : "Impossible d’enregistrer les paramètres.");
      } finally {
        saveInProgress = false;
      }
    };

    languageSelect.addEventListener("change", async () => {
      const next = languageSelect.value;
      try {
        await ensureSettingsSession();
        await window.NiyyaAPI.updateSettings({ language: next });
        localStorage.setItem(STORAGE_KEY, next);
        apply(next);
        const updated = translations[current];
        title.textContent = updated.settings;
        languageLabel.textContent = updated.language;
        lengthLabel.textContent = current === "en" ? "Reply length" : current === "es" ? "Longitud de las respuestas" : current === "ar" ? "طول الردود" : "Longueur des réponses";
        themeLabel.textContent = current === "en" ? "Appearance" : current === "es" ? "Apariencia" : current === "ar" ? "المظهر" : "Apparence";
        pauseText.textContent = current === "en" ? "Show thinking indicator" : current === "es" ? "Mostrar indicador de reflexión" : current === "ar" ? "إظهار مؤشر التفكير" : "Afficher l’indicateur de réflexion";
        termsLink.textContent = current === "en" ? "Terms of use" : current === "es" ? "Términos de uso" : current === "ar" ? "شروط الاستخدام" : "Conditions d’utilisation";
        privacyLink.textContent = current === "en" ? "Privacy policy" : current === "es" ? "Política de privacidad" : current === "ar" ? "سياسة الخصوصية" : "Politique de confidentialité";
        note.textContent = updated.saved;
        close.textContent = updated.close;
        const nextOptions = current === "en"
          ? [["short","Short"],["normal","Balanced"],["long","Detailed"]]
          : current === "es"
            ? [["short","Cortas"],["normal","Equilibradas"],["long","Detalladas"]]
            : current === "ar"
              ? [["short","قصيرة"],["normal","متوازنة"],["long","مفصلة"]]
              : [["short","Courtes"],["normal","Équilibrées"],["long","Détaillées"]];
        const selectedLength = lengthSelect.value || "normal";
        lengthSelect.replaceChildren();
        nextOptions.forEach(([value,name]) => {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = name;
          option.selected = value === selectedLength;
          lengthSelect.append(option);
        });
      } catch (error) {
        note.textContent = error.message || "Impossible d’enregistrer la langue.";
        languageSelect.value = current;
      }
    });
    lengthSelect.addEventListener("change", () => save({ responseLength: lengthSelect.value }));

    panel.append(title, languageLabel, languageSelect, lengthLabel, lengthSelect, themeLabel, themeSelect, pauseLabel, policyLinks, note, close);
    modal.append(panel);
    modal.addEventListener("click", event => {
      if (event.target === modal) modal.remove();
    });
    document.body.append(modal);

    ensureSettingsSession()
      .then(() => window.NiyyaAPI.getSettings())
      .then(data => {
        const settings = data.settings || {};
        if (!localStorage.getItem(STORAGE_KEY) && ["fr","en","es","ar"].includes(settings.language)) {
          apply(settings.language);
          languageSelect.value = settings.language;
          title.textContent = translations[current].settings;
          languageLabel.textContent = translations[current].language;
          close.textContent = translations[current].close;
        }
        lengthSelect.value = ["short","normal","long"].includes(settings.responseLength)
          ? settings.responseLength : "normal";
        pauseCheckbox.checked = settings.thinkingPause !== false;
        localStorage.setItem("niyya-thinking-pause", pauseCheckbox.checked ? "1" : "0");
        settingsReady = true;
      })
      .catch(error => {
        note.textContent = error.message || "Impossible de charger les paramètres.";
      });
  }

  document.addEventListener("DOMContentLoaded", () => {
    apply(current);
    applyTheme(getTheme());
    document.getElementById("settings-button")?.addEventListener("click", openSettings);
    window.NiyyaAPI?.getSession()
      .then(() => window.NiyyaAPI.getSettings())
      .then(data => {
        const settings = data.settings || {};
        if (!localStorage.getItem(STORAGE_KEY) && ["fr","en","es","ar"].includes(settings.language)) {
          apply(settings.language);
        }
        if (typeof settings.thinkingPause === "boolean") {
          localStorage.setItem("niyya-thinking-pause", settings.thinkingPause ? "1" : "0");
        }
      })
      .catch(() => {});
  });

  window.NiyyaI18n = Object.freeze({
    getLanguage: () => current,
    translate: key => translations[current][key] || translations.fr[key] || key,
    apply
  });
})();
