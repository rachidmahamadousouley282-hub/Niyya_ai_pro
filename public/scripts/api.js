
/* =================================
   NIYYA AI V2 — API CLIENT
================================= */

(() => {
  "use strict";

  const API_BASE = "/api";

  async function request(endpoint, options = {}) {
    const config = {
      method: options.method || "GET",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(options.body ? {
          "Content-Type": "application/json"
        } : {}),
        ...options.headers
      }
    };

    if (options.body) {
      config.body = JSON.stringify(options.body);
    }

    let response;
    try {
      response = await fetch(`${API_BASE}${endpoint}`, config);
    } catch (error) {
      if (error && error.name === "AbortError") {
        throw new Error("La connexion a expiré. Vérifie Internet puis réessaie.");
      }
      if (error instanceof TypeError) {
        throw new Error("Connexion au serveur impossible. Vérifie ta connexion Internet puis réessaie.");
      }
      throw new Error("La connexion a été interrompue. Réessaie dans un instant.");
    }

    let data = {};

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      throw new Error(
        data.error || data.message || "Une erreur est survenue."
      );
    }

    return data;
  }

  const api = {
    health() {
      return request("/health");
    },

    getSession() {
      return request("/auth/session");
    },

    createGuest() {
      return request("/auth/guest", { method: "POST" });
    },

    registerAccount(data) {
      return request("/auth/register", { method: "POST", body: data });
    },

    login(data) {
      return request("/auth/login", { method: "POST", body: data });
    },

    logout() {
      return request("/auth/logout", { method: "POST" });
    },

    changePassword(data) {
      return request("/auth/password", { method: "POST", body: data });
    },

    completeOnboarding(data) {
      return request("/auth/onboarding", { method: "POST", body: data });
    },

    getCharacters(params = {}) {
      const query = new URLSearchParams(params);
      const suffix = query.toString()
        ? `?${query.toString()}`
        : "";

      return request(`/characters${suffix}`);
    },

    getCharacter(id) {
      return request(
        `/characters/${encodeURIComponent(id)}`
      );
    },

    recordCharacterView(id) {
      return request(`/characters/${encodeURIComponent(id)}/view`, { method: "POST" });
    },

    getMyCharacters() {
      return request("/characters/mine");
    },

    createCharacter(character) {
      return request("/characters", { method: "POST", body: character });
    },

    submitCharacter(characterId) {
      return request(`/characters/${encodeURIComponent(characterId)}/submit`, { method: "POST" });
    },

    getQuota() {
      return request("/quota");
    },

    getSettings() {
      return request("/settings");
    },

    updateSettings(data) {
      return request("/settings", { method: "PATCH", body: data });
    },

    getFavorites() {
      return request("/favorites");
    },

    addFavorite(characterId) {
      return request(`/favorites/${encodeURIComponent(characterId)}`, { method: "POST" });
    },

    removeFavorite(characterId) {
      return request(`/favorites/${encodeURIComponent(characterId)}`, { method: "DELETE" });
    },

    getConversations() {
      return request("/chat/conversations");
    },

    createConversation(characterId) {
      return request("/chat/conversations", {
        method: "POST",
        body: { characterId }
      });
    },

    getMessages(conversationId) {
      return request(
        `/chat/${encodeURIComponent(conversationId)}/messages`
      );
    },

    sendMessage(conversationId, message, language = "fr") {
      return request(
        `/chat/${encodeURIComponent(conversationId)}/messages`,
        {
          method: "POST",
          body: { message, language }
        }
      );
    }
  };

  window.NiyyaAPI = Object.freeze(api);
})();

