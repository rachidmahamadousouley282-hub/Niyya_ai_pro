/* =================================
   NIYYA.ai V2 — MAIN APPLICATION
================================= */

document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("character-search");
  const grid = document.getElementById("character-grid");
  const categoryButtons = [...document.querySelectorAll(".category")];
  let characters = [];
  let activeCategory = "all";
  let guestReady = false;
  let activeConversation = null;

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
      const matchesSearch = [character.name, character.tagline]
        .some(value => String(value || "").toLocaleLowerCase().includes(term));
      return matchesCategory && matchesSearch;
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
      button.addEventListener("click", () => openChat(character, button));
      info.append(button);
      card.append(art, info);
      grid.append(card);
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
    const close = element("button", "modal-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", t("close"));
    header.append(titleWrap, close);

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

    return { modal, messages, form, input, send };
  }

  function addMessage(container, role, content) {
    const bubble = element("div", "chat-message " + role);
    bubble.append(element("span", "chat-role", role === "user" ? t("you") : t("niyya")));
    bubble.append(element("p", "", content));
    container.append(bubble);
    container.scrollTop = container.scrollHeight;
  }

  async function openChat(character, trigger) {
    if (!character.id) return;
    if (trigger) trigger.disabled = true;
    const ui = openChatShell(character);
    const status = element("p", "chat-status", t("connecting"));
    ui.messages.append(status);

    try {
      await ensureGuest();
      const created = await window.NiyyaAPI.createConversation(character.id);
      activeConversation = created.conversation.id;
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
  categoryButtons.forEach(button => {
    button.addEventListener("click", () => {
      categoryButtons.forEach(item => item.classList.toggle("active", item === button));
      activeCategory = button.dataset.category;
      renderCharacters();
    });
  });

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
    item.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach(link =>
        link.classList.toggle("selected", link === item));
    });
  });

  window.NiyyaAPI.getCharacters()
    .then(data => {
      characters = Array.isArray(data.characters) ? data.characters : [];
      renderCharacters();
    })
    .catch(error => {
      grid.replaceChildren(element("p", "empty-state",
        error.message || "Impossible de charger les personnages."));
    });

  console.log("NIYYA.ai V2 — Interface initialisée.");
});
