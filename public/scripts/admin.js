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
