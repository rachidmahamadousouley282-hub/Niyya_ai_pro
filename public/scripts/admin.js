(() => {
  "use strict";
  const status = document.getElementById("admin-status");
  const dashboard = document.getElementById("admin-dashboard");
  const number = value => new Intl.NumberFormat("fr-FR").format(Number(value || 0));
  let currentData = null;
  let currentDays = 30;


  async function loadSupportTickets() {
    const box=document.getElementById("admin-support-list"); if(!box)return;
    box.replaceChildren(); const loading=document.createElement("p");loading.className="admin-report-empty";loading.textContent="Chargement…";box.append(loading);
    try {
      const r=await fetch("/api/admin/support/tickets",{credentials:"same-origin",headers:{Accept:"application/json"},cache:"no-store"});
      const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Impossible de charger les demandes.");
      box.replaceChildren();if(!d.tickets.length){const empty=document.createElement("p");empty.className="admin-report-empty";empty.textContent="Aucune demande pour le moment.";box.append(empty);return;}
      d.tickets.forEach(t=>{const b=document.createElement("button");b.type="button";b.className="admin-support-ticket";const title=document.createElement("strong");title.textContent=t.subject;const meta=document.createElement("small");meta.textContent=(t.member_name||"Membre")+" · "+({open:"En attente",in_progress:"En cours",resolved:"Résolue",closed:"Clôturée"}[t.status]||t.status);const excerpt=document.createElement("span");excerpt.textContent=String(t.last_message||"").slice(0,100);b.append(title,meta,excerpt);b.addEventListener("click",()=>openSupportTicket(t.id));box.append(b);});
    }catch(e){box.replaceChildren();const p=document.createElement("p");p.className="admin-report-empty";p.textContent=e.message;box.append(p);}
  }
  async function openSupportTicket(id) {
    const box=document.getElementById("admin-support-detail");box.replaceChildren();const wait=document.createElement("p");wait.className="admin-report-empty";wait.textContent="Chargement de l’échange privé…";box.append(wait);
    try{
      const r=await fetch("/api/admin/support/tickets/"+encodeURIComponent(id),{credentials:"same-origin",headers:{Accept:"application/json"},cache:"no-store"});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Impossible d’ouvrir la demande.");
      box.replaceChildren();const title=document.createElement("h3");title.textContent=d.ticket.subject;const meta=document.createElement("p");meta.className="admin-report-meta";meta.textContent=(d.ticket.member_name||"Membre")+" · "+new Date(d.ticket.created_at).toLocaleString("fr-FR");const messages=document.createElement("div");messages.className="admin-support-messages";
      d.messages.forEach(m=>{const card=document.createElement("article");card.className="admin-support-message "+m.sender_role;const who=document.createElement("strong");who.textContent=m.sender_role==="admin"?"Équipe NIYYA":(m.sender_name||"Membre");const body=document.createElement("p");body.textContent=m.body;const date=document.createElement("small");date.textContent=new Date(m.created_at).toLocaleString("fr-FR");card.append(who,body,date);messages.append(card);});
      const controls=document.createElement("div");controls.className="admin-support-controls";const select=document.createElement("select");select.setAttribute("aria-label","Statut de la demande");[["open","En attente"],["in_progress","En cours"],["resolved","Résolue"],["closed","Clôturée"]].forEach(([v,label])=>{const o=document.createElement("option");o.value=v;o.textContent=label;o.selected=v===d.ticket.status;select.append(o);});
      const save=document.createElement("button");save.type="button";save.className="admin-export";save.textContent="Enregistrer le statut";save.addEventListener("click",async()=>{save.disabled=true;try{const q=await fetch("/api/admin/support/tickets/"+encodeURIComponent(id),{method:"PATCH",credentials:"same-origin",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({status:select.value})});const x=await q.json().catch(()=>({}));if(!q.ok)throw new Error(x.error||"Échec de mise à jour.");await loadSupportTickets();await openSupportTicket(id);}catch(e){feedback.textContent=e.message;}finally{save.disabled=false;}});controls.append(select,save);
      const form=document.createElement("form");form.className="admin-support-reply";const area=document.createElement("textarea");area.rows=4;area.maxLength=5000;area.minLength=2;area.required=true;area.placeholder="Répondre au membre…";area.disabled=d.ticket.status==="closed";const send=document.createElement("button");send.type="submit";send.className="admin-export";send.textContent="Envoyer la réponse";send.disabled=d.ticket.status==="closed";const feedback=document.createElement("p");feedback.className="admin-report-feedback";feedback.setAttribute("role","status");form.append(area,send,feedback);form.addEventListener("submit",async e=>{e.preventDefault();send.disabled=true;try{const q=await fetch("/api/admin/support/tickets/"+encodeURIComponent(id)+"/messages",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({body:area.value})});const x=await q.json().catch(()=>({}));if(!q.ok)throw new Error(x.error||"Échec de l’envoi.");await loadSupportTickets();await openSupportTicket(id);}catch(e){feedback.textContent=e.message;}finally{send.disabled=false;}});
      box.append(title,meta,messages,controls,form);
    }catch(e){box.replaceChildren();const p=document.createElement("p");p.className="admin-report-empty";p.textContent=e.message;box.append(p);}
  }

  async function load(days = currentDays) {
    currentDays = days;
    status.hidden = false;
    status.textContent = "Chargement des statistiques…";
    dashboard.hidden = true;
    async function loadSystemStatus() {
    const container = document.getElementById("ai-provider-status");
    if (!container) return;
    container.textContent = "Vérification de la configuration IA…";
    try {
      const response = await fetch("/api/admin/system-status", {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
        cache: "no-store"
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Configuration IA indisponible.");
      const ai = data.ai || {};
      if (ai.provider === "mock") {
        container.textContent = "Mode simulation actif : les réponses sont des réponses de démonstration, pas celles d'un fournisseur IA externe.";
        container.dataset.state = "warning";
      } else if (ai.provider === "cloudflare" && ai.configured) {
        container.textContent = "Cloudflare Workers AI est configuré. Mode : " + ai.mode + ".";
        container.dataset.state = "ready";
      } else {
        container.textContent = "Le fournisseur IA sélectionné n'est pas configuré ou n'est pas disponible en mode gratuit. Aucun fournisseur payant n'est activé automatiquement.";
        container.dataset.state = "warning";
      }
    } catch (error) {
      container.textContent = error.message || "Impossible de vérifier le moteur IA.";
      container.dataset.state = "error";
    }
  }

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
      const globalResponse = await fetch("/api/admin/platform-analytics?days=" + days, {
        credentials: "same-origin", headers: { Accept: "application/json" }, cache: "no-store"
      });
      const globalData = await globalResponse.json().catch(() => ({}));
      if (!globalResponse.ok) throw new Error(globalData.error || "Impossible de charger les statistiques globales.");
      const totals = globalData.totals || {};
      const setMetric = (id, value) => { const node = document.getElementById(id); if (node) node.textContent = number(value); };
      setMetric("global-members", totals.members_total);
      setMetric("global-active-members", totals.active_members);
      setMetric("global-new-members", totals.new_members_period);
      setMetric("global-conversations", totals.conversations_total);
      setMetric("global-messages", totals.messages_total);
      setMetric("global-period-messages", totals.messages_period);
      setMetric("global-period-posts", totals.posts_period);
      const conversationsNote = document.getElementById("global-conversations-note");
      if (conversationsNote) conversationsNote.textContent = number(totals.conversations_period) + " sur la période · total historique";
      setMetric("global-comments", totals.comments_total);
      setMetric("global-likes", totals.likes_total);
      setMetric("global-follows", totals.follows_total);
      setMetric("global-views", totals.character_views_total);
      document.getElementById("metric-views").textContent = number(data.summary.views);
      document.getElementById("metric-likes").textContent = number(data.summary.likes);
      document.getElementById("metric-chats").textContent = number(data.summary.conversations_started);
      document.getElementById("metric-characters").textContent = number(data.summary.public_characters);
      renderRanking(data.topCharacters || []);
      renderDaily(data.daily || {}, [
        ["Nouveaux membres", globalData.daily?.registrations || []],
        ["Messages", globalData.daily?.messages || []],
        ["Publications", globalData.daily?.posts || []]
      ]);
      await Promise.all([loadCommunityReports(), loadSystemStatus(), loadSupportTickets()]);
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

  function renderDaily(daily, extraGroups = []) {
    const container = document.getElementById("daily-activity");
    container.replaceChildren();
    const groups = [
      ["Consultations de personnages", daily.views || []],
      ["J'aime sur personnages", daily.likes || []],
      ["Conversations lancées", daily.conversations || []],
      ...extraGroups
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
  document.getElementById("reload-support-tickets")?.addEventListener("click", loadSupportTickets);
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
  async function loadOfficialAnnouncements() {
    const list = document.getElementById("official-announcement-list");
    if (!list) return;
    list.replaceChildren();
    const loading = document.createElement("p");
    loading.className = "admin-report-empty";
    loading.textContent = "Chargement des annonces…";
    list.append(loading);
    try {
      const response = await fetch("/api/admin/official/announcements", {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
        cache: "no-store"
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Impossible de charger les annonces.");
      list.replaceChildren();
      if (!data.announcements.length) {
        const empty = document.createElement("p");
        empty.className = "admin-report-empty";
        empty.textContent = "Aucune annonce publiée pour le moment.";
        list.append(empty);
        return;
      }
      data.announcements.forEach(item => {
        const card = document.createElement("article");
        card.className = "admin-announcement-item";
        const body = document.createElement("p");
        body.textContent = item.body;
        const date = document.createElement("small");
        date.textContent = new Date(item.created_at).toLocaleString("fr-FR");
        card.append(body, date);
        list.append(card);
      });
    } catch (error) {
      list.replaceChildren();
      const message = document.createElement("p");
      message.className = "admin-report-empty";
      message.textContent = error.message || "Erreur de chargement.";
      list.append(message);
    }
  }

  const announcementForm = document.getElementById("official-announcement-form");
  const announcementBody = document.getElementById("official-announcement-body");
  const announcementCount = document.getElementById("official-announcement-count");
  const announcementFeedback = document.getElementById("official-announcement-feedback");
  announcementBody?.addEventListener("input", () => {
    announcementCount.textContent = announcementBody.value.length + " / 600";
  });
  announcementForm?.addEventListener("submit", async event => {
    event.preventDefault();
    const submit = announcementForm.querySelector('button[type="submit"]');
    const body = announcementBody.value.trim();
    if (body.length < 2 || body.length > 600) {
      announcementFeedback.textContent = "L’annonce doit contenir entre 2 et 600 caractères.";
      return;
    }
    submit.disabled = true;
    announcementFeedback.textContent = "Publication en cours…";
    try {
      const response = await fetch("/api/admin/official/announcements", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ body })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Impossible de publier l’annonce.");
      announcementBody.value = "";
      announcementCount.textContent = "0 / 600";
      announcementFeedback.textContent = "Annonce publiée sur NIYYA Officiel.";
      await loadOfficialAnnouncements();
    } catch (error) {
      announcementFeedback.textContent = error.message || "Erreur de publication.";
    } finally {
      submit.disabled = false;
    }
  });
  document.getElementById("reload-official-announcements")?.addEventListener("click", loadOfficialAnnouncements);
  loadOfficialAnnouncements();

  load();
})();
