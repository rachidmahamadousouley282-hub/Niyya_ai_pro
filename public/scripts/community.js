(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {
    const nav = document.querySelector(".bottom-nav");
    if (!nav || document.getElementById("community-nav")) return;

    const labels = { fr: "Communauté", en: "Community", es: "Comunidad", ar: "المجتمع", de: "Community", pt: "Comunidade" };
    const navLink = document.createElement("a");
    navLink.className = "nav-item community-nav-item";
    navLink.href = "#community";
    navLink.id = "community-nav";
    navLink.innerHTML = '<span class="nav-icon" aria-hidden="true">✦</span><span class="nav-label"></span>';
    const label = navLink.querySelector(".nav-label");
    const currentLanguage = () => window.NiyyaI18n?.getLanguage?.() || "fr";
    const updateLabel = () => { label.textContent = labels[currentLanguage()] || labels.fr; };
    updateLabel();
    navLink.addEventListener("click", event => {
      event.preventDefault();
      nav.querySelectorAll(".nav-item").forEach(item => {
        const selected = item === navLink;
        item.classList.toggle("selected", selected);
        if (selected) item.setAttribute("aria-current", "page");
        else item.removeAttribute("aria-current");
      });
      openCommunity();
    });
    nav.insertBefore(navLink, nav.querySelector('[href="#create"]') || null);
    document.addEventListener("niyya:language-changed", updateLabel);

    const api = async (path, options = {}) => {
      const response = await fetch("/api/community" + path, {
        method: options.method || "GET",
        credentials: "same-origin",
        headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}) },
        body: options.body ? JSON.stringify(options.body) : undefined
      });
      let data = {};
      try { data = await response.json(); } catch {}
      if (!response.ok) throw new Error(data.error || "Une erreur est survenue.");
      return data;
    };
    const el = (tag, className, text) => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    };
    const dateLabel = value => {
      try { return new Date(value).toLocaleDateString(currentLanguage(), { day: "numeric", month: "short" }); }
      catch { return ""; }
    };
    const ensureSession = async () => {
      try { await window.NiyyaAPI.getSession(); }
      catch { await window.NiyyaAPI.createGuest(); }
    };

    async function openCommunity() {
      document.querySelector(".niyya-modal")?.remove();
      const modal = el("div", "niyya-modal community-modal");
      const panel = el("section", "modal-panel community-panel");
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-modal", "true");
      panel.setAttribute("aria-labelledby", "community-title");
      const header = el("header", "community-heading");
      const heading = el("div");
      heading.append(el("span", "eyebrow", "NIYYA.ai · COMMUNAUTÉ"));
      const title = el("h2", "", "La communauté");
      title.id = "community-title";
      heading.append(title, el("p", "chat-subtitle", "Partage tes idées, découvre les autres membres et échange dans un espace respectueux."));
      const close = el("button", "modal-close", "×");
      close.type = "button";
      close.setAttribute("aria-label", "Fermer");
      header.append(heading, close);
      const content = el("div", "community-content");
      content.append(el("p", "chat-status", "Chargement du fil…"));
      panel.append(header, content);
      modal.append(panel);
      document.body.append(modal);
      const dismiss = () => {
        modal.remove();
        nav.querySelectorAll(".nav-item").forEach(item => {
          const selected = item.getAttribute("href") === "#";
          item.classList.toggle("selected", selected);
          if (selected) item.setAttribute("aria-current", "page");
          else item.removeAttribute("aria-current");
        });
      };
      close.addEventListener("click", dismiss);
      modal.addEventListener("click", event => { if (event.target === modal) dismiss(); });

      const profileArea = el("section", "community-profile-area");
      const feedArea = el("section", "community-feed-area");
      content.replaceChildren(profileArea, feedArea);
      await renderComposer(profileArea);
      await loadFeed(feedArea, profileArea);
    }

    async function renderComposer(container) {
      container.replaceChildren();
      const card = el("div", "community-composer");
      card.append(el("h3", "", "Ton espace"));
      const intro = el("p", "community-muted", "Connecte-toi avec ton pseudo NIYYA pour publier et gérer ton profil.");
      card.append(intro);
      try {
        await ensureSession();
        const data = await api("/profiles/me");
        const profile = data.profile;
        const bioLabel = el("label", "community-label", "Petite présentation");
        const bio = el("textarea", "community-textarea");
        bio.maxLength = 180;
        bio.rows = 2;
        bio.placeholder = "Présente-toi en quelques mots (sans coordonnées personnelles)…";
        bio.value = profile.bio || "";
        bioLabel.append(bio);
        const saveBio = el("button", "community-secondary", "Enregistrer ma présentation");
        saveBio.type = "button";
        saveBio.addEventListener("click", async () => {
          saveBio.disabled = true;
          try {
            await api("/profiles/me", { method: "PATCH", body: { bio: bio.value } });
            intro.textContent = "Présentation enregistrée.";
          } catch (error) { intro.textContent = error.message; }
          finally { saveBio.disabled = false; }
        });
        const form = el("form", "community-post-form");
        const textarea = el("textarea", "community-textarea");
        textarea.name = "body";
        textarea.maxLength = 600;
        textarea.rows = 3;
        textarea.required = true;
        textarea.placeholder = "Qu'as-tu envie de partager aujourd'hui ?";
        const submit = el("button", "community-primary", "Publier");
        submit.type = "submit";
        const status = el("p", "community-muted");
        status.setAttribute("role", "status");
        form.append(textarea, submit, status);
        form.addEventListener("submit", async event => {
          event.preventDefault();
          if (submit.disabled) return;
          submit.disabled = true;
          status.textContent = "Publication…";
          try {
            await api("/posts", { method: "POST", body: { body: textarea.value } });
            textarea.value = "";
            status.textContent = "Publication ajoutée au fil.";
            await loadFeed(feedArea, profileArea);
          } catch (error) { status.textContent = error.message; }
          finally { submit.disabled = false; }
        });
        card.replaceChildren(el("h3", "", "Ton espace"), el("p", "community-muted", "Connecté sous le pseudo " + profile.pseudonym + "."), bioLabel, saveBio, form);
      } catch (error) {
        card.append(el("p", "community-muted", error.message || "Le fil est accessible, mais termine ton inscription pour publier."));
      }
      container.append(card);
    }

    async function loadFeed(container, profileArea) {
      container.replaceChildren(el("h3", "community-section-title", "Publications récentes"));
      const status = el("p", "community-muted", "Chargement…");
      container.append(status);
      try {
        const data = await api("/feed?limit=20");
        container.replaceChildren(el("h3", "community-section-title", "Publications récentes"));
        if (!data.posts?.length) {
          container.append(el("p", "community-empty", "La communauté démarre. Tu peux être parmi les premiers à publier !"));
          return;
        }
        data.posts.forEach(post => container.append(renderPost(post, container, profileArea)));
      } catch (error) {
        status.textContent = error.message || "Impossible de charger le fil.";
      }
    }

    function renderPost(post, feed, profileArea) {
      const card = el("article", "community-post");
      const top = el("div", "community-post-top");
      const author = el("button", "community-author", post.author_name || "Membre NIYYA");
      author.type = "button";
      author.addEventListener("click", () => showProfile(post.author_id, profileArea));
      top.append(author, el("time", "community-date", dateLabel(post.created_at)));
      const body = el("p", "community-post-body", post.body);
      const actions = el("div", "community-post-actions");
      const like = el("button", "community-action" + (post.liked_by_me ? " active" : ""), (post.liked_by_me ? "♥ " : "♡ ") + (post.like_count || 0));
      like.type = "button";
      like.setAttribute("aria-pressed", post.liked_by_me ? "true" : "false");
      like.addEventListener("click", async () => {
        like.disabled = true;
        try {
          const result = await api("/posts/" + encodeURIComponent(post.id) + "/like", { method: "POST", body: {} });
          post.liked_by_me = result.liked;
          post.like_count = result.likeCount;
          like.textContent = (result.liked ? "♥ " : "♡ ") + result.likeCount;
          like.classList.toggle("active", result.liked);
          like.setAttribute("aria-pressed", result.liked ? "true" : "false");
        } catch (error) { window.alert(error.message); }
        finally { like.disabled = false; }
      });
      const commentsButton = el("button", "community-action", "Commentaires · " + (post.comment_count || 0));
      commentsButton.type = "button";
      const report = el("button", "community-action community-report", "Signaler");
      report.type = "button";
      report.addEventListener("click", async () => {
        if (!window.confirm("Signaler cette publication à l'équipe NIYYA.ai ?")) return;
        report.disabled = true;
        try {
          await api("/posts/" + encodeURIComponent(post.id) + "/report", { method: "POST", body: { reason: "other" } });
          report.textContent = "Signalé";
        } catch (error) { window.alert(error.message); report.disabled = false; }
      });
      actions.append(like, commentsButton, report);
      card.append(top, body, actions);
      const comments = el("div", "community-comments");
      comments.hidden = true;
      commentsButton.addEventListener("click", async () => {
        comments.hidden = !comments.hidden;
        if (!comments.hidden && !comments.dataset.loaded) await loadComments(post, comments);
      });
      card.append(comments);
      return card;
    }

    async function loadComments(post, container) {
      container.replaceChildren(el("p", "community-muted", "Chargement des commentaires…"));
      try {
        const data = await api("/posts/" + encodeURIComponent(post.id) + "/comments");
        container.replaceChildren();
        (data.comments || []).forEach(comment => {
          const row = el("p", "community-comment");
          const name = el("strong", "", comment.author_name + " ");
          row.append(name, document.createTextNode(comment.body));
          container.append(row);
        });
        if (!data.comments?.length) container.append(el("p", "community-muted", "Pas encore de commentaire."));
        const form = el("form", "community-comment-form");
        const input = el("input", "community-comment-input");
        input.maxLength = 240;
        input.required = true;
        input.placeholder = "Ajouter un commentaire…";
        const send = el("button", "community-secondary", "Envoyer");
        send.type = "submit";
        form.append(input, send);
        form.addEventListener("submit", async event => {
          event.preventDefault();
          send.disabled = true;
          try {
            const result = await api("/posts/" + encodeURIComponent(post.id) + "/comments", { method: "POST", body: { body: input.value } });
            const row = el("p", "community-comment");
            row.append(el("strong", "", result.comment.author_name + " "), document.createTextNode(result.comment.body));
            const empty = container.querySelector(".community-muted");
            if (empty?.textContent === "Pas encore de commentaire.") empty.remove();
            container.insertBefore(row, form);
            input.value = "";
          } catch (error) { window.alert(error.message); }
          finally { send.disabled = false; }
        });
        container.append(form);
        container.dataset.loaded = "true";
      } catch (error) { container.replaceChildren(el("p", "community-muted", error.message)); }
    }

    async function showProfile(userId, area) {
      if (!userId) return;
      area.replaceChildren(el("p", "community-muted", "Chargement du profil…"));
      try {
        const data = await api("/profiles/" + encodeURIComponent(userId));
        const p = data.profile;
        const card = el("div", "community-profile-card");
        card.append(el("h3", "", p.pseudonym), el("p", "community-muted", p.bio || "Ce membre n'a pas encore ajouté de présentation."));
        const stats = el("div", "community-profile-stats");
        stats.append(el("span", "", (p.post_count || 0) + " publications"), el("span", "", (p.follower_count || 0) + " abonnés"), el("span", "", (p.following_count || 0) + " abonnements"));
        card.append(stats);
        if (!data.isOwnProfile) {
          const follow = el("button", "community-primary", p.is_following ? "Ne plus suivre" : "Suivre");
          follow.type = "button";
          follow.addEventListener("click", async () => {
            follow.disabled = true;
            try {
              const result = await api("/profiles/" + encodeURIComponent(userId) + "/follow", { method: "POST", body: {} });
              follow.textContent = result.following ? "Ne plus suivre" : "Suivre";
              stats.children[1].textContent = result.followerCount + " abonnés";
            } catch (error) { window.alert(error.message); }
            finally { follow.disabled = false; }
          });
          card.append(follow);
        }
        const back = el("button", "community-secondary", "Retour au fil");
        back.type = "button";
        back.addEventListener("click", () => { area.replaceChildren(); });
        card.append(back);
        area.replaceChildren(card);
      } catch (error) { area.replaceChildren(el("p", "community-muted", error.message)); }
    }
  });
})();
