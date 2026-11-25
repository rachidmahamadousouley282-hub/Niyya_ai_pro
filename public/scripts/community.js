(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {
    const nav = document.querySelector(".bottom-nav");
    if (!nav || document.getElementById("community-nav")) return;

    const navLink = document.createElement("a");
    navLink.className = "nav-item community-nav-item";
    navLink.href = "#community";
    navLink.id = "community-nav";
    navLink.innerHTML = '<span class="nav-icon" aria-hidden="true">✦</span><span class="nav-label">Communauté</span>';
    navLink.addEventListener("click", event => {
      event.preventDefault();
      selectNav(navLink);
      openCommunity();
    });
    nav.insertBefore(navLink, nav.querySelector('[href="#create"]') || null);

    function selectNav(active) {
      nav.querySelectorAll(".nav-item").forEach(item => {
        const selected = item === active;
        item.classList.toggle("selected", selected);
        if (selected) item.setAttribute("aria-current", "page");
        else item.removeAttribute("aria-current");
      });
    }

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
      document.querySelector(".niyya-modal")?.remove();
      const modal = el("div", "niyya-modal community-modal");
      const panel = el("section", "modal-panel community-panel");
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-modal", "true");
      panel.setAttribute("aria-labelledby", "community-title");
      const header = el("header", "community-heading");
      const heading = el("div");
      heading.append(el("span", "eyebrow", "NIYYA.ai · ESPACE COMMUNAUTAIRE"));
      const title = el("h2", "", "La communauté");
      title.id = "community-title";
      heading.append(title, el("p", "chat-subtitle", "Découvre les créations, partage les tiennes et rencontre les membres NIYYA."));
      const close = el("button", "modal-close", "×");
      close.type = "button";
      close.setAttribute("aria-label", "Fermer");
      header.append(heading, close);
      const tabs = el("div", "community-tabs");
      const content = el("div", "community-content");
      panel.append(header, tabs, content);
      modal.append(panel);
      document.body.append(modal);

      const dismiss = () => {
        modal.remove();
        const home = nav.querySelector('[href="#"]');
        if (home) selectNav(home);
      };
      close.addEventListener("click", dismiss);
      modal.addEventListener("click", event => { if (event.target === modal) dismiss(); });

      let currentMode = "all";
      let myId = null;
      let offset = 0;
      let loading = false;
      const tabItems = [
        ["all","Pour toi"],["following","Abonnements"],["mine","Mes publications"],["notifications","Notifications"],["search","Membres"]
      ];
      function setTab(mode) {
        currentMode = mode;
        tabs.replaceChildren();
        tabItems.forEach(([key,label]) => {
          const button = el("button", "community-tab" + (mode===key?" active":""), label);
          button.type = "button";
          button.addEventListener("click", () => setTab(key));
          tabs.append(button);
        });
        if (mode === "notifications") loadNotifications();
        else if (mode === "search") renderSearch();
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
            status.textContent=result.post.visibility==="private"?"Publication enregistrée dans ton espace privé.":"Ta publication est en ligne.";
            await renderFeed(currentMode,true);
          }catch(error){status.textContent=error.message;}
          finally{submit.disabled=false;}
        });
        card.append(form);
        return card;
      }

      async function renderFeed(mode, refresh=false) {
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
            feed.append(el("div","community-empty",mode==="following"?"Tu ne suis encore personne. Découvre des membres et abonne-toi à leurs profils.":mode==="mine"?"Tu n'as pas encore publié. Tes créations apparaîtront ici.":"Aucune publication pour le moment. Tu peux lancer la communauté en partageant la première création."));
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
        nameWrap.append(el("strong","",post.author_name||"Membre NIYYA"),el("small","",dateLabel(post.created_at)));
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
            row.append(el("strong","",comment.author_name),el("p","",comment.body));
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
            try{const result=await api("/posts/"+post.id+"/comments",{method:"POST",body:{body:input.value}});const row=el("div","community-comment-row");row.append(el("strong","",result.comment.author_name),el("p","",result.comment.body));container.insertBefore(row,form);input.value="";}
            catch(error){alert(error.message);}finally{send.disabled=false;}
          });
          container.append(form);container.dataset.loaded="true";
        }catch(error){container.replaceChildren(el("p","community-muted",error.message));}
      }

      async function showProfile(userId) {
        content.replaceChildren(el("p","community-muted","Chargement du profil…"));
        try{
          const data=await api("/profiles/"+encodeURIComponent(userId));
          const p=data.profile;
          const wrap=el("section","community-profile-view");
          const top=el("div","community-profile-hero");
          const avatar=el("div","community-profile-avatar",initials(p.pseudonym));
          const info=el("div","community-profile-info");
          info.append(el("h3","",p.pseudonym),el("p","community-muted",p.bio||"Ce membre n'a pas encore ajouté de présentation."));
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
            row.append(el("span","community-avatar",initials(member.pseudonym)),el("span","community-search-name",member.pseudonym),el("span","community-muted","Voir le profil →"));
            row.addEventListener("click",()=>showProfile(member.id));
            list.append(row);
          });
          content.replaceChildren(title,back,list);
        }catch(error){content.replaceChildren(el("p","community-muted",error.message));}
      }

      async function loadNotifications(){
        content.replaceChildren(el("p","community-muted","Chargement des notifications…"));
        try{
          await ensureSession();
          const data=await api("/notifications");
          await api("/notifications/read",{method:"POST",body:{}});
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

      async function renderSearch(){
        content.replaceChildren();
        const form=el("form","community-search-form");
        const input=el("input","community-search-input");input.type="search";input.placeholder="Rechercher un pseudo…";input.minLength=2;
        const button=el("button","community-primary","Rechercher");button.type="submit";form.append(input,button);
        const results=el("div","community-search-results");
        form.addEventListener("submit",async event=>{
          event.preventDefault();if(input.value.trim().length<2)return;
          results.replaceChildren(el("p","community-muted","Recherche…"));
          try{
            const data=await api("/search?q="+encodeURIComponent(input.value.trim()));results.replaceChildren();
            if(!data.profiles.length)results.append(el("p","community-empty","Aucun membre trouvé."));
            data.profiles.forEach(p=>{
              const row=el("div","community-search-result");
              row.append(el("span","community-avatar",initials(p.pseudonym)),el("span","community-search-name",p.pseudonym),el("span","community-muted",p.follower_count+" abonnés"));
              const view=el("button","community-secondary","Voir le profil");view.type="button";view.addEventListener("click",()=>showProfile(p.id));row.append(view);results.append(row);
            });
          }catch(error){results.replaceChildren(el("p","community-muted",error.message));}
        });
        content.append(form,results);
      }

      async function loadCommentsForPost(){/* reserved for lazy comment loading */}
      try {
        await ensureSession();
        const me=await api("/profiles/me");
        myId=me.profile.id;
      } catch { myId=null; }
      setTab("all");
    }
  });
})();
