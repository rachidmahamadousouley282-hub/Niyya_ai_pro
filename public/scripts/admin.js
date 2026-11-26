(() => {
  "use strict";
  const status = document.getElementById("admin-status");
  const dashboard = document.getElementById("admin-dashboard");
  const number = value => new Intl.NumberFormat("fr-FR").format(Number(value || 0));
  let currentData = null;
  let currentDays = 30;

  async function load(days = currentDays) {
    currentDays = days;
    status.hidden = false;
    status.textContent = "Chargement des statistiques…";
    dashboard.hidden = true;
    const reportReasons = {
    spam: "Spam",
    harassment: "Harcèlement",
    unsafe: "Contenu dangereux",
    personal_info: "Informations personnelles",
    other: "Autre motif"
  };

  async function loadCommunityReports() {
    const container = document.getElementById("community-reports");
    container.replaceChildren();
    const loading = document.createElement("p");
    loading.className = "admin-report-empty";
    loading.textContent = "Chargement des signalements…";
    container.append(loading);
    try {
      const response = await fetch("/api/community/moderation/reports", {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
        cache: "no-store"
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Impossible de charger les signalements.");
      renderCommunityReports(data.reports || []);
    } catch (error) {
      container.replaceChildren();
      const message = document.createElement("p");
      message.className = "admin-report-empty";
      message.textContent = error.message || "Erreur de chargement des signalements.";
      container.append(message);
    }
  }

  function renderCommunityReports(reports) {
    const container = document.getElementById("community-reports");
    container.replaceChildren();
    if (!reports.length) {
      const empty = document.createElement("p");
      empty.className = "admin-report-empty";
      empty.textContent = "Aucun signalement en attente. La communauté est à jour.";
      container.append(empty);
      return;
    }
    reports.forEach(report => {
      const card = document.createElement("article");
      card.className = "admin-report-card";
      const heading = document.createElement("div");
      heading.className = "admin-report-heading";
      const title = document.createElement("strong");
      title.textContent = report.target_type === "comment" ? "Commentaire signalé" : "Publication signalée";
      const reason = document.createElement("span");
      reason.className = "admin-report-reason";
      reason.textContent = reportReasons[report.reason] || "Autre motif";
      heading.append(title, reason);
      const excerpt = document.createElement("p");
      excerpt.className = "admin-report-body";
      excerpt.textContent = report.target_body || "Contenu signalé sans texte (image ou contenu indisponible).";
      const meta = document.createElement("p");
      meta.className = "admin-report-meta";
      const date = report.created_at ? new Date(report.created_at).toLocaleString("fr-FR") : "Date inconnue";
      meta.textContent = "Signalé par " + (report.reporter_name || "un membre") + " · " + date;
      const actions = document.createElement("div");
      actions.className = "admin-report-actions";
      const keep = document.createElement("button");
      keep.type = "button";
      keep.className = "admin-report-keep";
      keep.textContent = "Conserver";
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "admin-report-remove";
      remove.textContent = "Retirer le contenu";
      const feedback = document.createElement("span");
      feedback.className = "admin-report-feedback";
      async function decide(decision, button) {
        if (keep.disabled || remove.disabled) return;
        keep.disabled = true;
        remove.disabled = true;
        feedback.textContent = "Enregistrement…";
        try {
          const response = await fetch("/api/community/moderation/reports/" + encodeURIComponent(report.id), {
            method: "PATCH",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ decision })
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.error || "Impossible d'enregistrer cette décision.");
          card.remove();
          if (!container.querySelector(".admin-report-card")) {
            const empty = document.createElement("p");
            empty.className = "admin-report-empty";
            empty.textContent = "Aucun signalement en attente. La communauté est à jour.";
            container.append(empty);
          }
        } catch (error) {
          feedback.textContent = error.message || "Erreur.";
          keep.disabled = false;
          remove.disabled = false;
        }
      }
      keep.addEventListener("click", () => decide("keep", keep));
      remove.addEventListener("click", () => decide("remove", remove));
      actions.append(keep, remove, feedback);
      card.append(heading, excerpt, meta, actions);
      container.append(card);
    });
  }

  document.querySelectorAll("[data-days]").forEach(button =>
      button.classList.toggle("active", Number(button.dataset.days) === days));
    try {
      const response = await fetch("/api/admin/character-analytics?days=" + days, {
        credentials: "same-origin",
        headers: { Accept: "application/json" }
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        status.textContent = "Connecte-toi d’abord à ton compte NIYYA.ai, puis ouvre à nouveau ce tableau.";
        return;
      }
      if (response.status === 403) {
        status.textContent = "Accès réservé aux comptes autorisés de la direction NIYYA.ai.";
        return;
      }
      if (!response.ok) throw new Error(data.error || "Impossible de charger les statistiques.");
      currentData = data;
      document.getElementById("metric-views").textContent = number(data.summary.views);
      document.getElementById("metric-likes").textContent = number(data.summary.likes);
      document.getElementById("metric-chats").textContent = number(data.summary.conversations_started);
      document.getElementById("metric-characters").textContent = number(data.summary.public_characters);
      renderRanking(data.topCharacters || []);
      renderDaily(data.daily || {});
      await loadCommunityReports();
      status.hidden = true;
      dashboard.hidden = false;
    } catch (error) {
      status.textContent = error.message || "Une erreur est survenue.";
    }
  }

  function renderRanking(items) {
    const body = document.getElementById("character-ranking");
    body.replaceChildren();
    if (!items.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 4;
      cell.textContent = "Aucune donnée pour le moment.";
      row.append(cell);
      body.append(row);
      return;
    }
    items.forEach(item => {
      const row = document.createElement("tr");
      [item.name, number(item.views), number(item.likes), number(item.conversations_started)].forEach(value => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.append(cell);
      });
      body.append(row);
    });
  }

  function renderDaily(daily) {
    const container = document.getElementById("daily-activity");
    container.replaceChildren();
    const groups = [
      ["Consultations", daily.views || []],
      ["J'aime", daily.likes || []],
      ["Conversations", daily.conversations || []]
    ];
    groups.forEach(([label, rows]) => {
      const section = document.createElement("div");
      section.className = "daily-group";
      const heading = document.createElement("h3");
      heading.textContent = label;
      section.append(heading);
      const list = document.createElement("div");
      list.className = "daily-bars";
      rows.slice(-14).forEach(row => {
        const item = document.createElement("div");
        item.className = "daily-bar-row";
        const date = document.createElement("span");
        date.textContent = new Date(row.day).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
        const bar = document.createElement("span");
        bar.className = "daily-bar-track";
        const fill = document.createElement("span");
        fill.className = "daily-bar-fill";
        const max = Math.max(1, ...rows.map(value => Number(value.count || 0)));
        fill.style.width = Math.max(2, Number(row.count || 0) / max * 100) + "%";
        bar.append(fill);
        const count = document.createElement("strong");
        count.textContent = number(row.count);
        item.append(date, bar, count);
        list.append(item);
      });
      if (!rows.length) {
        const empty = document.createElement("p");
        empty.textContent = "Pas encore d'activité.";
        section.append(empty);
      } else section.append(list);
      container.append(section);
    });
  }

  document.querySelectorAll("[data-days]").forEach(button =>
    button.addEventListener("click", () => load(Number(button.dataset.days))));
  document.getElementById("reload-community-reports")?.addEventListener("click", loadCommunityReports);
  document.getElementById("export-csv").addEventListener("click", () => {
    if (!currentData) return;
    const rows = [["Personnage", "Consultations", "J'aime", "Conversations"]];
    (currentData.topCharacters || []).forEach(item =>
      rows.push([item.name, item.views, item.likes, item.conversations_started]));
    const csv = rows.map(row => row.map(value =>
      '"' + String(value ?? "").replace(/"/g, '""') + '"').join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "niyya-personnages-" + currentDays + "j.csv";
    link.click();
    URL.revokeObjectURL(url);
  });
  load();
})();
