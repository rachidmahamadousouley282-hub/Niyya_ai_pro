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

  // Immobilise l'accueil derrière les fenêtres, notamment sur Safari iOS.
  let modalPageLocked = false;
  let modalScrollY = 0;
  let previousBodyStyle = null;

  function lockPageBehindModal() {
    if (!modalPageLocked) {
      modalScrollY = window.scrollY || window.pageYOffset || 0;
      previousBodyStyle = document.body.getAttribute("style");
      document.documentElement.classList.add("niyya-modal-open");
      document.body.classList.add("niyya-modal-open");
      document.body.style.position = "fixed";
      document.body.style.top = "-" + modalScrollY + "px";
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.width = "100%";
      document.body.style.overflow = "hidden";
      const shell = document.querySelector(".app-shell");
      if (shell) {
        shell.setAttribute("aria-hidden", "true");
        shell.inert = true;
      }
      modalPageLocked = true;
    }
    syncVisibleViewport();
  }

  function unlockPageAfterModal() {
    if (!modalPageLocked) return;
    document.documentElement.classList.remove("niyya-modal-open");
    document.body.classList.remove("niyya-modal-open");
    if (previousBodyStyle === null) document.body.removeAttribute("style");
    else document.body.setAttribute("style", previousBodyStyle);
    const shell = document.querySelector(".app-shell");
    if (shell) {
      shell.removeAttribute("aria-hidden");
      shell.inert = false;
    }
    modalPageLocked = false;
    window.scrollTo(0, modalScrollY);
    previousBodyStyle = null;
  }

  const modalObserver = new MutationObserver(() => {
    if (document.querySelector(".niyya-modal")) lockPageBehindModal();
    else unlockPageAfterModal();
  });
  modalObserver.observe(document.body, { childList: true });

  function setActiveNav(href) {
    document.querySelectorAll(".bottom-nav .nav-item").forEach(link => {
      const selected = link.getAttribute("href") === href;
      link.classList.toggle("selected", selected);
      if (selected) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }

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
      const empty = element("div", "empty-state discovery-empty");
      empty.append(element("p", "", t("noCharacters")));
      const reset = element("button", "discovery-reset", t("resetDiscovery"));
      reset.type = "button";
      reset.addEventListener("click", () => {
        searchInput.value = "";
        activeCategory = "all";
        renderCategories();
        renderCharacters();
        searchInput.focus();
      });
      empty.append(reset);
      grid.append(empty);
      return;
    }

    filtered.forEach((character, index) => {
      const card = element("article", "character-card");
      card.dataset.category = character.category || "all";
      const art = element("div", "character-art art-" + ["one","two","three","four"][index % 4]);
      const isOfficialCharacter = character.creator_pseudonym === "NIYYA.ai";
      const label = element("span", "art-label",
        isOfficialCharacter ? "NIYYA ORIGINAL" : t("communityArtLabel"));
      art.append(label);
      if (character.avatar_url) {
        const portrait = element("img", "character-portrait");
        portrait.src = character.avatar_url;
        portrait.alt = character.name || "Portrait du personnage";
        portrait.loading = "lazy";
        portrait.decoding = "async";
        portrait.addEventListener("error", () => {
          portrait.remove();
          art.append(element("span", "character-symbol", (character.name || "N").slice(0,1).toUpperCase()));
        }, { once: true });
        art.append(portrait);
      } else {
        art.append(element("span", "character-symbol", (character.name || "N").slice(0,1).toUpperCase()));
      }

      const info = element("div", "character-info");
      info.append(
        element("h3", "", character.name),
        element("p", "", character.tagline || "Un personnage à découvrir."),
        element("span", "character-tag",
          isOfficialCharacter ? t("officialTag") : t("communityCharacterTag"))
      );
      const button = element("button", "chat-button", t("discoverButton"));
      button.type = "button";
      button.addEventListener("click", () => openProfile(character, button));
      info.append(button);
      const favorite = element("button", "favorite-toggle" + (favoriteIds.has(character.id) ? " is-favorite" : ""), (favoriteIds.has(character.id) ? "♥" : "♡") + " " + String(character.like_count || 0));
      favorite.type = "button";
      favorite.dataset.favoriteId = character.id;
      favorite.dataset.likeCount = String(character.like_count || 0);
      favorite.setAttribute("aria-label", favoriteIds.has(character.id) ? "Retirer ton J'aime" : "J'aime ce personnage");
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
      const count = Number(control.dataset.likeCount || 0);
      if (control.classList.contains("profile-favorite")) {
        control.textContent = (saved ? "♥ J'aime" : "♡ J'aime") + (count ? " · " + count : "");
      } else {
        control.textContent = (saved ? "♥" : "♡") + " " + count;
        control.setAttribute("aria-label", saved ? "Retirer ton J'aime" : "J'aime ce personnage");
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
      const result = saved
        ? await window.NiyyaAPI.addFavorite(character.id)
        : await window.NiyyaAPI.removeFavorite(character.id);
      if (result.likeCount !== undefined) {
        document.querySelectorAll('[data-favorite-id="' + character.id + '"]')
          .forEach(control => { control.dataset.likeCount = String(result.likeCount); });
        characters.forEach(item => {
          if (item.id === character.id) item.like_count = result.likeCount;
        });
        paintFavorite(character.id, saved);
      }
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
        category === "anime" ? "categoryAnime" :
        category === "fantasy" ? "categoryFantasy" :
        category === "science-fiction" ? "categoryScienceFiction" :
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

  async function renderActiveCompanions() {
    const section = document.getElementById("active-companions");
    const rail = document.getElementById("companion-rail");
    if (!section || !rail) return;
    try {
      await ensureGuest();
      const data = await window.NiyyaAPI.getConversations();
      const conversations = Array.isArray(data.conversations) ? data.conversations : [];
      const recent = conversations
        .filter(item => item.character_id && item.character_name)
        .slice(0, 12);
      rail.replaceChildren();
      if (!recent.length) {
        section.hidden = true;
        return;
      }
      recent.forEach(conversation => {
        const character = characters.find(item => item.id === conversation.character_id) || {
          id: conversation.character_id,
          name: conversation.character_name,
          avatar_url: conversation.character_avatar || null
        };
        const button = element("button", "companion-chip");
        button.type = "button";
        button.setAttribute("aria-label", "Reprendre la discussion avec " + character.name);
        const portrait = element("span", "companion-portrait");
        if (character.avatar_url) {
          const image = element("img", "");
          image.src = character.avatar_url;
          image.alt = "";
          image.loading = "lazy";
          image.addEventListener("error", () => {
            image.remove();
            portrait.append(element("span", "", (character.name || "N").slice(0, 1).toUpperCase()));
          }, { once: true });
          portrait.append(image);
        } else {
          portrait.append(element("span", "", (character.name || "N").slice(0, 1).toUpperCase()));
        }
        button.append(portrait, element("span", "companion-name", character.name));
        button.addEventListener("click", async () => {
          button.disabled = true;
          try {
            let fullCharacter = characters.find(item => item.id === character.id);
            if (!fullCharacter) {
              const result = await window.NiyyaAPI.getCharacter(character.id);
              fullCharacter = result.character;
            }
            if (!fullCharacter) throw new Error("Personnage introuvable.");
            await openChat(fullCharacter, button);
          } catch (error) {
            showToast(error.message || "Impossible de reprendre cette discussion.");
          } finally {
            button.disabled = false;
          }
        });
        rail.append(button);
      });
      section.hidden = false;
    } catch {
      section.hidden = true;
    }
  }

  async function openConversationHistory() {
    setActiveNav("#messages");
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
    const dismiss = () => {
      modal.remove();
      setActiveNav("#");
    };
    close.addEventListener("click", dismiss);
    modal.addEventListener("click", event => { if (event.target === modal) dismiss(); });

    try {
      await ensureGuest();
      const data = await window.NiyyaAPI.getConversations();
      list.replaceChildren();
      const conversations = Array.isArray(data.conversations) ? data.conversations : [];
      if (!conversations.length) {
        list.append(element("p", "empty-state", t("historyEmpty")));
      }

      // Reserved, non-intrusive sponsor placement. It stays hidden until a
      // verified ad provider supplies an approved creative and consent state.
      const adSlot = element("aside", "history-ad-slot");
      adSlot.dataset.adSlot = "history";
      adSlot.hidden = true;
      adSlot.setAttribute("aria-hidden", "true");
      adSlot.setAttribute("aria-label", "Espace sponsorisé");
      list.append(adSlot);

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
            // Open the permanent character thread; legacy dated threads are
            // consolidated by the conversation endpoint when it is resumed.
            openChat(result.character, null);
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
        badge.textContent = lang === "en" ? "VIP · Extended access" :
          lang === "es" ? "VIP · Acceso ampliado" :
          lang === "ar" ? "VIP · وصول موسّع" : "VIP · Accès étendu";
        badge.title = lang === "en" ? "VIP access is active; subject to fair-use protections." :
          lang === "es" ? "El acceso VIP está activo, sujeto a reglas de uso razonable." :
          lang === "ar" ? "اشتراك VIP نشط وفق قواعد الاستخدام العادل." : "Accès VIP actif, soumis aux règles d’utilisation raisonnable.";
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
      }
    } catch {
      badge.textContent = "—";
      badge.setAttribute("aria-label", "Connecte-toi pour voir ton quota.");
      badge.title = "Connecte-toi pour voir ton quota.";
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
    setActiveNav("#messages");
    document.querySelector(".niyya-modal")?.remove();
    const modal = element("div", "niyya-modal chat-fullscreen-modal");
    const panel = element("section", "modal-panel chat-panel chat-fullscreen-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", "Conversation avec " + character.name);

    const header = element("div", "chat-header");
    const titleWrap = element("div", "chat-title-wrap");
    const avatar = element("div", "chat-header-avatar");
    avatar.setAttribute("aria-hidden", "true");
    const fallbackAvatar = () => {
      avatar.replaceChildren(element("span", "chat-header-avatar-fallback",
        (character.name || "N").slice(0, 1).toUpperCase()));
    };
    if (character.avatar_url) {
      const avatarImage = element("img", "chat-header-avatar-image");
      avatarImage.src = character.avatar_url;
      avatarImage.alt = "";
      avatarImage.loading = "lazy";
      avatarImage.addEventListener("error", fallbackAvatar, { once: true });
      avatar.append(avatarImage);
    } else {
      fallbackAvatar();
    }
    const titleCopy = element("div", "chat-title-copy");
    titleCopy.append(element("span", "eyebrow", t("fictional")),
      element("h2", "", character.name),
      element("p", "chat-subtitle", character.tagline || ""));
    titleWrap.append(avatar, titleCopy);
    const actions = element("div", "chat-header-actions");
    const profile = element("button", "profile-link-button", t("profileTitle"));
    profile.type = "button";
    profile.disabled = false;
    profile.addEventListener("click", () => openProfile(character, profile));
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

    const closeModal = () => {
      modal.remove();
      setActiveNav("#");
    };
    close.addEventListener("click", closeModal);

    return { modal, messages, form, input, send, profile };
  }

  function addMessage(container, role, content, characterName = "NIYYA") {
    const bubble = element("div", "chat-message " + role);
    const speaker = role === "user" ? t("you") : (characterName || "Personnage");
    bubble.append(element("span", "chat-role", speaker));
    bubble.append(element("p", "", content));
    container.append(bubble);
    container.scrollTop = container.scrollHeight;
  }

  // Affiche la réponse progressivement, mot par mot, une fois la réponse
  // complète reçue et contrôlée par le serveur.
  async function addMessageTyping(container, content, characterName = "NIYYA") {
    const bubble = element("div", "chat-message assistant is-typing");
    const speaker = characterName || "Personnage";
    const paragraph = element("p", "");
    bubble.append(element("span", "chat-role", speaker), paragraph);
    container.append(bubble);

    const words = String(content || "").match(/\S+\s*/g) || [String(content || "")];
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const delay = words.length > 70 ? 16 : 28;
    let visibleText = "";

    for (const word of words) {
      if (!bubble.isConnected) return;
      visibleText += word;
      paragraph.textContent = visibleText;
      container.scrollTop = container.scrollHeight;
      if (!reducedMotion) {
        await new Promise(resolve => window.setTimeout(resolve, delay));
      }
    }
    bubble.classList.remove("is-typing");
  }

  async function openProfile(character, trigger, resumeConversationId = null) {
    if (!character?.id) return;
    if (trigger) trigger.disabled = true;
    try {
      await ensureGuest();
      await window.NiyyaAPI.recordCharacterView(character.id);
    } catch {
      // L'ouverture de la fiche reste possible si la mesure statistique échoue.
    }
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
    const favorite = element("button", "favorite-toggle profile-favorite" + (favoriteIds.has(character.id) ? " is-favorite" : ""), (favoriteIds.has(character.id) ? "♥ J'aime" : "♡ J'aime") + (character.like_count ? " · " + character.like_count : ""));
    favorite.type = "button";
    favorite.dataset.favoriteId = character.id;
    favorite.dataset.likeCount = String(character.like_count || 0);
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
    const characterId = character && String(character.id || "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(characterId)) {
      throw new Error("Identifiant de personnage invalide. Recharge « Mes créations » puis réessaie.");
    }
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
        addMessage(ui.messages, message.role, message.content, character.name));
      if (!history.messages?.length) {
        const greeting = character.greeting ||
          "Une nouvelle histoire commence ici. Par quoi veux-tu commencer ?";
        addMessage(ui.messages, "assistant", greeting, character.name);

        const startersBySlug = {
          clara: [
            "Lance-moi un défi vraiment inattendu.",
            "Raconte-moi l'idée la plus folle que tu aies eue.",
            "Inventons une histoire pleine de rebondissements."
          ],
          kenza: [
            "Quel indice as-tu découvert ?",
            "Propose-moi une énigme à résoudre.",
            "Je veux comprendre ce que tu as trouvé."
          ],
          lea: [
            "J'ai une idée dont j'aimerais te parler.",
            "Aide-moi à imaginer un projet original.",
            "Inventons quelque chose ensemble."
          ],
          kael: [
            "Examinons cette mystérieuse boussole.",
            "Je choisis la tour noyée.",
            "Montre-moi les indices de la carte."
          ]
        };
        const starters = startersBySlug[String(character.slug || "").toLowerCase()] || [
          "Raconte-moi quelque chose d'inattendu.",
          "Propose-moi un défi.",
          "Inventons une histoire ensemble."
        ];
        const suggestions = element("div", "chat-starters");
        suggestions.setAttribute("aria-label", "Idées pour commencer la conversation");
        starters.forEach(prompt => {
          const chip = element("button", "chat-starter", prompt);
          chip.type = "button";
          chip.addEventListener("click", () => {
            ui.input.value = prompt;
            ui.input.focus();
          });
          suggestions.append(chip);
        });
        ui.messages.append(suggestions);
      }

      ui.form.addEventListener("submit", async event => {
        event.preventDefault();
        const text = ui.input.value.trim();
        if (!text || ui.send.disabled) return;
        ui.input.value = "";
        ui.messages.querySelector(".chat-starters")?.remove();
        addMessage(ui.messages, "user", text, character.name);
        ui.send.disabled = true;
        const showThinking = localStorage.getItem("niyya-thinking-pause") !== "0";
        const waiting = showThinking ? element("p", "chat-status", t("preparing")) : null;
        if (waiting) ui.messages.append(waiting);
        try {
          const result = await window.NiyyaAPI.sendMessage(activeConversation, text, window.NiyyaI18n?.getLanguage() || "fr");
          waiting?.remove();
          await addMessageTyping(ui.messages, result.reply, character.name);
          await refreshQuota();
        } catch (error) {
          waiting?.remove();
          addMessage(ui.messages, "assistant", error.message, character.name);
          if (/quota/i.test(error.message || "")) {
            await refreshQuota();
          }
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

  document.getElementById("vip-offer-button")?.addEventListener("click", openVipOffers);
  document.getElementById("vip-home-button")?.addEventListener("click", openVipOffers);
  document.getElementById("conversations-button")?.addEventListener("click", openConversationHistory);
  document.getElementById("profile-button")?.addEventListener("click", openAccount);

  searchInput.addEventListener("input", renderCharacters);



  function openVipOffers() {
    const modal = element("div", "niyya-modal niyya-vip-modal");
    const panel = element("section", "modal-panel niyya-vip-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "niyya-vip-title");

    const header = element("div", "niyya-profile-header");
    const heading = element("div");
    heading.append(element("span", "eyebrow", "ABONNEMENT"));
    const title = element("h2", "", "Offre VIP");
    title.id = "niyya-vip-title";
    heading.append(title);
    const close = element("button", "modal-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Fermer");
    header.append(heading, close);

    const body = element("div", "niyya-profile-content");
    const plan = element("section", "niyya-vip-plan niyya-vip-featured");
    const benefits = element("ul", "niyya-vip-benefits");
    [
      "Un quota de messages plus élevé, soumis à des règles d’utilisation raisonnable.",
      "Un badge VIP distinctif affiché sur ton profil.",
      "L’accès aux fonctionnalités premium au fur et à mesure de leur disponibilité."
    ].forEach(benefit => benefits.append(element("li", "", benefit)));

    plan.append(
      element("h3", "", "Les avantages"),
      benefits,
      element("strong", "niyya-vip-price", "≈ $2.50 / mois · ≈ $25 / an"),
      element("p", "niyya-vip-note", "Tarifs indicatifs en dollars, à confirmer. L’abonnement et les paiements ne sont pas encore ouverts.")
    );

    body.append(plan);
    panel.append(header, body);
    modal.append(panel);
    document.body.append(modal);

    const dismiss = () => modal.remove();
    close.addEventListener("click", dismiss);
    modal.addEventListener("click", event => {
      if (event.target === modal) dismiss();
    });
  }

  async function openAccount() {
    document.querySelector(".niyya-modal")?.remove();
    const modal = element("div", "niyya-modal niyya-profile-modal");
    const panel = element("section", "modal-panel niyya-profile-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "niyya-profile-title");
    const header = element("div", "niyya-profile-header");
    const heading = element("div");
    heading.append(element("span", "eyebrow", "NIYYA.ai · ESPACE PERSONNEL"));
    const title = element("h2", "", "Mon profil");
    title.id = "niyya-profile-title";
    heading.append(title);
    const close = element("button", "modal-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Fermer");
    header.append(heading, close);
    const content = element("div", "niyya-profile-content");
    content.append(element("p", "chat-status", "Chargement de ton profil…"));
    panel.append(header, content);
    modal.append(panel);
    document.body.append(modal);
    const dismiss = () => modal.remove();
    close.addEventListener("click", dismiss);
    modal.addEventListener("click", event => { if (event.target === modal) dismiss(); });

    const addMenu = (label, detail, symbol, action) => {
      const button = element("button", "niyya-profile-menu-item");
      button.type = "button";
      const icon = element("span", "niyya-profile-menu-icon", symbol);
      const copy = element("span", "niyya-profile-menu-copy");
      copy.append(element("strong", "", label), element("small", "", detail));
      button.append(icon, copy, element("span", "niyya-profile-chevron", "›"));
      button.addEventListener("click", () => { dismiss(); action(); });
      content.append(button);
    };

    try {
      await ensureGuest();
      const session = await window.NiyyaAPI.getSession();
      const user = session.user || {};
      let profile = null;
      if (!user.isGuest) {
        try {
          const result = await fetch("/api/community/profiles/me", { credentials: "same-origin", headers: { Accept: "application/json" } });
          const data = await result.json();
          if (result.ok) profile = data.profile;
        } catch {}
      }
      content.replaceChildren();
      const identity = element("section", "niyya-profile-identity");
      const avatar = element("div", "niyya-profile-avatar", (profile?.pseudonym || user.pseudonym || user.email || "N").slice(0,1).toUpperCase());
      const identityCopy = element("div", "niyya-profile-identity-copy");
      identityCopy.append(
        element("h3", "", profile?.pseudonym || user.pseudonym || (user.isGuest ? "Invité NIYYA" : "Membre NIYYA")),
        element("p", "", user.isGuest ? "Compte invité" : (user.email || "Compte NIYYA"))
      );
      identity.append(avatar, identityCopy);
      content.append(identity);

      const stats = element("div", "niyya-profile-stats");
      const stat = (value, label) => {
        const item = element("div", "niyya-profile-stat");
        item.append(element("strong", "", String(value)), element("span", "", label));
        stats.append(item);
      };
      stat(profile?.post_count ?? "—", "Publications");
      stat(profile?.follower_count ?? "—", "Abonnés");
      stat(profile?.following_count ?? "—", "Abonnements");
      content.append(stats);

      const bio = element("p", "niyya-profile-bio", profile?.bio || (user.isGuest
        ? "Crée ton compte pour personnaliser ton profil et retrouver tes activités."
        : "Ajoute une petite présentation pour que la communauté puisse te découvrir."));
      content.append(bio);

      if (!user.isGuest && profile) {
        const edit = element("details", "niyya-profile-edit");
        const summary = element("summary", "", "Modifier mon profil");
        const form = element("form", "niyya-profile-edit-form");
        const pseudoLabel = element("label", "account-field", "Pseudo public");
        const pseudo = element("input", "account-input");
        pseudo.value = profile.pseudonym || "";
        pseudo.minLength = 3; pseudo.maxLength = 20; pseudo.required = true;
        pseudo.pattern = "[A-Za-z0-9_]{3,20}";
        pseudoLabel.append(pseudo);
        const bioLabel = element("label", "account-field", "Présentation");
        const bioInput = element("textarea", "account-input");
        bioInput.rows = 3; bioInput.maxLength = 180;
        bioInput.value = profile.bio || "";
        bioInput.placeholder = "Présente-toi en quelques mots…";
        bioLabel.append(bioInput);
        const status = element("p", "chat-status", "");
        status.setAttribute("role", "status");
        const save = element("button", "chat-send account-submit", "Enregistrer");
        save.type = "submit";
        form.append(pseudoLabel, bioLabel, status, save);
        form.addEventListener("submit", async event => {
          event.preventDefault();
          if (save.disabled) return;
          save.disabled = true; status.textContent = "Enregistrement…";
          try {
            const response = await fetch("/api/community/profiles/me", {
              method: "PATCH", credentials: "same-origin",
              headers: { "Content-Type": "application/json", Accept: "application/json" },
              body: JSON.stringify({ pseudonym: pseudo.value, bio: bioInput.value })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Impossible d'enregistrer le profil.");
            profile = data.profile;
            identityCopy.querySelector("h3").textContent = profile.pseudonym;
            avatar.textContent = profile.pseudonym.slice(0,1).toUpperCase();
            bio.textContent = profile.bio || "Aucune présentation pour le moment.";
            status.textContent = "Profil mis à jour.";
          } catch (error) { status.textContent = error.message; }
          finally { save.disabled = false; }
        });
        edit.append(summary, form);
        content.append(edit);
      }

      const menuTitle = element("h3", "niyya-profile-section-title", "Mon espace");
      content.append(menuTitle);
      addMenu("Offre VIP", "Découvrir les avantages premium", "✦", openVipOffers);
      addMenu("Messages", "Retrouver toutes tes discussions", "▤", openConversationHistory);
      addMenu("Mes personnages", "Gérer les personnages que tu as créés", "✦", openMyCharacters);
      addMenu("Communauté", "Publications et membres NIYYA", "◎", () => {
        document.querySelector('.bottom-nav [href="#community"]')?.click();
      });
      addMenu("Compte et sécurité", "Connexion, mot de passe et déconnexion", "⌑", openAccountSettings);
      addMenu("Centre d’assistance", "Contacter l’équipe NIYYA et suivre tes demandes", "?", () => { window.location.href = "/support.html"; });
      if (user.isGuest) {
        const register = element("button", "chat-send niyya-profile-register", "Créer un compte ou se connecter");
        register.type = "button";
        register.addEventListener("click", () => { dismiss(); openAccountSettings(); });
        content.append(register);
      }
    } catch (error) {
      content.replaceChildren(element("p", "chat-status", error.message || "Impossible de charger ton profil."));
    }
  }

  async function openAccountSettings() {
    document.querySelector(".niyya-modal")?.remove();
    const modal = element("div", "niyya-modal account-modal");
    const panel = element("section", "modal-panel account-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "account-title");
    const header = element("div", "account-heading");
    const heading = element("div");
    heading.append(element("span", "eyebrow", "PARAMÈTRES"));
    const title = element("h2", "", "Compte et sécurité");
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
        const passwordForm = element("form", "account-form");
        const currentPasswordLabel = element("label", "account-field");
        currentPasswordLabel.append(element("span", "", "Mot de passe actuel"));
        const currentPassword = element("input", "account-input");
        currentPassword.type = "password";
        currentPassword.autocomplete = "current-password";
        currentPassword.required = true;
        currentPassword.maxLength = 128;
        currentPasswordLabel.append(currentPassword);
        const newPasswordLabel = element("label", "account-field");
        newPasswordLabel.append(element("span", "", "Nouveau mot de passe"));
        const newPassword = element("input", "account-input");
        newPassword.type = "password";
        newPassword.autocomplete = "new-password";
        newPassword.required = true;
        newPassword.minLength = 10;
        newPassword.maxLength = 128;
        newPasswordLabel.append(newPassword);
        const confirmPasswordLabel = element("label", "account-field");
        confirmPasswordLabel.append(element("span", "", "Confirmer le nouveau mot de passe"));
        const confirmPassword = element("input", "account-input");
        confirmPassword.type = "password";
        confirmPassword.autocomplete = "new-password";
        confirmPassword.required = true;
        confirmPassword.minLength = 10;
        confirmPassword.maxLength = 128;
        confirmPasswordLabel.append(confirmPassword);
        const passwordStatus = element("p", "chat-status", "");
        passwordStatus.setAttribute("role", "status");
        const changePassword = element("button", "account-secondary", "Modifier le mot de passe");
        changePassword.type = "submit";
        passwordForm.append(currentPasswordLabel, newPasswordLabel, confirmPasswordLabel, passwordStatus, changePassword);
        passwordForm.addEventListener("submit", async event => {
          event.preventDefault();
          if (changePassword.disabled) return;
          if (newPassword.value !== confirmPassword.value) {
            passwordStatus.textContent = "Les deux nouveaux mots de passe ne correspondent pas.";
            return;
          }
          changePassword.disabled = true;
          try {
            const result = await window.NiyyaAPI.changePassword({
              currentPassword: currentPassword.value,
              newPassword: newPassword.value
            });
            passwordStatus.textContent = result.message || "Mot de passe modifié.";
            currentPassword.value = "";
            newPassword.value = "";
            confirmPassword.value = "";
          } catch (error) {
            passwordStatus.textContent = error.message || "Impossible de modifier le mot de passe.";
          } finally {
            changePassword.disabled = false;
          }
        });
        content.append(passwordForm);

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
        const chat = element("button", "chat-send creator-chat-button", "Discuter");
        chat.type = "button";
        chat.addEventListener("click", async () => {
          chat.disabled = true;
          try {
            await openChat(character, null);
          } catch (error) {
            showToast(error.message || "Impossible d'ouvrir ce personnage.");
          } finally {
            chat.disabled = false;
          }
        });
        row.append(chat);
        if (["none", "rejected"].includes(character.publication_status)) {
          const edit = element("button", "profile-link-button", "Modifier");
          edit.type = "button";
          edit.addEventListener("click", () => openCreator(character));
          row.append(edit);
        }
        content.append(row);
      });
    } catch (error) {
      content.replaceChildren(element("p", "empty-state", error.message || "Impossible de charger tes créations."));
    }
  }

async function openCreator(existingCharacter = null) {
    document.querySelector(".niyya-modal")?.remove();
    const modal = element("div", "niyya-modal creator-fullscreen-modal");
    const panel = element("section", "modal-panel creator-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", "Atelier de création de personnage");
    const header = element("div", "creator-heading");
    const titleWrap = element("div");
    titleWrap.append(element("span", "eyebrow", "NIYYA.ai · ATELIER"),
      element("h2", "", existingCharacter ? "Modifier ton personnage" : "Donne vie à ton personnage"),
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
      ["name", "Nom du personnage", "Ex. : Mira", 40, true, "input", 2],
      ["description", "Description du personnage", "Décris son caractère, son histoire et sa façon de parler…", 3000, true, "textarea", 10],
      ["greeting", "Premier message", "Que dit le personnage quand une conversation commence ?", 800, true, "textarea", 2]
    ];
    const controls = {};
    fields.forEach(([key, labelText, placeholder, max, required, kind, min]) => {
      const group = element("label", "creator-field");
      group.append(element("span", "creator-label", labelText + (required ? " *" : "")));
      const control = element(kind === "textarea" ? "textarea" : "input", "creator-control");
      control.name = key;
      control.placeholder = placeholder;
      control.maxLength = max;
      control.minLength = min || 0;
      control.required = required;
      const existingValues = {
        description: existingCharacter?.short_bio || existingCharacter?.backstory || existingCharacter?.personality_prompt || ""
      };
      const existingValue = existingValues[key] ?? existingCharacter?.[key];
      if (existingValue !== undefined && existingValue !== null) control.value = existingValue;
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
    category.value = existingCharacter?.category || "original";
    categoryGroup.append(category);
    form.append(categoryGroup);
    const avatarGroup = element("div", "creator-field creator-avatar-field");
    const avatarLabel = element("span", "creator-label", "Photo du personnage (facultatif)");
    const avatarPicker = element("input", "creator-avatar-input");
    avatarPicker.type = "file";
    avatarPicker.accept = "image/*";
    avatarPicker.setAttribute("aria-label", "Choisir une photo du personnage");
    const avatarActions = element("div", "creator-avatar-actions");
    const avatarChoose = element("button", "profile-link-button creator-avatar-choose", "Ajouter une image");
    avatarChoose.type = "button";
    avatarChoose.addEventListener("click", () => avatarPicker.click());
    const avatarRemove = element("button", "profile-link-button creator-avatar-remove", "Retirer");
    avatarRemove.type = "button";
    avatarRemove.hidden = true;
    const avatarHint = element("span", "creator-avatar-hint", "Choisis une photo dans ta galerie ou tes fichiers. Elle sera optimisée avant l'enregistrement.");
    const avatarPreview = element("img", "creator-avatar-preview");
    avatarPreview.alt = "Aperçu de la photo du personnage";
    avatarPreview.hidden = true;
    let avatarData = null;
    let removeAvatar = false;
    const showAvatar = src => {
      if (src) {
        avatarPreview.src = src;
        avatarPreview.hidden = false;
        avatarRemove.hidden = false;
        avatarChoose.textContent = "Changer l'image";
      } else {
        avatarPreview.removeAttribute("src");
        avatarPreview.hidden = true;
        avatarRemove.hidden = true;
        avatarChoose.textContent = "Ajouter une image";
      }
    };
    if (existingCharacter?.avatar_url) showAvatar(existingCharacter.avatar_url);
    avatarRemove.addEventListener("click", () => {
      avatarData = null;
      removeAvatar = true;
      showAvatar("");
      avatarHint.textContent = "La photo sera retirée lors de l'enregistrement.";
    });
    avatarPicker.addEventListener("change", () => {
      const file = avatarPicker.files && avatarPicker.files[0];
      if (!file) return;
      if (!file.type.startsWith("image/") || file.size > 12 * 1024 * 1024) {
        avatarPicker.value = "";
        avatarHint.textContent = "Choisis une image valide de moins de 12 Mo.";
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => { avatarHint.textContent = "Impossible de lire cette image. Essaie-en une autre."; };
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => { avatarHint.textContent = "Ce format d'image n'est pas pris en charge par ton navigateur."; };
        image.onload = () => {
          const maxSide = 640;
          const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
          const context = canvas.getContext("2d");
          if (!context) { avatarHint.textContent = "Impossible de préparer cette image sur cet appareil."; return; }
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          const compress = quality => canvas.toBlob(blob => {
            if (!blob) { avatarHint.textContent = "Impossible de compresser cette image. Réessaie."; return; }
            if (blob.size > 200 * 1024 && quality > 0.42) { compress(quality - 0.12); return; }
            if (blob.size > 200 * 1024) { avatarHint.textContent = "Cette photo reste trop volumineuse après compression. Essaie une autre image."; return; }
            const encoded = new FileReader();
            encoded.onerror = () => { avatarHint.textContent = "Impossible de préparer la photo. Réessaie."; };
            encoded.onload = () => {
              avatarData = String(encoded.result || "");
              removeAvatar = false;
              showAvatar(avatarData);
              avatarHint.textContent = "Photo prête. Elle sera enregistrée avec ton personnage.";
            };
            encoded.readAsDataURL(blob);
          }, "image/jpeg", quality);
          compress(0.82);
        };
        image.src = String(reader.result || "");
      };
      reader.readAsDataURL(file);
    });
    avatarActions.append(avatarChoose, avatarRemove);
    avatarGroup.append(avatarLabel, avatarActions, avatarPicker, avatarPreview, avatarHint);
    form.append(avatarGroup);
    const status = element("p", "chat-status", "");
    const submit = element("button", "chat-send creator-submit", existingCharacter ? "Enregistrer les modifications" : "Créer mon personnage");
    submit.type = "submit";
    form.append(status, submit);
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
      const description = controls.description.value.trim();
      const firstSentence = description.split(/[.!?\n]/)[0].trim();
      const tagline = (firstSentence.length >= 3 ? firstSentence : description).slice(0, 100);
      const payload = {
        name: controls.name.value.trim(),
        tagline,
        shortBio: description.slice(0, 500),
        backstory: description,
        personalityPrompt: description,
        scenario: "Un univers fictif et bienveillant.",
        greeting: controls.greeting.value.trim(),
        category: category.value,
        traits: [],
        tags: [],
        avatarData: avatarData || undefined,
        removeAvatar
      };
      try {
        await ensureGuest();
        // Le serveur vérifie les conditions du compte et renvoie le motif précis si le profil est incomplet.
        let editCharacterId = existingCharacter?.id;
        const editUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (existingCharacter && !editUuidPattern.test(String(editCharacterId || ""))) {
          const owned = await window.NiyyaAPI.getMyCharacters();
          const matches = (Array.isArray(owned.characters) ? owned.characters : [])
            .filter(item => item.name === existingCharacter.name && item.tagline === existingCharacter.tagline);
          if (matches.length !== 1 || !editUuidPattern.test(String(matches[0].id || ""))) {
            throw new Error("Impossible de retrouver l'identifiant de ce brouillon. Retourne dans « Mes créations » puis réessaie.");
          }
          editCharacterId = matches[0].id;
        }
        const result = existingCharacter
          ? await window.NiyyaAPI.updateCharacter(editCharacterId, payload)
          : await window.NiyyaAPI.createCharacter(payload);
        if (!result.character) throw new Error("Le serveur n'a pas renvoyé le personnage enregistré.");
        // The create/update endpoint already returns the canonical saved database row.
        // Do not make saving depend on a second /mine request or a name-based lookup:
        // a failed refresh must never turn a successful save into a displayed failure.
        const savedCharacter = result.character;
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const reviewMessage = result.canSubmit
          ? "Ton personnage est privé. Tu peux demander sa vérification avant de le rendre visible dans Explorer."
          : "Ton personnage est enregistré en brouillon privé. La publication publique et l'envoi en vérification sont réservés aux comptes adultes.";
        const successActions = element("div", "creator-success-actions");
        const chatNow = element("button", "chat-send creator-submit", "Discuter avec mon personnage");
        chatNow.type = "button";
        chatNow.addEventListener("click", async () => {
          chatNow.disabled = true;
          chatNow.textContent = "Ouverture de la conversation…";
          try {
            let chatCharacter = savedCharacter;
            if (!uuidPattern.test(String(chatCharacter.id || ""))) {
              // Recover the saved row from the owner's list if an older or stale
              // response omitted its UUID. The successful save remains successful.
              const owned = await window.NiyyaAPI.getMyCharacters();
              const matches = (Array.isArray(owned.characters) ? owned.characters : [])
                .filter(item => item.name === savedCharacter.name && item.tagline === savedCharacter.tagline);
              if (matches.length !== 1 || !uuidPattern.test(String(matches[0].id || ""))) {
                throw new Error("Personnage enregistré, mais identifiant introuvable. Ouvre « Mes créations » puis réessaie.");
              }
              chatCharacter = matches[0];
            }
            await openChat(chatCharacter, null);
          } catch (error) {
            status.textContent = error.message || "Impossible d'ouvrir ce personnage.";
            chatNow.disabled = false;
            chatNow.textContent = "Réessayer";
          }
        });
        const viewCreations = element("button", "profile-link-button", "Mes créations");
        viewCreations.type = "button";
        viewCreations.addEventListener("click", openMyCharacters);
        successActions.append(chatNow, viewCreations);
        form.replaceChildren(
          element("span", "eyebrow", existingCharacter ? "MODIFICATIONS ENREGISTRÉES" : "PERSONNAGE ENREGISTRÉ"),
          element("h3", "", savedCharacter.name),
          element("p", "creator-note", reviewMessage),
          successActions
        );
        if (!result.canSubmit) return;
        const review = element("button", "chat-send creator-submit", "Envoyer en vérification");
        review.type = "button";
        const reviewStatus = element("p", "chat-status", "");
        form.append(review, reviewStatus);
        review.addEventListener("click", async () => {
          review.disabled = true;
          reviewStatus.textContent = "Envoi de la demande…";
          try {
            await window.NiyyaAPI.submitCharacter(savedCharacter.id);
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

  document.getElementById("create-character").addEventListener("click", () => openCreator());
  document.getElementById("home-create-character")?.addEventListener("click", () => openCreator());

  document.querySelectorAll(".nav-item").forEach(item => {
    item.addEventListener("click", async event => {
      event.preventDefault();
      setActiveNav(item.getAttribute("href") || "#");
      const target = (item.getAttribute("href") || "").replace("#", "");
      if (target === "discover" || target === "") {
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

  // Charge le quota dès l'ouverture, sans afficher une ancienne valeur HTML.
  ensureGuest().then(() => refreshQuota()).catch(() => refreshQuota());

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
      await renderActiveCompanions();
      const session = await window.NiyyaAPI.getSession().catch(() => null);
      const pseudonym = session?.user?.pseudonym;
      const greeting = document.getElementById("home-greeting");
      if (greeting && pseudonym) greeting.textContent = "Heureux de te retrouver, " + pseudonym + ".";
    })
    .catch(error => {
      grid.setAttribute("aria-busy", "false");
      grid.replaceChildren(element("p", "empty-state",
        error.message || "Impossible de charger les personnages."));
    })
    .finally(() => {
      // Le compteur doit refléter le quota serveur dès l'ouverture, pas rester à la valeur HTML initiale.
      refreshQuota();
    });

  console.log("NIYYA.ai V2 — Interface initialisée.");
});
