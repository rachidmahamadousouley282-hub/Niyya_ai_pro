(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {
    const nav = document.querySelector(".bottom-nav");
    const main = document.querySelector(".app-shell main");
    const navLink = nav?.querySelector('[href="#community"]');
    if (!nav || !main || !navLink) return;

    let communityPage = null;
    let hiddenHomeSections = [];
    let communitySyncTimer = null;
    let communityEventSource = null;
    let communitySyncDebounce = null;
    let communitySyncCleanup = null;
    let lastCommunitySyncAt = 0;
    let selectNav = active => {
      nav.querySelectorAll(".nav-item").forEach(item => {
        const selected = item === active;
        item.classList.toggle("selected", selected);
        if (selected) item.setAttribute("aria-current", "page");
        else item.removeAttribute("aria-current");
      });
    };
    const restoreHome = () => {
      if (communitySyncTimer) {
        clearInterval(communitySyncTimer);
        communitySyncTimer = null;
      }
      if (communitySyncCleanup) {
        communitySyncCleanup();
        communitySyncCleanup = null;
      }
      communityPage?.remove();
      communityPage = null;
      hiddenHomeSections.forEach(section => { section.hidden = false; });
      hiddenHomeSections = [];
    };
    navLink.addEventListener("click", event => {
      event.preventDefault();
      selectNav(navLink);
      openCommunity();
    });
    nav.querySelectorAll('.nav-item:not([href="#community"])').forEach(item => {
      item.addEventListener("click", () => restoreHome());
    });

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
    const el = (tag, cls, value) => {
      const node = document.createElement(tag);
      if (cls) node.className = cls;
      if (value !== undefined && value !== null) node.textContent = value;
      return node;
    };
    const dateLabel = value => {
      try { return new Date(value).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }); }
      catch { return ""; }
    };
    const initials = name => (name || "N").trim().slice(0,1).toUpperCase();
    const verifiedBadge = (isOfficial, isVerified) => {
      if (!isOfficial && !isVerified) return null;
      const badge = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      badge.setAttribute("viewBox", "0 0 24 24");
      badge.setAttribute("class", "community-verified-badge");
      badge.setAttribute("role", "img");
      badge.setAttribute("aria-label", isOfficial ? "Compte officiel NIYYA" : "Compte vérifié");
      const shape = document.createElementNS("http://www.w3.org/2000/svg", "path");
      shape.setAttribute("d", "M12 1.8 14.7 4l3.5-.1 1.1 3.3 2.8 2.1-1.1 3.3 1.1 3.3-2.8 2.1-1.1 3.3-3.5-.1L12 23l-2.7-2.2-3.5.1-1.1-3.3-2.8-2.1L3 12.2 1.9 8.9l2.8-2.1 1.1-3.3 3.5.1Z");
      shape.setAttribute("fill", "#2588F5");
      const tick = document.createElementNS("http://www.w3.org/2000/svg", "path");
      tick.setAttribute("d", "m7.5 12.2 3 3 6.2-6.4");
      tick.setAttribute("fill", "none");
      tick.setAttribute("stroke", "#fff");
      tick.setAttribute("stroke-width", "2");
      tick.setAttribute("stroke-linecap", "round");
      tick.setAttribute("stroke-linejoin", "round");
      badge.append(shape, tick);
      return badge;
    };
    const founderBadge = isFounder => {
      if (!isFounder) return null;
      const badge = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      badge.setAttribute("viewBox", "0 0 24 24");
      badge.setAttribute("class", "community-founder-badge");
      badge.setAttribute("role", "img");
      badge.setAttribute("aria-label", "Créateur de NIYYA.ai");
      const shield = document.createElementNS("http://www.w3.org/2000/svg", "path");
      shield.setAttribute("d", "M12 1.8 21 5v6.1c0 5.3-3.6 9.1-9 11.1-5.4-2-9-5.8-9-11.1V5Z");
      shield.setAttribute("fill", "#D9A441");
      const crown = document.createElementNS("http://www.w3.org/2000/svg", "path");
      crown.setAttribute("d", "m6.8 9 3.1 2.7L12 7.2l2.1 4.5L17.2 9l-1 7H7.8Z");
      crown.setAttribute("fill", "#172033");
      badge.append(shield, crown);
      return badge;
    };
    const appendNameWithBadge = (parent, name, isOfficial, isVerified, isFounder) => {
      const line = el("span", "community-name-line");
      line.append(el("strong", "", name || "Membre NIYYA"));
      const creator = founderBadge(isFounder);
      if (creator) line.append(creator);
      const badge = verifiedBadge(isOfficial, isVerified);
      if (badge) line.append(badge);
      parent.append(line);
      return line;
    };
    const ensureSession = async () => {
      try { await window.NiyyaAPI.getSession(); }
      catch { await window.NiyyaAPI.createGuest(); }
    };

    async function compressImage(file) {
      if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Choisis une image JPG, PNG ou WebP.");
      if (file.size > 12 * 1024 * 1024) throw new Error("L'image d'origine doit faire moins de 12 Mo.");
      const url = URL.createObjectURL(file);
      try {
        const image = new Image();
        image.src = url;
        await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; });
        const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Impossible de préparer cette image sur cet appareil.");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        let data = canvas.toDataURL("image/jpeg", 0.82);
        let quality = 0.72;
        while (data.length > 1_950_000 && quality >= 0.48) {
          data = canvas.toDataURL("image/jpeg", quality);
          quality -= 0.08;
        }
        if (data.length > 1_950_000) throw new Error("Cette image est trop lourde. Choisis une image plus petite.");
        return data;
      } finally { URL.revokeObjectURL(url); }
    }

    async function openCommunity() {
      if (communityPage) {
        communityPage.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      hiddenHomeSections = Array.from(main.children).filter(node => !node.classList.contains("community-page"));
      hiddenHomeSections.forEach(section => { section.hidden = true; });
      const page = el("section", "community-page");
      page.setAttribute("aria-labelledby", "community-title");
      communityPage = page;
      const header = el("header", "community-heading");
      const heading = el("div");
      heading.append(el("span", "eyebrow", "NIYYA.ai · ESPACE COMMUNAUTAIRE"));
      const title = el("h2", "", "La communauté");
      title.id = "community-title";
      heading.append(title, el("p", "chat-subtitle", "Découvre les créations, partage les tiennes et rencontre les membres NIYYA."));
      const close = el("button", "community-page-close", "×");
      close.type = "button";
      close.setAttribute("aria-label", "Retour à la communauté");
      close.hidden = true;
      header.append(heading, close);
      const officialBanner = el("section", "community-official-card");
      officialBanner.append(el("div", "community-official-mark", "N"));
      const officialCopy = el("div", "community-official-copy");
      officialCopy.append(el("strong", "", "NIYYA Officiel"), el("span", "", "Compte officiel de la plateforme"));
      const officialAction = el("button", "community-follow-small", "Chargement…");
      officialAction.type = "button";
      officialAction.disabled = true;
      officialBanner.append(officialCopy, officialAction);
      page.append(officialBanner);
      api("/official").then(data => {
        const account = data.account;
        officialCopy.replaceChildren();
        appendNameWithBadge(officialCopy, account.pseudonym, account.is_official, account.is_verified, account.is_founder);
        officialCopy.append(el("span", "", account.bio || "Compte officiel de NIYYA.ai"));
        officialAction.disabled = account.id === myId;
        officialAction.textContent = account.is_following ? "Abonné" : "S'abonner";
        officialAction.classList.toggle("following", !!account.is_following);
        officialAction.addEventListener("click", async () => {
          officialAction.disabled = true;
          try {
            const result = await api("/profiles/" + encodeURIComponent(account.id) + "/follow", { method: "POST", body: {} });
            account.is_following = result.following;
            officialAction.textContent = result.following ? "Abonné" : "S'abonner";
            officialAction.classList.toggle("following", result.following);
          } catch (error) { window.alert(error.message); }
          finally { officialAction.disabled = false; }
        });
      }).catch(() => {
        officialCopy.append(el("span", "community-muted", "Le compte officiel sera bientôt disponible."));
        officialAction.hidden = true;
      });
      const tabs = el("div", "community-tabs");
      const content = el("div", "community-content");
      page.append(header, tabs, content);
      main.append(page);
      const showSubpageClose = () => { close.hidden = false; };
      const hideSubpageClose = () => { close.hidden = true; };
      close.addEventListener("click", () => {
        hideSubpageClose();
        setTab(currentMode);
        page.scrollIntoView({ behavior: "smooth", block: "start" });
      });

      let currentMode = "all";
      let myId = null;
      let isAdmin = false;
      let activeProfileId = null;
      let showingProfile = false;
      let offset = 0;
      let syncInProgress = false;
      let loading = false;
      const tabItems = [
        ["all","Pour toi"],["following","Abonnements"],["mine","Mes publications"],["notifications","Notifications"],["search","Découvrir"]
      ];
      function setTab(mode) {
        currentMode = mode;
        activeProfileId = null;
        showingProfile = false;
        tabs.replaceChildren();
        const visibleTabs = isAdmin
          ? [...tabItems, ["image-review","Images à valider"]]
          : tabItems;
        visibleTabs.forEach(([key,label]) => {
          const button = el("button", "community-tab" + (mode===key?" active":""), label);
          button.type = "button";
          button.addEventListener("click", () => setTab(key));
          tabs.append(button);
        });
        if (mode === "notifications") loadNotifications();
        else if (mode === "search") renderSearch();
        else if (mode === "image-review") loadImageReviews();
        else renderFeed(mode);
      }

      function renderComposer() {
        const card = el("section", "community-composer");
        if (!myId) {
          card.append(el("div","community-composer-heading","Partage quelque chose"));
          card.append(el("p","community-muted","Pour publier, suivre des membres et créer ton profil public, termine d'abord ton inscription ou connecte-toi."));
          return card;
        }
        card.append(el("div","community-composer-heading", "Partage quelque chose"));
        card.append(el("p","community-muted","Une création, une idée ou simplement une image avec une description."));
        const form = el("form","community-post-form");
        const textarea = el("textarea","community-textarea");
        textarea.maxLength=600; textarea.rows=3; textarea.placeholder="Qu'as-tu envie de partager ?";
        const fileLabel = el("label","community-upload-label");
        fileLabel.append(el("span","community-upload-icon","＋"),el("span","","Ajouter une image"));
        const file = el("input","community-file-input");
        file.type="file"; file.accept="image/jpeg,image/png,image/webp";
        fileLabel.append(file);
        const preview = el("div","community-image-preview");
        preview.hidden=true;
        let imageData = null;
        const privacyRow = el("div","community-composer-options");
        const visibilityLabel=el("label","community-visibility-label","Qui peut voir ?");
        const visibility=el("select","community-select");
        const pub=el("option","","Tout le monde");
        pub.value="public";
        const priv=el("option","","Moi uniquement");
        priv.value="private";
        visibility.append(pub,priv); visibilityLabel.append(visibility);
        const hint=el("p","community-muted","Tu peux modifier la visibilité à chaque publication.");
        const submit=el("button","community-primary community-publish","Publier");
        submit.type="submit";
        const status=el("p","community-muted community-form-status");
        status.setAttribute("role","status");
        privacyRow.append(visibilityLabel,submit);
        form.append(textarea,fileLabel,preview,privacyRow,hint,status);
        file.addEventListener("change",async()=>{
          const selected=file.files && file.files[0];
          if(!selected){imageData=null;preview.hidden=true;preview.replaceChildren();return;}
          status.textContent="Préparation de l'image…";
          try{
            imageData=await compressImage(selected);
            const img=el("img","community-preview-image");
            img.src=imageData; img.alt="Aperçu de l'image à publier";
            const remove=el("button","community-remove-image","Retirer");
            remove.type="button";
            remove.addEventListener("click",()=>{imageData=null;file.value="";preview.hidden=true;preview.replaceChildren();status.textContent="Image retirée.";});
            preview.replaceChildren(img,remove); preview.hidden=false; status.textContent="Image prête.";
          }catch(error){imageData=null;file.value="";preview.hidden=true;status.textContent=error.message;}
        });
        form.addEventListener("submit",async event=>{
          event.preventDefault();
          if(submit.disabled)return;
          if(textarea.value.trim().length<2&&!imageData){status.textContent="Ajoute un texte ou une image.";return;}
          submit.disabled=true;status.textContent="Publication en cours…";
          try{
            const result=await api("/posts",{method:"POST",body:{body:textarea.value,visibility:visibility.value,image:imageData}});
            textarea.value="";file.value="";imageData=null;preview.hidden=true;preview.replaceChildren();
            status.textContent=result.pendingReview?"Image envoyée à l'administration. Elle sera visible publiquement après validation.":result.post.visibility==="private"?"Publication enregistrée dans ton espace privé.":"Ta publication est en ligne.";
            await renderFeed(currentMode,true);
          }catch(error){status.textContent=error.message;}
          finally{submit.disabled=false;}
        });
        card.append(form);
        return card;
      }

      async function renderFeed(mode, refresh=false) {
        activeProfileId = null;
        showingProfile = false;
        offset=0; loading=false; content.replaceChildren();
        if(mode==="all") content.append(renderComposer());
        const intro=el("div","community-feed-intro");
        intro.append(el("h3","community-section-title",mode==="following"?"Les membres que tu suis":mode==="mine"?"Tes publications":"À découvrir"));
        intro.append(el("p","community-muted",mode==="following"?"Les nouvelles des profils auxquels tu es abonné.":mode==="mine"?"Retrouve et gère tes publications publiques et privées.":"Les dernières créations partagées publiquement."));
        content.append(intro);
        const feed=el("div","community-feed-area");
        content.append(feed);
        await loadPosts(feed,mode,false);
      }

      async function loadPosts(feed,mode,append) {
        if(loading)return; loading=true;
        if(!append)feed.replaceChildren(el("p","community-muted","Chargement des publications…"));
        try{
          await ensureSession();
          const data=await api("/feed?mode="+mode+"&limit=20&offset="+offset);
          if(!append)feed.replaceChildren();
          if(!data.posts.length&&!append){
            const emptyMessage = mode === "following"
              ? (data.followedCount > 0 ? "Tu suis déjà " + data.followedCount + " membre(s), mais aucun n'a encore publié. Leurs prochaines publications apparaîtront ici." : "Tu ne suis encore personne. Découvre des membres et abonne-toi à leurs profils.")
              : mode === "mine" ? "Tu n'as pas encore publié. Tes créations apparaîtront ici."
              : "Aucune publication pour le moment. Tu peux lancer la communauté en partageant la première création.";
            feed.append(el("div","community-empty",emptyMessage));
          }
          data.posts.forEach(post=>feed.append(renderPost(post,feed)));
          offset+=data.posts.length;
          if(data.posts.length===20){
            const more=el("button","community-secondary community-load-more","Charger la suite");
            more.type="button";more.addEventListener("click",async()=>{more.remove();await loadPosts(feed,mode,true);});
            feed.append(more);
          }
        }catch(error){feed.replaceChildren(el("p","community-muted",error.message));}
        finally{loading=false;}
      }

      function renderPost(post,feed) {
        const card=el("article","community-post");
        const top=el("div","community-post-top");
        const identity=el("button","community-post-identity");
        identity.type="button";
        const avatar=el("span","community-avatar",initials(post.author_name));
        const nameWrap=el("span","community-author-copy");
        appendNameWithBadge(nameWrap, post.author_name, post.is_official, post.is_verified, post.is_founder);
        nameWrap.append(el("small","",dateLabel(post.created_at)));
        identity.append(avatar,nameWrap);
        identity.addEventListener("click",()=>showProfile(post.author_id));
        const right=el("div","community-post-top-actions");
        if(post.visibility==="private")right.append(el("span","community-private-tag","Privé"));
        if(myId && post.author_id!==myId){
          const follow=el("button","community-follow-small",post.is_following?"Abonné":"Suivre");
          follow.type="button";follow.classList.toggle("following",!!post.is_following);
          follow.addEventListener("click",async()=>{
            follow.disabled=true;
            try{
              const result=await api("/profiles/"+encodeURIComponent(post.author_id)+"/follow",{method:"POST",body:{}});
              post.is_following=result.following;follow.textContent=result.following?"Abonné":"Suivre";
              follow.classList.toggle("following",result.following);
            }catch(error){window.alert(error.message);}
            finally{follow.disabled=false;}
          });
          right.append(follow);
        }
        top.append(identity,right);card.append(top);
        if(post.body)card.append(el("p","community-post-body",post.body));
        if(post.has_image){
          const image=el("img","community-post-image");
          image.src="/api/community/posts/"+encodeURIComponent(post.id)+"/media";
          image.alt="Image publiée par "+(post.author_name||"un membre");
          image.loading="lazy";
          card.append(image);
        }
        const actions=el("div","community-post-actions");
        const like=el("button","community-action"+(post.liked_by_me?" active":""),(post.liked_by_me?"♥ ":"♡ ")+(post.like_count||0)+" J'aime");
        like.type="button";
        like.addEventListener("click",async()=>{
          like.disabled=true;
          try{const result=await api("/posts/"+post.id+"/like",{method:"POST",body:{}});post.liked_by_me=result.liked;post.like_count=result.likeCount;like.textContent=(result.liked?"♥ ":"♡ ")+result.likeCount+" J'aime";like.classList.toggle("active",result.liked);}
          catch(error){window.alert(error.message);}finally{like.disabled=false;}
        });
        const commentsButton=el("button","community-action","Commenter · "+(post.comment_count||0));
        commentsButton.type="button";
        const share=el("button","community-action","Partager");
        share.type="button";
        share.addEventListener("click",async()=>{
          const shareData={title:"NIYYA.ai · Communauté",text:(post.body||"Découvre cette création sur NIYYA.ai"),url:location.origin+"/#community"};
          try{if(navigator.share)await navigator.share(shareData);else if(navigator.clipboard){await navigator.clipboard.writeText(shareData.text+" "+shareData.url);share.textContent="Lien copié";}}
          catch{}
        });
        actions.append(like,commentsButton,share);
        if(myId===post.author_id){
          const del=el("button","community-action community-report","Supprimer");
          del.type="button";del.addEventListener("click",async()=>{
            if(!confirm("Supprimer cette publication ?"))return;
            del.disabled=true;try{await api("/posts/"+post.id,{method:"DELETE"});card.remove();}catch(error){alert(error.message);del.disabled=false;}
          });actions.append(del);
        }else{
          const report=el("button","community-action community-report","Signaler");
          report.type="button";report.addEventListener("click",async()=>{
            const reason=prompt("Motif : spam, harcèlement, contenu dangereux, informations personnelles ou autre.","other");
            if(!reason)return;
            const normalized=reason.toLowerCase().includes("spam")?"spam":reason.toLowerCase().includes("harc")?"harassment":reason.toLowerCase().includes("dang")?"unsafe":reason.toLowerCase().includes("person")?"personal_info":"other";
            report.disabled=true;try{await api("/posts/"+post.id+"/report",{method:"POST",body:{reason:normalized}});report.textContent="Signalé";}catch(error){alert(error.message);report.disabled=false;}
          });actions.append(report);
        }
        card.append(actions);
        const comments=el("div","community-comments");comments.hidden=true;
        commentsButton.addEventListener("click",async()=>{comments.hidden=!comments.hidden;if(!comments.hidden&&!comments.dataset.loaded)await loadComments(post,comments);});
        card.append(comments);
        return card;
      }

      async function loadComments(post,container){
        container.replaceChildren(el("p","community-muted","Chargement…"));
        try{
          const data=await api("/posts/"+post.id+"/comments");container.replaceChildren();
          (data.comments||[]).forEach(comment=>{
            const row=el("div","community-comment-row");
            const author=el("span","community-comment-author");appendNameWithBadge(author,comment.author_name,false,false,comment.is_founder);row.append(author,el("p","",comment.body));
            if (myId && comment.author_id !== myId) {
              const report=el("button","community-action community-comment-report","Signaler");
              report.type="button";
              report.addEventListener("click",async()=>{
                if(!confirm("Signaler ce commentaire à l'équipe NIYYA.ai ?"))return;
                report.disabled=true;
                try{await api("/comments/"+comment.id+"/report",{method:"POST",body:{reason:"other"}});report.textContent="Signalé";}
                catch(error){alert(error.message);report.disabled=false;}
              });
              row.append(report);
            }
            container.append(row);
          });
          if(!data.comments?.length)container.append(el("p","community-muted","Pas encore de commentaire."));
          const form=el("form","community-comment-form");
          const input=el("input","community-comment-input");input.maxLength=240;input.required=true;input.placeholder="Écrire un commentaire…";
          const send=el("button","community-secondary","Envoyer");send.type="submit";form.append(input,send);
          form.addEventListener("submit",async event=>{
            event.preventDefault();send.disabled=true;
            try{const result=await api("/posts/"+post.id+"/comments",{method:"POST",body:{body:input.value}});const row=el("div","community-comment-row");const author=el("span","community-comment-author");appendNameWithBadge(author,result.comment.author_name,false,false,result.comment.is_founder);row.append(author,el("p","",result.comment.body));container.insertBefore(row,form);input.value="";}
            catch(error){alert(error.message);}finally{send.disabled=false;}
          });
          container.append(form);container.dataset.loaded="true";
        }catch(error){container.replaceChildren(el("p","community-muted",error.message));}
      }

      async function showProfile(userId) {
        activeProfileId = userId;
        showingProfile = true;
        showSubpageClose();
        content.replaceChildren(el("p","community-muted","Chargement du profil…"));
        try{
          const data=await api("/profiles/"+encodeURIComponent(userId));
          const p=data.profile;
          const wrap=el("section","community-profile-view");
          const top=el("div","community-profile-hero");
          const avatar=el("div","community-profile-avatar",initials(p.pseudonym));
          const info=el("div","community-profile-info");
          const profileName = el("div", "community-profile-name-line");
          appendNameWithBadge(profileName, p.pseudonym, p.is_official, p.is_verified, p.is_founder);
          info.append(profileName,el("p","community-muted",p.bio||"Ce membre n'a pas encore ajouté de présentation."));
          top.append(avatar,info);wrap.append(top);
          const stats=el("div","community-profile-stats");
          stats.append(el("button","",""),el("button","",""),el("button","",""));
          stats.children[0].textContent=(p.post_count||0)+" publications";
          stats.children[1].textContent=(p.follower_count||0)+" abonnés";
          stats.children[2].textContent=(p.following_count||0)+" abonnements";
          stats.children[1].type="button"; stats.children[2].type="button";
          stats.children[1].addEventListener("click",()=>showRelations(userId,"followers"));
          stats.children[2].addEventListener("click",()=>showRelations(userId,"following"));
          wrap.append(stats);
          const controls=el("div","community-profile-controls");
          if(!data.isOwnProfile){
            const follow=el("button","community-primary",p.is_following?"Ne plus suivre":"Suivre");
            follow.type="button";follow.addEventListener("click",async()=>{
              follow.disabled=true;try{const result=await api("/profiles/"+userId+"/follow",{method:"POST",body:{}});p.is_following=result.following;follow.textContent=result.following?"Ne plus suivre":"Suivre";stats.children[1].textContent=result.followerCount+" abonnés";}
              catch(error){alert(error.message);}finally{follow.disabled=false;}
            });
            const block=el("button","community-secondary",p.is_blocked?"Débloquer":"Bloquer");
            block.type="button";block.addEventListener("click",async()=>{
              if(!confirm(p.is_blocked?"Débloquer ce membre ?":"Bloquer ce membre ? Ses publications ne seront plus visibles."))return;
              block.disabled=true;try{const result=await api("/profiles/"+userId+"/block",{method:"POST",body:{}});p.is_blocked=result.blocked;block.textContent=result.blocked?"Débloquer":"Bloquer";if(result.blocked){follow.disabled=true;follow.textContent="Bloqué";}}
              catch(error){alert(error.message);}finally{block.disabled=false;}
            });
            controls.append(follow,block);
          }
          const back=el("button","community-secondary","← Retour au fil");back.type="button";back.addEventListener("click",()=>setTab(currentMode));
          controls.append(back);wrap.append(controls);
          const postsTitle=el("h4","community-section-title","Publications");
          wrap.append(postsTitle);
          const posts=el("div","community-profile-posts");posts.append(el("p","community-muted","Chargement…"));wrap.append(posts);
          content.replaceChildren(wrap);
          const postsData=await api("/profiles/"+encodeURIComponent(userId)+"/posts");
          posts.replaceChildren();
          if(!postsData.posts.length)posts.append(el("p","community-empty","Aucune publication publique pour le moment."));
          postsData.posts.forEach(post=>posts.append(renderPost(post,posts)));
        }catch(error){content.replaceChildren(el("p","community-muted",error.message));}
      }

      async function showRelations(userId,type){
        activeProfileId = null;
        showingProfile = false;
        showSubpageClose();
        content.replaceChildren(el("p","community-muted","Chargement de la liste…"));
        try{
          const data=await api("/profiles/"+encodeURIComponent(userId)+"/relations?type="+type);
          const title=el("h3","community-section-title",type==="followers"?"Abonnés":"Abonnements");
          const back=el("button","community-secondary","← Retour au profil");
          back.type="button";back.addEventListener("click",()=>showProfile(userId));
          const list=el("div","community-search-results");
          if(!data.members.length)list.append(el("div","community-empty",type==="followers"?"Aucun abonné pour le moment.":"Ce membre ne suit encore personne."));
          data.members.forEach(member=>{
            const row=el("button","community-search-result");
            row.type="button";
            row.append(el("span","community-avatar",initials(member.pseudonym)));const name=el("span","community-search-name");appendNameWithBadge(name,member.pseudonym,member.is_official,member.is_verified,member.is_founder);row.append(name,el("span","community-muted","Voir le profil →"));
            row.addEventListener("click",()=>showProfile(member.id));
            list.append(row);
          });
          content.replaceChildren(title,back,list);
        }catch(error){content.replaceChildren(el("p","community-muted",error.message));}
      }

      async function loadNotifications(markRead = true){
        activeProfileId = null;
        showingProfile = false;
        content.replaceChildren(el("p","community-muted","Chargement des notifications…"));
        try{
          await ensureSession();
          const data=await api("/notifications");
          if (markRead) await api("/notifications/read",{method:"POST",body:{}});
          content.replaceChildren(el("h3","community-section-title","Ton activité"));
          if(!data.notifications.length){content.append(el("div","community-empty","Tu n'as pas encore de notification. Les nouveaux abonnés et les interactions apparaîtront ici."));return;}
          data.notifications.forEach(item=>{
            const row=el("button","community-notification"+(!item.read_at?" unread":""));
            row.type="button";
            const text=item.event_type==="follow"?"a commencé à te suivre":item.event_type==="like"?"a aimé ta publication":"a commenté ta publication";
            row.append(el("span","community-notification-avatar",initials(item.actor_name)),el("span","community-notification-copy",(item.actor_name||"Un membre")+" "+text),el("time","community-date",dateLabel(item.created_at)));
            row.addEventListener("click",()=>{if(item.actor_id)showProfile(item.actor_id);else if(item.post_id)setTab("mine");});
            content.append(row);
          });
        }catch(error){content.replaceChildren(el("p","community-muted",error.message));}
      }

      async function loadImageReviews(){
        showSubpageClose();
        content.replaceChildren(el("h3","community-section-title","Images en attente de validation"),el("p","community-muted","Ces images ne sont pas visibles dans le fil public tant qu'un administrateur ne les a pas approuvées."));
        const list=el("div","community-image-review-list");
        list.append(el("p","community-muted","Chargement des images…")); content.append(list);
        try{
          const data=await api("/moderation/image-posts"); list.replaceChildren();
          if(!data.posts.length){list.append(el("div","community-empty","Aucune image en attente. La file de modération est à jour."));return;}
          data.posts.forEach(post=>{
            const card=el("article","community-image-review-card");
            card.append(el("strong","","Publication de "+post.author_name),el("p","community-muted",post.body||"Publication avec image sans texte"),el("time","community-date",dateLabel(post.created_at)));
            const image=el("img","community-review-image"); image.alt="Image soumise à validation"; image.loading="lazy"; image.src="/api/community/posts/"+encodeURIComponent(post.id)+"/media"; card.append(image);
            const actions=el("div","community-post-actions");
            const approve=el("button","community-primary","Approuver"); approve.type="button";
            const reject=el("button","community-secondary","Refuser"); reject.type="button";
            const decide=async(decision,button)=>{if(button.disabled)return;button.disabled=true;try{await api("/moderation/image-posts/"+encodeURIComponent(post.id),{method:"PATCH",body:{decision}});card.remove();if(!list.querySelector(".community-image-review-card"))list.append(el("div","community-empty","Aucune image en attente."));}catch(error){alert(error.message);button.disabled=false;}};
            approve.addEventListener("click",()=>decide("approve",approve)); reject.addEventListener("click",()=>decide("reject",reject));
            actions.append(approve,reject);card.append(actions);list.append(card);
          });
        }catch(error){list.replaceChildren(el("p","community-muted",error.message));}
      }

      async function renderSearch(){
        content.replaceChildren();
        const intro=el("div","community-feed-intro");
        intro.append(el("h3","community-section-title","Découvrir les membres"));
        intro.append(el("p","community-muted","Trouve des personnes sur NIYYA, consulte leurs profils et suis les comptes qui t'intéressent."));
        const form=el("form","community-search-form");
        const input=el("input","community-search-input");input.type="search";input.placeholder="Rechercher un pseudo…";input.minLength=2;
        const button=el("button","community-primary","Rechercher");button.type="submit";form.append(input,button);
        const results=el("div","community-search-results");
        let offset=0;
        let currentQuery="";
        let loading=false;
        async function loadMembers(term="",append=false){
          if(loading)return;
          loading=true;
          currentQuery=term;
          if(!append){offset=0;results.replaceChildren(el("p","community-muted",term?"Recherche des membres…":"Chargement des membres à découvrir…"));}
          try{
            const data=term
              ? await api("/search?q="+encodeURIComponent(term))
              : await api("/members?limit=20&offset="+offset);
            if(!append)results.replaceChildren();
            const members=Array.isArray(data.profiles)?data.profiles:[];
            if(!members.length&&!append){
              results.append(el("div","community-empty",term?"Aucun compte trouvé. Vérifie le pseudo ou essaie un autre terme.":"Il n'y a pas encore de membres à découvrir."));
              return;
            }
            members.forEach(member=>{
              const row=el("article","community-member-card");
              const identity=el("button","community-member-identity");
              identity.type="button";
              identity.append(el("span","community-avatar",initials(member.pseudonym)));
              const details=el("span","community-member-details");
              appendNameWithBadge(details, member.pseudonym, member.is_official, member.is_verified, member.is_founder);
              if(member.bio)details.append(el("small","",member.bio));
              details.append(el("small","community-member-count",(member.follower_count||0)+" abonnés"));
              identity.append(details);
              identity.addEventListener("click",()=>showProfile(member.id));
              const actions=el("div","community-member-actions");
              if(myId&&member.id!==myId){
                const follow=el("button","community-primary community-member-follow",member.is_following?"Abonné":"Suivre");
                follow.type="button";
                follow.classList.toggle("following",!!member.is_following);
                follow.addEventListener("click",async()=>{
                  if(follow.disabled)return;
                  follow.disabled=true;
                  try{
                    const result=await api("/profiles/"+encodeURIComponent(member.id)+"/follow",{method:"POST",body:{}});
                    member.is_following=result.following;
                    follow.textContent=result.following?"Abonné":"Suivre";
                    follow.classList.toggle("following",result.following);
                    const count=row.querySelector(".community-member-count");
                    if(count)count.textContent=result.followerCount+" abonnés";
                  }catch(error){window.alert(error.message);}
                  finally{follow.disabled=false;}
                });
                actions.append(follow);
              }
              const view=el("button","community-secondary community-member-view","Voir le profil");
              view.type="button";view.addEventListener("click",()=>showProfile(member.id));
              actions.append(view);
              row.append(identity,actions);
              results.append(row);
            });
            if(!term){
              offset+=members.length;
              const oldMore=results.querySelector(".community-load-more");
              if(oldMore)oldMore.remove();
              if(data.hasMore&&members.length){
                const more=el("button","community-secondary community-load-more","Charger plus de membres");
                more.type="button";
                more.addEventListener("click",()=>loadMembers("",true));
                results.append(more);
              }
            }
          }catch(error){
            if(!append)results.replaceChildren();
            results.append(el("p","community-muted",error.message));
          }finally{loading=false;}
        }
        form.addEventListener("submit",async event=>{
          event.preventDefault();
          const term=input.value.trim();
          if(term.length<2){input.focus();return;}
          await loadMembers(term);
        });
        input.addEventListener("input",()=>{
          if(!input.value.trim()){
            loadMembers("");
          }
        });
        content.append(intro,form,results);
        await loadMembers("");
      }

      async function refreshVisibleCommunityView(force = false) {
        if (!communityPage || document.hidden || syncInProgress) return;
        const now = Date.now();
        if (!force && now - lastCommunitySyncAt < 15000) return;
        const focused = document.activeElement;
        if (focused && communityPage.contains(focused) && /^(INPUT|TEXTAREA|SELECT)$/.test(focused.tagName)) return;
        syncInProgress = true;
        lastCommunitySyncAt = now;
        try {
          if (showingProfile && activeProfileId) {
            const data = await api("/profiles/" + encodeURIComponent(activeProfileId));
            const stats = content.querySelector(".community-profile-stats");
            if (stats && data.profile) {
              stats.children[0].textContent = (data.profile.post_count || 0) + " publications";
              stats.children[1].textContent = (data.profile.follower_count || 0) + " abonnés";
              stats.children[2].textContent = (data.profile.following_count || 0) + " abonnements";
            }
          } else if (currentMode === "notifications") {
            await loadNotifications(false);
          } else if (["all", "following", "mine"].includes(currentMode)) {
            const feed = content.querySelector(".community-feed-area");
            if (!feed || loading) return;
            const data = await api("/feed?mode=" + currentMode + "&limit=20&offset=0");
            const cards = (data.posts || []).map(post => renderPost(post, feed));
            if (!cards.length) {
              feed.replaceChildren(el("div", "community-empty",
                currentMode === "following" ? ((data.followedCount || 0) > 0 ? "Tu suis déjà " + data.followedCount + " membre(s), mais aucun n'a encore publié. Leurs prochaines publications apparaîtront ici." : "Tu ne suis encore personne. Découvre des membres et abonne-toi à leurs profils.") :
                currentMode === "mine" ? "Tu n'as pas encore publié. Tes créations apparaîtront ici." :
                "Aucune publication pour le moment."));
            } else {
              feed.replaceChildren(...cards);
              offset = data.posts.length;
              if (data.posts.length === 20) {
                const more = el("button", "community-secondary community-load-more", "Charger la suite");
                more.type = "button";
                more.addEventListener("click", async () => { more.remove(); await loadPosts(feed, currentMode, true); });
                feed.append(more);
              }
            }
          }
        } catch (error) {
          // A temporary sync failure must not interrupt browsing or clear the page.
          console.warn("Synchronisation communautaire différée :", error.message);
        } finally {
          syncInProgress = false;
        }
      }

      function queueCommunitySync() {
        if (communitySyncDebounce) clearTimeout(communitySyncDebounce);
        communitySyncDebounce = setTimeout(() => {
          communitySyncDebounce = null;
          refreshVisibleCommunityView(true);
        }, 400);
      }
      function startCommunitySync() {
        if (communitySyncTimer) clearInterval(communitySyncTimer);
        if (communityEventSource) communityEventSource.close();
        communityEventSource = null;
        if ("EventSource" in window) {
          communityEventSource = new EventSource("/api/community/events");
          communityEventSource.addEventListener("ready", queueCommunitySync);
          communityEventSource.addEventListener("feed_changed", queueCommunitySync);
          communityEventSource.addEventListener("activity", queueCommunitySync);
        }
        // Reconcile missed events only while the stream is unavailable.
        communitySyncTimer = setInterval(() => {
          if (!communityEventSource || communityEventSource.readyState !== EventSource.OPEN) refreshVisibleCommunityView();
        }, 120000);
        const syncOnReturn = () => { if (!document.hidden) refreshVisibleCommunityView(true); };
        document.addEventListener("visibilitychange", syncOnReturn);
        window.addEventListener("focus", syncOnReturn);
        communitySyncCleanup = () => {
          document.removeEventListener("visibilitychange", syncOnReturn);
          window.removeEventListener("focus", syncOnReturn);
          if (communityEventSource) communityEventSource.close();
          communityEventSource = null;
          if (communitySyncDebounce) clearTimeout(communitySyncDebounce);
          communitySyncDebounce = null;
        };
      }

      async function loadCommentsForPost(){/* reserved for lazy comment loading */}
      try {
        await ensureSession();
        const me=await api("/profiles/me");
        myId=me.profile.id;
        try { const session=await window.NiyyaAPI.getSession(); isAdmin=session?.user?.role==="admin"; } catch { isAdmin=false; }
      } catch { myId=null; isAdmin=false; }
      hideSubpageClose();
      setTab("all");
      startCommunitySync();
    }
  });
})();
