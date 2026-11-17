
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

    const response = await fetch(
      `${API_BASE}${endpoint}`,
      config
    );

    let data = {};

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      throw new Error(
        data.message || "Une erreur est survenue."
      );
    }

    return data;
  }

  const api = {
    health() {
      return request("/health");
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

    getConversations() {
      return request("/chat/conversations");
    },

    getMessages(conversationId) {
      return request(
        `/chat/${encodeURIComponent(conversationId)}/messages`
      );
    },

    sendMessage(conversationId, message) {
      return request(
        `/chat/${encodeURIComponent(conversationId)}/messages`,
        {
          method: "POST",
          body: { message }
        }
      );
    }
  };

  window.NiyyaAPI = Object.freeze(api);
})();

