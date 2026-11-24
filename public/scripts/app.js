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

  // Keep overlays aligned with the visible iOS Safari viewport when the keyboard opens.
  function syncVisibleViewport() {
    const viewport = window.visualViewport;
    const height = viewport?.height || window.innerHeight;
    const top = viewport?.offsetTop || 0;
    document.documentElement.style.setProperty("--niyya-viewport-height", height + "px");
    document.documentElement.style.setProperty("--niyya-viewport-top", top + "px");
  }
  syncVisibleViewport();
  window.addEventListener("resize", syncVisibleViewport, { passive: true });
  window.visualViewport?.addEventListener("resize", syncVisibleViewport, { passive: true });
  window.visualViewport?.addEventListener("scroll", syncVisibleViewport, { passive: true });

  function renderCharacters() {
    const term = searchInput.value.trim().toLocaleLowerCase();
    grid.replaceChildren();
    grid.setAttribute("aria-busy", "false");

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
      favorite.dataset.favoriteId = character.id;
      favorite.setAttribute("aria-label", favoriteIds.has(character.id) ? "Retirer des favoris" : "Ajouter aux favoris");
      favorite.setAttribute("aria-pressed", favoriteIds.has(character.id) ? "true" : "false");
      favorite.addEventListener("click", () => toggleFavorite(character, favorite));
      card.append(art, info, favorite);
      grid.append(card);
    });
  }

  function paintFavorite(characterId, saved) {
    document.querySelectorAll('[data-favorite-id="' + characterId + '"]').forEach(control => {
      control.classList.toggle("is-favorite", saved);
      control.setAttribute("aria-pressed", saved ? "true" : "false");
      if (control.classList.contains("profile-favorite")) {
        control.textContent = saved ? "♥ Favori" : "♡ Ajouter aux favoris";
      } else {
        control.textContent = saved ? "♥" : "♡";
        control.setAttribute("aria-label", saved ? "Retirer des favoris" : "Ajouter aux favoris");
      }
    });
    if (activeView === "favorites" && !saved) {
      document.querySelectorAll('.character-card [data-favorite-id="' + characterId + '"]')
        .forEach(control => control.closest(".character-card")?.remove());
      if (!grid.querySelector(".character-card")) {
        grid.append(element("p", "empty-state", t("noCharacters")));
      }
    }
  }

  async function toggleFavorite(character, button) {
    if (!character?.id || button?.dataset.busy === "true") return;
    const wasSaved = favoriteIds.has(character.id);
    const saved = !wasSaved;
    favoriteIds[saved ? "add" : "delete"](character.id);
    document.querySelectorAll('[data-favorite-id="' + character.id + '"]')
      .forEach(control => { control.dataset.busy = "true"; control.disabled = true; });
    paintFavorite(character.id, saved);
    try {
      await ensureGuest();
      if (saved) await window.NiyyaAPI.addFavorite(character.id);
      else await window.NiyyaAPI.removeFavorite(character.id);
    } catch (error) {
      favoriteIds[wasSaved ? "add" : "delete"](character.id);
      paintFavorite(character.id, wasSaved);
      showToast(error.message || t("genericError"));
    } finally {
      document.querySelectorAll('[data-favorite-id="' + character.id + '"]')
        .forEach(control => { control.dataset.busy = "false"; control.disabled = false; });
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
        category === "adventure" ? "categoryAdventure" :
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

  async function openConversationHistory() {
    document.querySelector(".niyya-modal")?.remove();
    const modal = element("div", "niyya-modal messages-fullscreen-modal");
    const panel = element("section", "modal-panel history-panel messages-fullscreen-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", "Mes conversations");
    const header = element("div", "history-heading");
    header.append(element("span", "eyebrow", "NIYYA.ai"),
      element("h2", "", t("history")));
    const close = element("button", "modal-close", "←");
    close.type = "button";
    close.setAttribute("aria-label", t("close"));
    header.append(close);
    const list = element("div", "history-list");
    list.append(element("p", "chat-status", t("historyLoading")));
    panel.append(header, list);
    modal.append(panel);
    document.body.append(modal);
    const dismiss = () => modal.remove();
    close.addEventListener("click", dismiss);
    modal.addEventListener("click", event => { if (event.target === modal) dismiss(); });

    try {
      await ensureGuest();
      const data = await window.NiyyaAPI.getConversations();
      list.replaceChildren();
      const conversations = Array.isArray(data.conversations) ? data.conversations : [];
      if (!conversations.length) {
        list.append(element("p", "empty-state", t("historyEmpty")));
        return;
      }
      conversations.forEach(conversation => {
        const row = element("button", "history-row");
        row.type = "button";
        const avatar = element("span", "history-avatar",
          (conversation.character_name || "N").slice(0, 1).toUpperCase());
        const details = element("span", "history-details");
        details.append(
          element("strong", "", conversation.character_name || "Personnage"),
          element("small", "", conversation.title || "Conversation")
        );
        const date = conversation.updated_at
          ? new Date(conversation.updated_at).toLocaleDateString(
              window.NiyyaI18n?.getLanguage() || "fr",
              { day: "numeric", month: "short" }
            )
          : "";
        row.append(avatar, details, element("span", "history-date", date));
        row.addEventListener("click", async () => {
          row.disabled = true;
          try {
            const result = await window.NiyyaAPI.getCharacter(conversation.character_id);
            if (!result.character) throw new Error("Personnage introuvable.");
            dismiss();
            openProfile(result.character, null, conversation.id);
          } catch (error) {
            row.disabled = false;
            showToast(error.message || "Impossible d'ouvrir cette conversation.");
          }
        });
        list.append(row);
      });
    } catch (error) {
      list.replaceChildren(element("p", "empty-state", error.message || t("historyError")));
    }
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
          fr: `${data.remaining} messages restants`,
          en: `${data.remaining} messages remaining`,
          es: `${data.remaining} mensajes restantes`,
          ar: `${data.remaining} رسالة متبقية`
        };
        badge.textContent = String(data.remaining);
        badge.setAttribute("aria-label", labels[lang] || labels.fr);
        badge.title = labels[lang] || labels.fr;
        const rewardNotice = {
          fr: "Les récompenses publicitaires ne sont pas encore disponibles.",
          en: "Rewarded ads are not available yet.",
          es: "Los anuncios con recompensa todavía no están disponibles.",
          ar: "الإعلانات ذات المكافآت غير متاحة بعد."
        };
        badge.title = rewardNotice[lang] || rewardNotice.fr;
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
    const modal = element("div", "niyya-modal chat-fullscreen-modal");
    const panel = element("section", "modal-panel chat-panel chat-fullscreen-panel");
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
    const modal = element("div", "niyya-modal profile-fullscreen-modal");
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
    favorite.dataset.favoriteId = character.id;
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
      const onboarding = await window.NiyyaAPI.getQuota();
      if (!onboarding.onboarded) {
        status.textContent = "Complète ton profil pour commencer à discuter.";
        ui.input.disabled = true;
        ui.send.disabled = true;
        if (window.NiyyaOnboarding?.open) {
          window.NiyyaOnboarding.open({
            onComplete: () => openChat(character, null, existingConversationId)
          });
        }
        return;
      }
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

  document.getElementById("conversations-button")?.addEventListener("click", openConversationHistory);
  document.getElementById("profile-button")?.addEventListener("click", openAccount);

  searchInput.addEventListener("input", renderCharacters);

  async function openAccount() {
    document.querySelector(".niyya-modal")?.remove();
    const modal = element("div", "niyya-modal account-modal");
    const panel = element("section", "modal-panel account-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "account-title");
    const header = element("div", "account-heading");
    const heading = element("div");
    heading.append(element("span", "eyebrow", "NIYYA.ai · COMPTE"));
    const title = element("h2", "", "Ton compte");
    title.id = "account-title";
    heading.append(title);
    const close = element("button", "modal-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Fermer");
    header.append(heading, close);
    const content = element("div", "account-content");
    content.append(element("p", "chat-status", "Chargement du compte…"));
    panel.append(header, content);
    modal.append(panel);
    document.body.append(modal);
    const dismiss = () => modal.remove();
    close.addEventListener("click", dismiss);
    modal.addEventListener("click", event => { if (event.target === modal) dismiss(); });

    try {
      await ensureGuest();
      const session = await window.NiyyaAPI.getSession();
      const user = session.user || {};
      content.replaceChildren();
      if (!user.isGuest && user.email) {
        content.append(
          element("p", "account-success", "Ton compte est enregistré et synchronisable sur tes autres appareils."),
          element("span", "account-label", "Adresse e-mail"),
          element("p", "account-email", user.email)
        );
        const logout = element("button", "account-secondary", "Se déconnecter");
        logout.type = "button";
        logout.addEventListener("click", async () => {
          logout.disabled = true;
          try {
            await window.NiyyaAPI.logout();
            guestReady = false;
            window.location.reload();
          } catch (error) {
            logout.disabled = false;
            showToast(error.message || "Impossible de se déconnecter.");
          }
        });
        content.append(logout);
        return;
      }

      content.append(element("p", "account-intro",
        "Crée un compte pour retrouver tes conversations et tes favoris après un changement de téléphone. Si tu as déjà un compte, connecte-toi."));
      const tabs = element("div", "account-tabs");
      const registerTab = element("button", "account-tab active", "Créer un compte");
      const loginTab = element("button", "account-tab", "Se connecter");
      registerTab.type = loginTab.type = "button";
      tabs.append(registerTab, loginTab);
      const form = element("form", "account-form");
      const emailLabel = element("label", "account-field");
      emailLabel.append(element("span", "", "Adresse e-mail"));
      const email = element("input", "account-input");
      email.type = "email";
      email.name = "email";
      email.required = true;
      email.maxLength = 254;
      email.autocomplete = "email";
      email.placeholder = "exemple@email.com";
      emailLabel.append(email);
      const passwordLabel = element("label", "account-field");
      passwordLabel.append(element("span", "", "Mot de passe"));
      const password = element("input", "account-input");
      password.type = "password";
      password.name = "password";
      password.required = true;
      password.minLength = 10;
      password.maxLength = 128;
      password.autocomplete = "new-password";
      password.placeholder = "10 caractères minimum";
      passwordLabel.append(password);
      const confirmLabel = element("label", "account-field");
      confirmLabel.append(element("span", "", "Confirmer le mot de passe"));
      const confirm = element("input", "account-input");
      confirm.type = "password";
      confirm.name = "confirmPassword";
      confirm.required = true;
      confirm.minLength = 10;
      confirm.maxLength = 128;
      confirm.autocomplete = "new-password";
      confirm.placeholder = "Répète ton mot de passe";
      confirmLabel.append(confirm);
      const note = element("p", "account-note",
        "Ton compte invité actuel sera converti : tes conversations et favoris seront conservés. Vérifie bien ton adresse e-mail et garde ton mot de passe : la confirmation d’e-mail et la récupération du mot de passe ne sont pas encore activées.");
      const status = element("p", "chat-status", "");
      status.setAttribute("role", "status");
      const submit = element("button", "chat-send account-submit", "Créer mon compte");
      submit.type = "submit";
      form.append(emailLabel, passwordLabel, confirmLabel, note, status, submit);
      content.append(tabs, form);

      let mode = "register";
      const setMode = next => {
        mode = next;
        const registering = mode === "register";
        registerTab.classList.toggle("active", registering);
        loginTab.classList.toggle("active", !registering);
        confirmLabel.hidden = !registering;
        note.hidden = !registering;
        password.minLength = registering ? 10 : 1;
        password.autocomplete = registering ? "new-password" : "current-password";
        confirm.required = registering;
        submit.textContent = registering ? "Créer mon compte" : "Se connecter";
        status.textContent = "";
      };
      registerTab.addEventListener("click", () => setMode("register"));
      loginTab.addEventListener("click", () => setMode("login"));
      form.addEventListener("submit", async event => {
        event.preventDefault();
        if (submit.disabled) return;
        if (mode === "register" && password.value !== confirm.value) {
          status.textContent = "Les deux mots de passe ne correspondent pas.";
          return;
        }
        submit.disabled = true;
        status.textContent = mode === "register" ? "Création du compte…" : "Connexion…";
        try {
          if (mode === "register") {
            await window.NiyyaAPI.registerAccount({ email: email.value, password: password.value });
          } else {
            await window.NiyyaAPI.login({ email: email.value, password: password.value });
          }
          window.location.reload();
        } catch (error) {
          status.textContent = error.message || "Une erreur est survenue.";
          submit.disabled = false;
        }
      });
      setMode("register");
    } catch (error) {
      content.replaceChildren(element("p", "chat-status", error.message || "Impossible de charger ton compte."));
    }
  }

  async function openMyCharacters() {
    document.querySelector(".niyya-modal")?.remove();
    const modal = element("div", "niyya-modal creator-fullscreen-modal");
    const panel = element("section", "modal-panel creator-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", "Mes créations");
    const header = element("div", "creator-heading");
    const titleWrap = element("div");
    titleWrap.append(
      element("span", "eyebrow", "NIYYA.ai · ATELIER"),
      element("h2", "", "Mes créations"),
      element("p", "chat-subtitle", "Retrouve tes brouillons et le statut de leurs demandes de vérification.")
    );
    const close = element("button", "modal-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", t("close"));
    header.append(titleWrap, close);
    const content = element("div", "creator-characters-list");
    content.append(element("p", "chat-status", "Chargement de tes créations…"));
    panel.append(header, content);
    modal.append(panel);
    document.body.append(modal);
    const dismiss = () => modal.remove();
    close.addEventListener("click", dismiss);
    modal.addEventListener("click", event => { if (event.target === modal) dismiss(); });

    try {
      await ensureGuest();
      const data = await window.NiyyaAPI.getMyCharacters();
      const characters = Array.isArray(data.characters) ? data.characters : [];
      content.replaceChildren();
      if (!characters.length) {
        content.append(element("p", "empty-state", "Tu n'as pas encore créé de personnage."));
        return;
      }
      characters.forEach(character => {
        const row = element("article", "creator-character-row");
        const details = element("div", "creator-character-details");
        details.append(
          element("h3", "", character.name || "Personnage sans nom"),
          element("p", "", character.tagline || "Aucune description courte")
        );
        const statusLabels = {
          none: "Brouillon privé",
          pending: "En vérification",
          approved: "Approuvé",
          rejected: "À revoir"
        };
        const status = element("span", "creator-character-status", statusLabels[character.publication_status] || "Statut inconnu");
        row.append(details, status);
        content.append(row);
      });
    } catch (error) {
      content.replaceChildren(element("p", "empty-state", error.message || "Impossible de charger tes créations."));
    }
  }

async function openCreator() {
    document.querySelector(".niyya-modal")?.remove();
    const modal = element("div", "niyya-modal creator-fullscreen-modal");
    const panel = element("section", "modal-panel creator-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", "Atelier de création de personnage");
    const header = element("div", "creator-heading");
    const titleWrap = element("div");
    titleWrap.append(element("span", "eyebrow", "NIYYA.ai · ATELIER"),
      element("h2", "", "Donne vie à ton personnage"),
      element("p", "chat-subtitle", "Crée un personnage fictif. Il restera privé jusqu'à sa validation."));
    const close = element("button", "modal-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", t("close"));
    const myCharacters = element("button", "profile-link-button", "Mes créations");
    myCharacters.type = "button";
    myCharacters.addEventListener("click", openMyCharacters);
    header.append(titleWrap, myCharacters, close);
    const form = element("form", "creator-form");
    const fields = [
      ["name", "Nom du personnage", "Ex. : Mira", 40, true, "input"],
      ["tagline", "Phrase de présentation", "En une phrase, qui est ce personnage ?", 100, true, "input"],
      ["shortBio", "Présentation", "Décris brièvement son caractère et ce qui le rend intéressant…", 500, true, "textarea"],
      ["backstory", "Histoire du personnage", "Son passé, ses objectifs et son univers…", 3000, true, "textarea"],
      ["personalityPrompt", "Personnalité et façon de parler", "Décris sa personnalité, ses valeurs et son style de conversation…", 4000, true, "textarea"],
      ["scenario", "Contexte de départ", "Dans quel univers ou quelle situation commence l'histoire ?", 1000, false, "textarea"],
      ["greeting", "Premier message", "Que dit le personnage quand une conversation commence ?", 800, true, "textarea"],
      ["traits", "Traits de personnalité", "Curieux, drôle, réfléchi (séparés par des virgules)", 256, false, "input"],
      ["tags", "Mots-clés", "Aventure, mystère, fantasy… (séparés par des virgules)", 192, false, "input"]
    ];
    const controls = {};
    fields.forEach(([key, labelText, placeholder, max, required, kind]) => {
      const group = element("label", "creator-field");
      group.append(element("span", "creator-label", labelText + (required ? " *" : "")));
      const control = element(kind === "textarea" ? "textarea" : "input", "creator-control");
      control.name = key;
      control.placeholder = placeholder;
      control.maxLength = max;
      control.required = required;
      if (kind === "textarea") control.rows = key === "personalityPrompt" || key === "backstory" ? 4 : 3;
      controls[key] = control;
      group.append(control);
      form.append(group);
    });
    const categoryGroup = element("label", "creator-field");
    categoryGroup.append(element("span", "creator-label", "Catégorie"));
    const category = element("select", "creator-control");
    category.name = "category";
    [["original","Original"],["anime","Anime"],["fantasy","Fantasy"],["mystery","Mystère"],["comedy","Humour"],["friendship","Amitié"],["adventure","Aventure"],["science-fiction","Science-fiction"]].forEach(([value,label]) => {
      const option = element("option", "", label);
      option.value = value;
      category.append(option);
    });
    categoryGroup.append(category);
    form.append(categoryGroup);
    const note = element("p", "creator-note", "Conseil : n'inclus pas de coordonnées personnelles, de contenu sexuel, de violence graphique ni de personnages présentés comme des personnes réelles.");
    const status = element("p", "chat-status", "");
    const submit = element("button", "chat-send creator-submit", "Enregistrer le brouillon");
    submit.type = "submit";
    form.append(note, status, submit);
    panel.append(header, form);
    modal.append(panel);
    document.body.append(modal);
    const dismiss = () => modal.remove();
    close.addEventListener("click", dismiss);
    modal.addEventListener("click", event => { if (event.target === modal) dismiss(); });

    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (submit.disabled) return;
      submit.disabled = true;
      status.textContent = "Vérification et enregistrement…";
      const payload = {
        name: controls.name.value,
        tagline: controls.tagline.value,
        shortBio: controls.shortBio.value,
        backstory: controls.backstory.value,
        personalityPrompt: controls.personalityPrompt.value,
        scenario: controls.scenario.value,
        greeting: controls.greeting.value,
        category: category.value,
        traits: controls.traits.value.split(",").map(value => value.trim()).filter(Boolean),
        tags: controls.tags.value.split(",").map(value => value.trim()).filter(Boolean)
      };
      try {
        await ensureGuest();
        const access = await window.NiyyaAPI.getQuota();
        if (!access.onboarded) {
          throw new Error("L'atelier est accessible après le parcours d'inscription autorisé de NIYYA.");
        }
        const result = await window.NiyyaAPI.createCharacter(payload);
        form.replaceChildren(
          element("span", "eyebrow", "BROUILLON ENREGISTRÉ"),
          element("h3", "", result.character.name),
          element("p", "creator-note", "Ton personnage est privé. Tu peux demander sa vérification avant de le rendre visible dans Explorer.")
        );
        const review = element("button", "chat-send creator-submit", "Envoyer en vérification");
        review.type = "button";
        const reviewStatus = element("p", "chat-status", "");
        form.append(review, reviewStatus);
        review.addEventListener("click", async () => {
          review.disabled = true;
          reviewStatus.textContent = "Envoi de la demande…";
          try {
            await window.NiyyaAPI.submitCharacter(result.character.id);
            reviewStatus.textContent = "Demande envoyée. Le personnage restera privé pendant sa vérification.";
            review.textContent = "Demande envoyée";
          } catch (error) {
            review.disabled = false;
            reviewStatus.textContent = error.message || "Impossible d'envoyer la demande.";
          }
        });
      } catch (error) {
        status.textContent = error.message || "Impossible d'enregistrer ce personnage.";
        submit.disabled = false;
      }
    });
  }

  document.getElementById("create-character").addEventListener("click", openCreator);

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
      } else if (target === "messages") {
        openConversationHistory();
      } else if (target === "profile") {
        openAccount();
      }
    });
  });

  document.addEventListener("niyya:language-changed", () => {
    renderCategories();
    renderCharacters();
  });

  window.NiyyaAPI.getCharacters()
    .then(async data => {
      characters = Array.isArray(data.characters) ? data.characters : [];
      try {
        await window.NiyyaAPI.getSession();
        const favorites = await window.NiyyaAPI.getFavorites();
        favoriteIds = new Set((favorites.favorites || []).map(character => character.id));
      } catch {
        // Les visiteurs non connectés découvrent les personnages sans favoris chargés.
      }
      renderCategories();
      renderCharacters();
    })
    .catch(error => {
      grid.setAttribute("aria-busy", "false");
      grid.replaceChildren(element("p", "empty-state",
        error.message || "Impossible de charger les personnages."));
    });

  console.log("NIYYA.ai V2 — Interface initialisée.");
});
