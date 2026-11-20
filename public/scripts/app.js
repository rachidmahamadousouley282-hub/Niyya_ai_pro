/* =================================
   NIYYA.ai V2 — MAIN APPLICATION
================================= */

document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("character-search");
  const grid = document.getElementById("character-grid");

  let characters = [];
  let favoriteIds = new Set();
  let activeView = "discover";
  let activeCategory = "all";
  let guestReady = false;
  let activeConversation = null;
  let activeCharacterId = null;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  const t = key => window.NiyyaI18n?.translate(key) || key;

  function renderCharacters() {
    const term = searchInput.value.trim().toLocaleLowerCase();
    grid.replaceChildren();

    const filtered = characters.filter(character => {
      const category = (character.category || "all").toLowerCase();
      const matchesCategory = activeCategory === "all" ||
        category === activeCategory;
      const searchable = [
        character.name, character.tagline, character.short_bio,
        character.backstory, character.category,
        ...(Array.isArray(character.tags) ? character.tags : [])
      ];
      const matchesSearch = searchable
        .some(value => String(value || "").toLocaleLowerCase().includes(term));
      const matchesView = activeView !== "favorites" || favoriteIds.has(character.id);
      return matchesCategory && matchesSearch && matchesView;
    });

    if (!filtered.length) {
      grid.append(element("p", "empty-state", t("noCharacters")));
      return;
    }

    filtered.forEach((character, index) => {
      const card = element("article", "character-card");
      card.dataset.category = character.category || "all";
      const art = element("div", "character-art art-" + ["one","two","three","four"][index % 4]);
      const label = element("span", "art-label", "NIYYA ORIGINAL");
      const symbol = element("span", "character-symbol", (character.name || "N").slice(0,1).toUpperCase());
      art.append(label, symbol);

      const info = element("div", "character-info");
      info.append(
        element("h3", "", character.name),
        element("p", "", character.tagline || "Un personnage à découvrir."),
        element("span", "character-tag", t("officialTag"))
      );
      const button = element("button", "chat-button", t("discoverButton"));
      button.type = "button";
      button.addEventListener("click", () => openProfile(character, button));
      info.append(button);
      const favorite = element("button", "favorite-toggle" + (favoriteIds.has(character.id) ? " is-favorite" : ""), favoriteIds.has(character.id) ? "♥" : "♡");
      favorite.type = "button";
      favorite.setAttribute("aria-label", favoriteIds.has(character.id) ? "Retirer des favoris" : "Ajouter aux favoris");
      favorite.setAttribute("aria-pressed", favoriteIds.has(character.id) ? "true" : "false");
      favorite.addEventListener("click", () => toggleFavorite(character, favorite));
      card.append(art, info, favorite);
      grid.append(card);
    });
  }

  async function toggleFavorite(character, button) {
    if (!character?.id || button?.disabled) return;
    if (button) button.disabled = true;
    try {
      await ensureGuest();
      if (favoriteIds.has(character.id)) {
        await window.NiyyaAPI.removeFavorite(character.id);
        favoriteIds.delete(character.id);
      } else {
        await window.NiyyaAPI.addFavorite(character.id);
        favoriteIds.add(character.id);
      }
      renderCharacters();
    } catch (error) {
      showToast(error.message || t("genericError"));
      if (button) button.disabled = false;
    }
  }

  function showToast(message) {
    document.querySelector(".niyya-toast")?.remove();
    const toast = element("div", "niyya-toast", message);
    document.body.append(toast);
    window.setTimeout(() => toast.remove(), 3200);
  }

  function renderCategories() {
    const list = document.querySelector(".category-list");
    if (!list) return;
    list.replaceChildren();
    const categories = ["all", ...new Set(
      characters.map(character => String(character.category || "original").toLowerCase())
    )];
    categories.forEach(category => {
      const key = category === "all" ? "all" :
        category === "comedy" ? "categoryComedy" :
        category === "friendship" ? "categoryFriendship" :
        category === "mystery" ? "categoryMystery" :
        "categoryOriginal";
      const button = element("button", "category" + (activeCategory === category ? " active" : ""),
        (category === "all" ? "✦ " : "") + t(key));
      button.type = "button";
      button.dataset.category = category;
      button.addEventListener("click", () => {
        activeCategory = category;
        list.querySelectorAll(".category").forEach(item =>
          item.classList.toggle("active", item === button));
        renderCharacters();
      });
      list.append(button);
    });
  }

  async function refreshQuota() {
    const badge = document.getElementById("quota-balance");
    if (!badge) return;
    try {
      const data = await window.NiyyaAPI.getQuota();
      const lang = window.NiyyaI18n?.getLanguage() || "fr";
      if (data.tier === "vip") {
        badge.textContent = lang === "en" ? "VIP · Unlimited" :
          lang === "es" ? "VIP · Ilimitado" :
          lang === "ar" ? "VIP · غير محدود" : "VIP · Illimité";
        badge.title = lang === "en" ? "VIP access is active." :
          lang === "es" ? "El acceso VIP está activo." :
          lang === "ar" ? "اشتراك VIP نشط." : "Accès VIP actif.";
      } else {
        const labels = {
          fr: `${data.remaining} messages`,
          en: `${data.remaining} messages`,
          es: `${data.remaining} mensajes`,
          ar: `${data.remaining} رسالة`
        };
        badge.textContent = labels[lang] || labels.fr;
        const videoText = lang === "en"
          ? `${data.rewardedVideosRemaining} rewarded videos left today`
          : lang === "es"
            ? `${data.rewardedVideosRemaining} vídeos recompensados restantes hoy`
            : lang === "ar"
              ? `متبقّي ${data.rewardedVideosRemaining} فيديوهات مكافأة اليوم`
              : `${data.rewardedVideosRemaining} vidéos récompensées restantes aujourd'hui`;
        const rewardDetails = {
          fr: "+10 messages/vidéo · 5 maximum/jour",
          en: "+10 messages/video · 5 maximum/day",
          es: "+10 mensajes/vídeo · 5 como máximo al día",
          ar: "+10 رسائل لكل فيديو · 5 كحد أقصى يوميًا"
        };
        badge.title = `${videoText} · ${rewardDetails[lang] || rewardDetails.fr}`;
      }
    } catch {
      badge.textContent = "NIYYA";
    }
  }

  async function ensureGuest() {
    if (guestReady) return;
    try {
      await window.NiyyaAPI.getSession();
    } catch {
      await window.NiyyaAPI.createGuest();
    }
    guestReady = true;
  }

  function openChatShell(character) {
    document.querySelector(".niyya-modal")?.remove();
    const modal = element("div", "niyya-modal");
    const panel = element("section", "modal-panel chat-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", "Conversation avec " + character.name);

    const header = element("div", "chat-header");
    const titleWrap = element("div");
    titleWrap.append(element("span", "eyebrow", t("fictional")),
      element("h2", "", character.name),
      element("p", "chat-subtitle", character.tagline || ""));
    const actions = element("div", "chat-header-actions");
    const profile = element("button", "profile-link-button", t("profileTitle"));
    profile.type = "button";
    profile.disabled = true;
    const close = element("button", "modal-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", t("close"));
    actions.append(profile, close);
    header.append(titleWrap, actions);

    const messages = element("div", "chat-messages");
    messages.setAttribute("aria-live", "polite");
    messages.append(element("p", "chat-notice",
      t("demoNotice")));
    const form = element("form", "chat-composer");
    const input = element("textarea", "chat-input");
    input.rows = 1;
    input.maxLength = 12000;
    input.placeholder = t("writeMessage");
    input.setAttribute("aria-label", t("writeMessage"));
    const send = element("button", "chat-send", t("send"));
    send.type = "submit";
    form.append(input, send);

    panel.append(header, messages, form);
    modal.append(panel);
    document.body.append(modal);

    const closeModal = () => modal.remove();
    close.addEventListener("click", closeModal);
    modal.addEventListener("click", event => {
      if (event.target === modal) closeModal();
    });

    return { modal, messages, form, input, send, profile };
  }

  function addMessage(container, role, content) {
    const bubble = element("div", "chat-message " + role);
    bubble.append(element("span", "chat-role", role === "user" ? t("you") : t("niyya")));
    bubble.append(element("p", "", content));
    container.append(bubble);
    container.scrollTop = container.scrollHeight;
  }

  async function openProfile(character, trigger, resumeConversationId = null) {
    if (!character?.id) return;
    if (trigger) trigger.disabled = true;
    document.querySelector(".niyya-modal")?.remove();
    const modal = element("div", "niyya-modal");
    const panel = element("section", "modal-panel profile-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", t("profileTitle") + " " + character.name);

    const top = element("div", "profile-top");
    const art = element("div", "profile-art");
    if (character.avatar_url) {
      const image = element("img", "profile-avatar");
      image.src = character.avatar_url;
      image.alt = character.name;
      image.loading = "lazy";
      art.append(image);
    } else {
      art.append(element("span", "profile-monogram",
        (character.name || "N").slice(0, 1).toUpperCase()));
    }
    const language = window.NiyyaI18n?.getLanguage() || "fr";
    const localized = character.profile_i18n?.[language] || character.profile_i18n?.fr || {};
    const topInfo = element("div", "profile-top-info");
    topInfo.append(
      element("span", "eyebrow", localized.category || String(character.category || "original").toUpperCase()),
      element("h2", "", character.name),
      element("p", "profile-tagline", character.tagline || "")
    );
    const close = element("button", "modal-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", t("close"));
    top.append(art, topInfo, close);

    const body = element("div", "profile-body");
    const about = element("section", "profile-section");
    about.append(element("h3", "", t("profileTitle")),
      element("p", "", localized.short_bio || character.short_bio || t("noStory")));
    const story = element("section", "profile-section");
    story.append(element("h3", "", t("story")),
      element("p", "", localized.backstory || character.backstory || t("noStory")));
    const personality = element("section", "profile-section");
    personality.append(element("h3", "", t("personality")));
    const traits = Array.isArray(localized.traits) ? localized.traits : (Array.isArray(character.personality_traits) ? character.personality_traits : []);
    if (traits.length) {
      const chips = element("div", "profile-traits");
      traits.slice(0, 12).forEach(trait => chips.append(element("span", "profile-trait", trait)));
      personality.append(chips);
    } else {
      personality.append(element("p", "", character.tagline || t("noStory")));
    }
    const tags = Array.isArray(localized.tags) ? localized.tags : (Array.isArray(character.tags) ? character.tags : []);
    if (tags.length) {
      const tagSection = element("section", "profile-section");
      tagSection.append(element("h3", "", t("categories")));
      const chips = element("div", "profile-traits");
      tags.slice(0, 12).forEach(tag => chips.append(element("span", "profile-trait", tag)));
      tagSection.append(chips);
      body.append(tagSection);
    }
    const greeting = element("section", "profile-greeting");
    greeting.append(element("h3", "", t("greeting")),
      element("p", "", localized.greeting || character.greeting || t("noGreeting")));
    const creator = element("p", "profile-creator",
      t("creator") + ": " + (character.creator_pseudonym || "NIYYA.ai"));
    body.append(about, story, personality, greeting, creator);

    const footer = element("div", "profile-footer");
    const start = element("button", "chat-send profile-start", t("startChat"));
    start.type = "button";
    start.addEventListener("click", () => {
      openChat(character, start, resumeConversationId);
    });
    const favorite = element("button", "favorite-toggle profile-favorite" + (favoriteIds.has(character.id) ? " is-favorite" : ""), favoriteIds.has(character.id) ? "♥ Favori" : "♡ Ajouter aux favoris");
    favorite.type = "button";
    favorite.setAttribute("aria-pressed", favoriteIds.has(character.id) ? "true" : "false");
    favorite.addEventListener("click", () => toggleFavorite(character, favorite));
    footer.append(favorite, start);
    panel.append(top, body, footer);
    modal.append(panel);
    close.addEventListener("click", () => modal.remove());
    modal.addEventListener("click", event => { if (event.target === modal) modal.remove(); });
    document.body.append(modal);
    if (trigger) trigger.disabled = false;
  }

  async function openChat(character, trigger, existingConversationId = null) {
    if (!character.id) return;
    if (trigger) trigger.disabled = true;
    const ui = openChatShell(character);
    ui.profile.addEventListener("click", () => openProfile(character, ui.profile, activeCharacterId === character.id ? activeConversation : null));
    const status = element("p", "chat-status", t("connecting"));
    ui.messages.append(status);

    try {
      await ensureGuest();
      if (existingConversationId) {
        activeConversation = existingConversationId;
      } else {
        const created = await window.NiyyaAPI.createConversation(character.id);
        activeConversation = created.conversation.id;
      }
      activeCharacterId = character.id;
      ui.profile.disabled = false;
      const history = await window.NiyyaAPI.getMessages(activeConversation);
      status.remove();
      (history.messages || []).forEach(message =>
        addMessage(ui.messages, message.role, message.content));
      if (!history.messages?.length) {
        ui.messages.append(element("p", "chat-notice",
          t("startConversation")));
      }

      ui.form.addEventListener("submit", async event => {
        event.preventDefault();
        const text = ui.input.value.trim();
        if (!text || ui.send.disabled) return;
        ui.input.value = "";
        addMessage(ui.messages, "user", text);
        ui.send.disabled = true;
        const waiting = element("p", "chat-status", t("preparing"));
        ui.messages.append(waiting);
        try {
          const result = await window.NiyyaAPI.sendMessage(activeConversation, text, window.NiyyaI18n?.getLanguage() || "fr");
          waiting.remove();
          addMessage(ui.messages, "assistant", result.reply);
          await refreshQuota();
        } catch (error) {
          waiting.remove();
          addMessage(ui.messages, "assistant", error.message);
          if (/quota|18 ans|profil|inscription/i.test(error.message)) {
            ui.input.disabled = true;
            ui.send.disabled = true;
          }
        } finally {
          ui.send.disabled = ui.input.disabled;
          ui.input.focus();
        }
      });
      ui.input.focus();
    } catch (error) {
      status.textContent = error.message || t("genericError");
    } finally {
      if (trigger) trigger.disabled = false;
    }
  }

  searchInput.addEventListener("input", renderCharacters);
  document.getElementById("create-character").addEventListener("click", () => {
    document.querySelector(".niyya-modal")?.remove();
    const modal = element("div", "niyya-modal");
    const panel = element("section", "modal-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.append(element("button", "modal-close", "×"),
      element("span", "eyebrow", "NIYYA.ai V2"),
      element("h2", "", "Atelier de création"),
      element("p", "modal-message",
        t("createUnavailable")));
    panel.querySelector(".modal-close").addEventListener("click", () => modal.remove());
    modal.append(panel);
    modal.addEventListener("click", event => { if (event.target === modal) modal.remove(); });
    document.body.append(modal);
  });

  document.querySelectorAll(".nav-item").forEach(item => {
    item.addEventListener("click", async event => {
      event.preventDefault();
      document.querySelectorAll(".nav-item").forEach(link =>
        link.classList.toggle("selected", link === item));
      const target = (item.getAttribute("href") || "").replace("#", "");
      if (target === "favorites") {
        activeView = "favorites";
        activeCategory = "all";
        try {
          await ensureGuest();
          const data = await window.NiyyaAPI.getFavorites();
          favoriteIds = new Set((data.favorites || []).map(character => character.id));
        } catch (error) {
          showToast(error.message || "Impossible de charger les favoris.");
        }
        renderCategories();
        renderCharacters();
        document.getElementById("discover")?.scrollIntoView({ behavior: "smooth" });
      } else if (target === "discover" || target === "") {
        activeView = "discover";
        renderCategories();
        renderCharacters();
        document.getElementById("discover")?.scrollIntoView({ behavior: "smooth" });
      } else if (target === "create") {
        document.getElementById("create-character")?.click();
      } else if (target === "profile") {
        showToast("Le profil utilisateur sera activé avec l'inscription complète.");
      }
    });
  });

  window.NiyyaAPI.getCharacters()
    .then(data => {
      characters = Array.isArray(data.characters) ? data.characters : [];
      renderCategories();
      renderCharacters();
    })
    .catch(error => {
      grid.replaceChildren(element("p", "empty-state",
        error.message || "Impossible de charger les personnages."));
    });

  console.log("NIYYA.ai V2 — Interface initialisée.");
});
