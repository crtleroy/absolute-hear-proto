/* First Note: Perfect Pitch — les éléments d'application autour du jeu : profil, série, statistiques, réglages, partage,
   premier lancement, installation. S'appuie sur window.AH, exposé par app.js. */
(function () {
  "use strict";
  const AH = window.AH;
  if (!AH) return;
  const $ = (id) => document.getElementById(id);
  const S = AH.S;
  S.stats = Object.assign({ parties: 0, victoires: 0, reponses: 0, justes: 0, temps: 0, jours: {} }, S.stats || {});
  S.reglages = Object.assign({ notation: "fr", vibration: true }, S.reglages || {});
  S.profil = Object.assign({ nom: "Invité", accueilVu: false }, S.profil || {});
  const NOMS_FR = AH.FR.slice();
  const jour = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  /* ---------- réglages ---------- */
  function appliquerNotation() {
    const lettres = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
    NOMS_FR.forEach((n, i) => { AH.FR[i] = S.reglages.notation === "en" ? lettres[i] : n; });
  }
  appliquerNotation();

  /* ---------- série de jours et statistiques ---------- */
  function serie() {
    let n = 0;
    const d = new Date();
    if (!S.stats.jours[jour(d)]) d.setDate(d.getDate() - 1); // la série tient encore si on n'a pas joué aujourd'hui
    while (S.stats.jours[jour(d)]) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  document.addEventListener("ah:reponse", (e) => {
    S.stats.reponses++;
    if (e.detail.juste) S.stats.justes++;
    S.stats.temps += e.detail.temps;
    if (S.reglages.vibration && navigator.vibrate) navigator.vibrate(e.detail.juste ? 18 : [40, 60, 40]);
    AH.sauver();
  });
  document.addEventListener("ah:fin", (e) => {
    S.stats.parties++;
    if (e.detail.victoire) S.stats.victoires++;
    S.stats.jours[jour()] = (S.stats.jours[jour()] || 0) + 1;
    // une publicité est due si le joueur n'est pas abonné, que la partie a duré, et que la précédente n'est pas trop récente
    pubDue = !S.profil.premium && (Date.now() - debutPartie) / 1000 >= PUB.partieMin && (Date.now() - dernierePub) / 1000 >= PUB.delaiMin;
    AH.sauver();
  });

  /* ---------- écran profil ---------- */
  function semaine() {
    const lettres = ["D", "L", "M", "M", "J", "V", "S"], d = new Date();
    d.setDate(d.getDate() - 6);
    let html = "";
    for (let i = 0; i < 7; i++) { html += `<span class="${S.stats.jours[jour(d)] ? "ok" : ""}${i === 6 ? " auj" : ""}">${lettres[d.getDay()]}</span>`; d.setDate(d.getDate() + 1); }
    return html;
  }
  /* ---------- volets : petites feuilles qui montent du bas (création de profil, premium, classement, textes légaux) ---------- */
  function volet(html, classe) {
    document.querySelectorAll(".volet").forEach((v) => v.remove());
    const v = document.createElement("div");
    v.className = "volet " + (classe || "");
    v.innerHTML = `<div class="volet-fond"></div><div class="volet-panneau"><span class="poignee"></span>${html}</div>`;
    const fermer = () => v.remove();
    v.querySelector(".volet-fond").addEventListener("click", fermer);
    v.querySelectorAll("[data-fermer]").forEach((b) => b.addEventListener("click", fermer));
    $("app").appendChild(v);
    return v;
  }

  /* ---------- compte : dans le proto, le profil est gardé sur l'appareil ; l'inscription réelle viendra avec le serveur ---------- */
  function creerProfil(raison) {
    const v = volet(`
      <p class="surtitre">${raison || "Profil"}</p>
      <h2>Garde ta progression</h2>
      <button class="ligne compte" data-bientot="La connexion Google arrive avec le serveur"><span class="g">G</span><b>Continuer avec Google</b><em>bientôt</em></button>
      <button class="ligne compte sombre" data-bientot="La connexion Apple arrive avec le serveur"><span class="g a"></span><b>Continuer avec Apple</b><em>bientôt</em></button>
      <p class="ou">ou</p>
      <input id="pf-nom" class="champ" placeholder="Prénom" autocomplete="given-name" maxlength="24" value="${S.profil.cree ? S.profil.nom : ""}">
      <input id="pf-mail" class="champ" type="email" placeholder="Adresse e-mail" autocomplete="email" value="${S.profil.email || ""}">
      <label class="case"><input id="pf-news" type="checkbox" ${S.profil.nouvelles ? "checked" : ""}><span>Recevoir les nouveautés par e-mail</span></label>
      <button id="pf-ok" class="bouton plein grand">Créer mon profil</button>
      <button class="lien" data-fermer>Plus tard</button>
      <p class="demo">Prototype : rien n'est envoyé, le profil reste sur cet appareil.</p>`);
    v.querySelectorAll("[data-bientot]").forEach((b) => b.addEventListener("click", () => AH.toast(b.dataset.bientot)));
    v.querySelector("#pf-ok").addEventListener("click", () => {
      const nom = v.querySelector("#pf-nom").value.trim(), mail = v.querySelector("#pf-mail").value.trim();
      if (!nom) return AH.toast("Il manque ton prénom");
      if (!/^\S+@\S+\.\S+$/.test(mail)) return AH.toast("L'adresse e-mail semble incomplète");
      Object.assign(S.profil, { nom, email: mail, nouvelles: v.querySelector("#pf-news").checked, cree: true, depuis: S.profil.depuis || jour() });
      AH.sauver();
      v.remove();
      AH.toast("Profil créé");
      if (ecranProfil) rendreProfil();
    });
  }

  /* ---------- premium : l'offre sans publicité (simulée) ---------- */
  function offrePremium() {
    const v = volet(`
      <p class="surtitre">Premium</p>
      <h2>Tout First Note, sans publicité</h2>
      <ul class="atouts"><li>Aucune publicité</li><li>Tous les morceaux</li><li>Écoute hors ligne</li></ul>
      <div class="formules">
        <button class="formule" data-f="an"><b>Annuel</b><small>prix à définir</small><em>le plus choisi</em></button>
        <button class="formule" data-f="mois"><b>Mensuel</b><small>prix à définir</small></button>
      </div>
      <button id="pm-ok" class="bouton plein grand">${S.profil.premium ? "Revenir à la version gratuite" : "Essayer Premium"}</button>
      <button class="lien" data-fermer>Pas maintenant</button>
      <p class="demo">Prototype : aucun paiement, l'abonnement est simulé.</p>`);
    v.querySelectorAll(".formule").forEach((b) => b.addEventListener("click", () => { v.querySelectorAll(".formule").forEach((x) => x.classList.toggle("on", x === b)); }));
    v.querySelector(".formule").classList.add("on");
    v.querySelector("#pm-ok").addEventListener("click", () => {
      S.profil.premium = !S.profil.premium;
      AH.sauver();
      v.remove();
      AH.toast(S.profil.premium ? "Premium activé (simulation)" : "Version gratuite");
      if (ecranProfil) rendreProfil();
    });
  }

  /* ---------- publicité de fin de partie (simulée) ----------
     Règles : jamais pour un abonné, jamais après une partie très courte, et un délai minimum entre deux publicités. */
  const PUB = { partieMin: 40, delaiMin: 180, duree: 5 };
  let debutPartie = 0, dernierePub = 0, pubDue = false;
  document.addEventListener("ah:debut", () => { debutPartie = Date.now(); });
  function montrerPub() {
    const el = document.createElement("div");
    el.className = "pub";
    el.innerHTML = `<p class="pub-etiquette">Publicité</p><div class="pub-cadre"><b>Emplacement publicitaire</b><small>plein écran, entre deux parties</small></div>
      <button id="pub-premium" class="bouton">Supprimer les publicités</button><button id="pub-fermer" class="bouton plein" disabled></button>`;
    $("app").appendChild(el);
    const fermer = el.querySelector("#pub-fermer");
    let reste = PUB.duree;
    const tic = () => { fermer.textContent = reste > 0 ? `Continuer dans ${reste}` : "Continuer"; fermer.disabled = reste > 0; if (reste-- > 0) setTimeout(tic, 1000); };
    tic();
    fermer.addEventListener("click", () => el.remove());
    el.querySelector("#pub-premium").addEventListener("click", () => { el.remove(); offrePremium(); });
  }
  document.addEventListener("ah:accueil", () => {
    if (pubDue) { pubDue = false; dernierePub = Date.now(); montrerPub(); }
    else if (!S.profil.cree && S.stats.victoires > 0 && !S.profil.relance) { S.profil.relance = jour(); AH.sauver(); creerProfil("Sans profil, la progression n'est pas gardée"); }
  });

  /* ---------- classement : un onglet à part entière (données de démonstration) ---------- */
  let periode = "semaine";
  function rendreClassement() {
    const faux = { semaine: [["Camille", 2840], ["Noé", 2310], ["Inès", 1975], ["Lucas", 1620], ["Jade", 1380], ["Hugo", 990], ["Lina", 640], ["Tom", 410]],
      monde: [["Akira", 9120], ["Sofia", 8450], ["Camille", 7790], ["Liam", 6980], ["Noé", 6240], ["Mateo", 5510], ["Inès", 4870], ["Ella", 3960], ["Lucas", 2890], ["Jade", 1750]] };
    const moi = [S.profil.cree ? S.profil.nom : "Toi", S.record, true];
    const lignes = periode === "amis" ? [moi] : [...faux[periode], moi].sort((x, y) => y[1] - x[1]);
    const rang = lignes.findIndex((l) => l[2]) + 1, podium = lignes.slice(0, 3), suite = lignes.slice(3);
    const marche = (l, n) => l ? `<div class="marche m${n}${l[2] ? " moi" : ""}"><span class="avatar">${l[0][0]}</span><b>${l[0]}</b><i>${l[1]}</i><em>${n}</em></div>` : "";
    $("ecran-classement").innerHTML = `
      <div class="entete"><p class="surtitre">Classement</p><h2>Meilleurs scores</h2></div>
      <div class="onglets-cl">${[["semaine", "Semaine"], ["amis", "Amis"], ["monde", "Monde"]].map(([k, n]) => `<button data-p="${k}" class="${periode === k ? "on" : ""}">${n}</button>`).join("")}</div>
      <div class="cl-defile">
        ${periode === "amis" ? `<div class="cl-vide"><b>Invite tes amis</b><small>Le classement entre amis arrive avec les comptes.</small><button class="bouton plein" id="cl-inviter">Inviter</button></div>` : `
        <div class="podium">${marche(podium[1], 2)}${marche(podium[0], 1)}${marche(podium[2], 3)}</div>
        <ol class="classement" start="4">${suite.map((l, i) => `<li class="${l[2] ? "moi" : ""}"><span>${i + 4}</span><b>${l[0]}</b><i>${l[1]}</i></li>`).join("")}</ol>`}
        <p class="demo">Prototype : les autres joueurs sont fictifs, seul ton record est réel.</p>
      </div>
      <div class="cl-moi"><span>${periode === "amis" ? "–" : rang}</span><b>${moi[0]}</b><i>${S.record}</i><button id="cl-jouer" class="bouton plein">Battre mon record</button></div>`;
    document.querySelectorAll("#ecran-classement .onglets-cl button").forEach((b) => b.addEventListener("click", () => { periode = b.dataset.p; rendreClassement(); }));
    const inv = $("cl-inviter");
    if (inv) inv.addEventListener("click", () => AH.toast("L'invitation arrive avec les comptes"));
    $("cl-jouer").addEventListener("click", () => AH.aller("jouer"));
  }
  document.addEventListener("ah:ecran", (e) => { if (e.detail === "classement") rendreClassement(); });

  /* ---------- textes légaux et état du compte ---------- */
  function texte(titre, corps) {
    volet(`<p class="surtitre">Informations</p><h2>${titre}</h2><div class="texte-legal">${corps}</div><button class="bouton plein grand" data-fermer>Fermer</button>`);
  }
  const A_REDIGER = "<p>Texte à rédiger avant la mise en ligne.</p>";

  let ecranProfil = false;
  function rendreProfil() {
    const liste = AH.maListe(), acquises = liste.filter((p) => S.acquis[p.id]).length;
    const precision = S.stats.reponses ? Math.round((100 * S.stats.justes) / S.stats.reponses) : 0;
    const tempsMoyen = S.stats.reponses ? (S.stats.temps / S.stats.reponses).toFixed(1) : "–";
    const enr = Object.values(AH.ENR), cree = S.profil.cree;
    $("ecran-profil").innerHTML = `
      <div class="profil-defile">
        <div class="carte-profil">
          <span class="avatar">${(cree ? S.profil.nom : "?")[0].toUpperCase()}</span>
          <div class="qui"><b>${cree ? S.profil.nom : "Invité"}</b><small>${cree ? S.profil.email : "Progression non gardée"}</small></div>
          ${S.profil.premium ? '<span class="insigne">Premium</span>' : ""}
        </div>
        ${cree ? "" : '<button id="pf-creer" class="bouton plein grand">Créer mon profil</button>'}

        <div class="bloc serie">
          <div class="flamme"><b>${serie()}</b><small>jour${serie() > 1 ? "s" : ""} d'affilée</small></div>
          <div class="semaine">${semaine()}</div>
        </div>

        <div class="grille">
          <div><b>${acquises}</b><small>notes acquises</small></div>
          <div><b>${liste.length}<i> / ${AH.PIECES.length}</i></b><small>morceaux</small></div>
          <div><b>${S.record}</b><small>record</small></div>
          <div><b>${S.stats.parties}</b><small>parties</small></div>
          <div><b>${precision}<i> %</i></b><small>précision</small></div>
          <div><b>${tempsMoyen}<i> s</i></b><small>par réponse</small></div>
        </div>

        <button id="partager" class="ligne fort"><b>Partager mon clavier</b></button>

        <p class="rubrique">Abonnement</p>
        <button id="pm-ouvrir" class="ligne"><b>${S.profil.premium ? "Premium actif" : "Passer en Premium"}</b><em>${S.profil.premium ? "simulé" : "sans pub"}</em></button>
        <button class="ligne" id="pub-test"><b>Voir une publicité d'exemple</b></button>

        <p class="rubrique">Écouter ailleurs</p>
        <button class="ligne" data-bientot="La playlist Spotify sera liée ici"><b>Spotify</b><em>bientôt</em></button>
        <button class="ligne" data-bientot="La playlist Deezer sera liée ici"><b>Deezer</b><em>bientôt</em></button>
        <button class="ligne" data-bientot="La playlist Apple Music sera liée ici"><b>Apple Music</b><em>bientôt</em></button>

        <p class="rubrique">Réglages</p>
        <div class="ligne"><b>Nom des notes</b><span class="choix2" id="reg-notation"><button data-v="fr" class="${S.reglages.notation === "fr" ? "on" : ""}">do ré mi</button><button data-v="en" class="${S.reglages.notation === "en" ? "on" : ""}">C D E</button></span></div>
        <div class="ligne"><b>Vibrations</b><span class="choix2" id="reg-vibration"><button data-v="1" class="${S.reglages.vibration ? "on" : ""}">oui</button><button data-v="" class="${S.reglages.vibration ? "" : "on"}">non</button></span></div>
        <div class="ligne"><b>Rappel quotidien</b><em>bientôt</em></div>
        <button class="ligne" id="revoir"><b>Revoir l'introduction</b></button>
        <button class="ligne" id="installer" hidden><b>Installer l'application</b><em>gratuit</em></button>

        <p class="rubrique">Compte</p>
        <div class="ligne"><b>État</b><small class="droite">${cree ? "Profil créé le " + (S.profil.depuis || jour()).split("-").reverse().join("/") : "Invité"}</small></div>
        <div class="ligne"><b>Abonnement</b><small class="droite">${S.profil.premium ? "Premium (simulé)" : "Gratuit, avec publicités"}</small></div>
        ${cree ? '<button class="ligne" id="pf-modifier"><b>Modifier mon profil</b></button>' : ""}
        <button class="ligne" data-texte="Conditions d'utilisation"><b>Conditions d'utilisation</b></button>
        <button class="ligne" data-texte="Politique de confidentialité"><b>Politique de confidentialité</b></button>
        <button class="ligne" data-texte="Mentions légales"><b>Mentions légales</b></button>
        <button class="ligne" id="credits"><b>Crédits des enregistrements</b></button>
        <button class="ligne danger" id="remise"><b>${cree ? "Supprimer mon compte et mes données" : "Recommencer à zéro"}</b></button>
        <p class="version">First Note: Perfect Pitch · prototype</p>
      </div>`;
    const sur = (id, fn) => { const el = $(id); if (el) el.addEventListener("click", fn); };
    document.querySelectorAll("#ecran-profil [data-bientot]").forEach((b) => b.addEventListener("click", () => AH.toast(b.dataset.bientot)));
    document.querySelectorAll("#ecran-profil [data-texte]").forEach((b) => b.addEventListener("click", () => texte(b.dataset.texte, A_REDIGER)));
    document.querySelectorAll("#reg-notation button").forEach((b) => b.addEventListener("click", () => { S.reglages.notation = b.dataset.v; AH.sauver(); appliquerNotation(); rendreProfil(); AH.rendreAccueil(); }));
    document.querySelectorAll("#reg-vibration button").forEach((b) => b.addEventListener("click", () => { S.reglages.vibration = !!b.dataset.v; AH.sauver(); rendreProfil(); }));
    sur("pf-creer", () => creerProfil());
    sur("pf-modifier", () => creerProfil());
    sur("pm-ouvrir", offrePremium);
    sur("pub-test", montrerPub);
    sur("partager", partager);
    sur("revoir", accueillir);
    sur("credits", () => texte("Crédits", enr.map((e) => `<p><b>${e.titre}</b><br>${e.interprete || "interprète non précisé"} · ${e.licence}</p>`).join("") + "<p>Partitions : base PDMX (CC BY 4.0). Sons de piano : Salamander Grand Piano (CC BY 3.0).</p>"));
    sur("remise", () => {
      const b = $("remise");
      if (!b.dataset.sur) { b.dataset.sur = "1"; b.querySelector("b").textContent = "Toucher encore pour tout effacer"; return; }
      try { localStorage.removeItem("absolute-hear-3"); } catch (e) { /* ignoré */ }
      location.reload();
    });
    const inst = $("installer");
    inst.hidden = !invite;
    inst.addEventListener("click", async () => { if (invite) { invite.prompt(); invite = null; inst.hidden = true; } });
  }
  document.addEventListener("ah:ecran", (e) => { ecranProfil = e.detail === "profil"; if (ecranProfil) rendreProfil(); });

  /* ---------- partage : une image de son clavier ---------- */
  async function partager() {
    const L = 1080, H = 1350, c = document.createElement("canvas");
    c.width = L; c.height = H;
    const x = c.getContext("2d"), niv = AH.niveauxTouches();
    const fond = x.createRadialGradient(L / 2, H * 0.3, 50, L / 2, H * 0.3, H);
    fond.addColorStop(0, "#2a2440"); fond.addColorStop(0.6, "#16141d"); fond.addColorStop(1, "#0f0e14");
    x.fillStyle = fond; x.fillRect(0, 0, L, H);
    const somme = Object.values(niv).reduce((a, n) => a + n, 0), pct = Math.round((100 * somme) / (88 * 5));
    x.textAlign = "center";
    x.fillStyle = "#e9c27a"; x.font = "600 30px sans-serif"; x.fillText("F I R S T   N O T E", L / 2, 150);
    x.fillStyle = "#fff3d6"; x.font = "600 300px Georgia, serif"; x.fillText(pct + " %", L / 2, 560);
    x.fillStyle = "#a7a1b2"; x.font = "34px sans-serif"; x.fillText("O R E I L L E   A B S O L U E", L / 2, 640);
    const lb = (L - 80) / 52, y0 = 760, hb = lb * 6.4;
    let b = 0;
    const noires = [];
    for (let m = 21; m <= 108; m++) {
      const n = niv[m] || 0, col = AH.COULEURS[m % 12];
      if ([1, 3, 6, 8, 10].includes(m % 12)) { noires.push([40 + b * lb - lb * 0.29, n, col]); continue; }
      x.globalAlpha = 1; x.fillStyle = "#2b2931"; x.fillRect(40 + b * lb, y0, lb - 2, hb);
      if (n) { x.globalAlpha = 0.25 + 0.15 * n; x.fillStyle = col; x.fillRect(40 + b * lb, y0, lb - 2, hb); }
      b++;
    }
    noires.forEach(([px, n, col]) => {
      x.globalAlpha = 1; x.fillStyle = "#050408"; x.fillRect(px, y0, lb * 0.58, hb * 0.63);
      if (n) { x.globalAlpha = 0.25 + 0.1 * n; x.fillStyle = col; x.fillRect(px, y0, lb * 0.58, hb * 0.63); }
    });
    x.globalAlpha = 1;
    x.fillStyle = "#f3efe6"; x.font = "600 60px Georgia, serif";
    x.fillText(`${Object.keys(niv).length} touches allumées · record ${S.record}`, L / 2, 1100);
    const blob = await new Promise((r) => c.toBlob(r, "image/png"));
    const fichier = new File([blob], "first-note.png", { type: "image/png" });
    try {
      if (navigator.canShare && navigator.canShare({ files: [fichier] })) { await navigator.share({ files: [fichier], title: "First Note: Perfect Pitch" }); return; }
    } catch (e) { if (e.name === "AbortError") return; }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "first-note.png"; a.click();
    AH.toast("Image enregistrée");
  }

  /* ---------- introduction : quatre écrans animés qui montrent la mécanique ---------- */
  const INTRO = [
    "Écouter la note",
    "Retrouver le morceau",
    "Apprenez la note qui correspond",
    "Apprenez, recommencez, et obtenez l'oreille absolue !",
  ];
  const C = AH.COULEURS;
  const alea = (i, k) => { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };
  const doux = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };

  function anneau(ctx, x, y, r, couleur, alpha, epais, t, graine) {
    if (r <= 1 || alpha <= 0.01) return;
    ctx.beginPath();
    for (let n = 0; n <= 72; n++) {
      const th = (n / 72) * Math.PI * 2;
      const rr = r * (1 + 0.035 * Math.sin(4 * th + graine + t * 0.9) + 0.02 * Math.sin(9 * th - t * 1.3 + graine * 2));
      const px = x + Math.cos(th) * rr, py = y + Math.sin(th) * rr;
      if (n) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.strokeStyle = couleur;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = epais;
    ctx.stroke();
  }
  function nappe(ctx, x, y, r, couleur, alpha) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, couleur);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  function noteDessin(ctx, x, y, e, couleur) {
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = 1;
    ctx.fillStyle = couleur;
    ctx.strokeStyle = couleur;
    ctx.shadowColor = couleur;
    ctx.shadowBlur = 24 * e;
    ctx.save(); ctx.rotate(-0.35); ctx.beginPath(); ctx.ellipse(0, 0, 17 * e, 12 * e, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.lineWidth = 4 * e; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(14.5 * e, -4 * e); ctx.lineTo(14.5 * e, -66 * e); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(14.5 * e, -66 * e); ctx.bezierCurveTo(22 * e, -50 * e, 40 * e, -46 * e, 32 * e, -22 * e); ctx.lineWidth = 3.4 * e; ctx.stroke();
    ctx.restore();
  }

  /* Une petite partition stylisée : deux portées, quelques notes. */
  function partitionDessin(ctx, w, h, coul, graine, force, premiere) {
    ctx.globalAlpha = 0.13 + 0.5 * force;
    ctx.fillStyle = coul;
    ctx.beginPath(); ctx.roundRect(-w * 0.44, -h * 0.4, w * 0.88, h * 0.8, w * 0.07); ctx.fill();
    ctx.globalAlpha = 0.7 + 0.3 * force;
    ctx.strokeStyle = coul; ctx.lineWidth = Math.max(1, w * 0.012) * (1 + force);
    ctx.shadowColor = coul; ctx.shadowBlur = 30 * force;
    ctx.stroke();
    ctx.shadowBlur = 0; ctx.lineWidth = Math.max(0.7, w * 0.008);
    const pas = h * 0.028;
    for (let p2 = 0; p2 < 2; p2++) {
      const py = -h * 0.2 + p2 * h * 0.36;
      for (let l = 0; l < 5; l++) { ctx.beginPath(); ctx.moveTo(-w * 0.34, py + l * pas); ctx.lineTo(w * 0.34, py + l * pas); ctx.stroke(); }
      for (let n = 0; n < 5; n++) {
        ctx.fillStyle = force > 0.5 || (premiere && p2 === 0 && n === 0) ? "#fff" : coul;
        ctx.beginPath(); ctx.ellipse(-w * 0.26 + n * w * 0.13, py + alea(graine * 7 + n, p2 + 4) * pas * 4, w * 0.03, w * 0.022, -0.3, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  /* 1. La note arrive, se pose, puis reste là : c'est d'elle que partent les ondes, sans interruption. */
  function scene1(ctx, L, H, t) {
    const cx = L / 2, cy = H * 0.4, pose = 0.75;
    const y = t < pose ? -80 + (cy + 80) * Math.pow(t / pose, 2) : cy + Math.sin((t - pose) * 1.5) * 7 - 18 * Math.exp(-(t - pose) * 5) * Math.abs(Math.sin((t - pose) * 12));
    if (t > pose) {
      const a = t - pose, monte = Math.min(1, a / 0.6);
      nappe(ctx, cx, cy, L * 0.85, C[Math.floor(a / 2.4) % 12], 0.22 * monte);
      for (let j = 0; j < 11; j++) { // onze ondes en route en permanence, chacune d'une couleur
        const k = ((j / 11 + a * 0.16) % 1 + 1) % 1, gen = Math.floor(j / 11 + a * 0.16);
        anneau(ctx, cx, cy + 4, 34 + k * L * 0.95, C[(gen * 11 + j * 5) % 12], Math.pow(1 - k, 1.4) * Math.min(1, k * 10) * monte, 1 + 1.8 * (1 - k), t, j);
      }
    }
    ctx.save();
    ctx.translate(cx - 6, y); ctx.rotate(Math.sin(t * 1.1) * 0.07);
    noteDessin(ctx, 0, 0, 1.35, "#fffaf0");
    ctx.restore();
  }

  /* 2. Un pavage de partitions, de biais, qui défile sans fin ; certaines scintillent : il y en a beaucoup, il faut trouver la bonne. */
  function scene2(ctx, L, H, t) {
    const w = L / 3.4, h = w * 1.28, pasX = w * 0.96, pasY = h * 0.86, glisse = t * 22;
    ctx.save();
    ctx.translate(L / 2, H * 0.36); ctx.rotate(-0.32);
    const decale = Math.floor(glisse / pasX);
    for (let r = -4; r <= 4; r++) {
      for (let c = -4; c <= 4; c++) {
        const col = c - decale, i = Math.abs(col * 31 + r * 17 + 500);
        const x = c * pasX + (glisse % pasX) + (r % 2 ? pasX / 2 : 0), y = r * pasY;
        const entree = doux((t - alea(i, 9) * 0.9) / 0.8);
        const eclat = Math.pow(Math.max(0, Math.sin(t * 1.1 + alea(i, 3) * 60)), 10); // scintillement
        ctx.save();
        ctx.translate(x, y); ctx.scale(0.55 + 0.4 * entree + 0.08 * eclat, 0.55 + 0.4 * entree + 0.08 * eclat);
        ctx.globalAlpha = 1;
        partitionDessin(ctx, w, h, C[(i * 5) % 12], i, eclat * entree, false);
        ctx.restore();
      }
    }
    ctx.restore();
    ctx.globalCompositeOperation = "source-over"; // le pavage s'efface vers le bas, sous le texte
    const voile = ctx.createLinearGradient(0, H * 0.5, 0, H * 0.78);
    voile.addColorStop(0, "rgba(15,14,20,0)"); voile.addColorStop(1, "rgba(15,14,20,1)");
    ctx.globalAlpha = 1; ctx.fillStyle = voile; ctx.fillRect(0, H * 0.5, L, H * 0.5);
    ctx.globalCompositeOperation = "lighter";
  }

  /* 3. Une partition, un nom de note : le nom est attiré, s'accroche à la partition, et les deux ne se quittent plus. */
  function scene3(ctx, L, H, t) {
    const cx = L / 2, cy = H * 0.38, w = L * 0.56, h = w * 1.28, coul = C[0];
    const arrive = doux(t / 0.8), attire = Math.min(1, Math.max(0, (t - 1.3) / 0.55));
    const colle = attire < 1 ? attire * attire * attire : 1; // l'aimant accélère jusqu'au contact
    const apres = Math.max(0, t - 1.85), choc = Math.exp(-apres * 4) * (apres > 0 ? 1 : 0);
    const bascule = apres > 0 ? Math.sin(apres * 0.9) * 0.16 : 0, largeur = apres > 0 ? 0.86 + 0.14 * Math.cos(apres * 1.1) : 1;
    if (apres > 0) {
      nappe(ctx, cx, cy, L * 0.8, coul, 0.2 + 0.25 * choc);
      for (let j = 0; j < 7; j++) { const k = ((j / 7 + apres * 0.14) % 1 + 1) % 1; anneau(ctx, cx, cy, w * 0.5 + k * L * 0.7, coul, Math.pow(1 - k, 1.5) * 0.7 * Math.min(1, k * 10), 1.2, t, j); }
    }
    ctx.save();
    ctx.translate(cx, cy + (1 - arrive) * H * 0.5); ctx.rotate(bascule - 0.05 * (1 - colle)); ctx.scale(largeur * (1 + 0.07 * choc), 1 + 0.07 * choc);
    ctx.globalAlpha = 1;
    partitionDessin(ctx, w, h, coul, 3, 0.25 * colle + 0.5 * choc, colle >= 1);
    // le nom de la note : il flotte à distance, puis l'aimant le plaque sur la première note de la partition
    const bx = -w * 0.26, by = -h * 0.2 - h * 0.13, loin = 1 - colle;
    const fx = bx + loin * (w * 0.95 + Math.sin(t * 2.3) * 10) * (0.35 + 0.65 * (1 - arrive) + 0.65 * arrive), fy = by - loin * (h * 0.42 + Math.cos(t * 1.9) * 12);
    const taille = w * (0.3 - 0.1 * colle) * (1 + 0.35 * choc);
    if (loin > 0.02 && arrive > 0.5) { // le lien d'attraction
      ctx.setLineDash([3, 6]); ctx.strokeStyle = "#fff"; ctx.globalAlpha = 0.35 + 0.5 * attire; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(bx, by); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.globalAlpha = arrive;
    ctx.fillStyle = coul; ctx.shadowColor = coul; ctx.shadowBlur = 26;
    ctx.beginPath(); ctx.arc(fx, fy, taille * 0.78, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0; ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#14121a"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = `600 ${taille * 0.78}px Fraunces, Georgia, serif`;
    ctx.fillText("do", fx, fy + taille * 0.04);
    ctx.globalCompositeOperation = "lighter";
    ctx.restore();
  }

  /* 4. L'oreille au centre, des ondes de toutes les couleurs, et le cycle « apprendre, recommencer ». */
  function oreille(ctx, x, y, e) {
    ctx.save();
    ctx.translate(x, y); ctx.scale(e, e);
    const g = ctx.createLinearGradient(-50, -80, 60, 80);
    [C[0], C[2], C[4], C[7], C[9], C[11]].forEach((c, i) => g.addColorStop(i / 5, c));
    ctx.strokeStyle = g; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.globalAlpha = 1;
    ctx.shadowColor = "#fff"; ctx.shadowBlur = 14;
    ctx.lineWidth = 10; // pavillon
    ctx.beginPath(); ctx.moveTo(-30, -18); ctx.bezierCurveTo(-36, -74, 46, -84, 46, -22); ctx.bezierCurveTo(46, 12, 18, 22, 16, 48); ctx.bezierCurveTo(14, 72, -16, 76, -26, 54); ctx.stroke();
    ctx.lineWidth = 8; // repli intérieur
    ctx.beginPath(); ctx.moveTo(-10, -22); ctx.bezierCurveTo(-12, -52, 26, -54, 24, -22); ctx.bezierCurveTo(23, -6, 6, 2, 2, 16); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-6, 2); ctx.bezierCurveTo(-18, 6, -14, 26, -2, 22); ctx.stroke();
    ctx.restore();
  }
  const logo = new Image();
  logo.src = "logo-signe.svg";
  function scene4(ctx, L, H, t) {
    const cx = L / 2, cy = H * 0.38, R = L * 0.95;
    nappe(ctx, cx, cy, L * 0.9, C[Math.floor(t * 0.5) % 12], 0.16);
    for (let i = 0; i < 26; i++) { // ondes multicolores, de plus en plus larges
      const k = ((i / 26 + t * 0.05) % 1 + 1) % 1;
      anneau(ctx, cx, cy, 96 + k * (R - 96), C[(i * 5) % 12], Math.pow(1 - k, 1.5) * 0.85 * Math.min(1, k * 14), 0.7 + 1.2 * (1 - k), t, i);
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1; ctx.fillStyle = "#14121a";
    ctx.beginPath(); ctx.arc(cx, cy, 92, 0, Math.PI * 2); ctx.fill();
    if (logo.complete && logo.naturalWidth) { ctx.globalAlpha = 1; ctx.drawImage(logo, cx - 100, cy - 100, 200, 200); } // le logo de l'appli
    else oreille(ctx, cx - 4, cy, 0.92); // repli si l'image n'est pas chargée
    for (let k = 0; k < 2; k++) { // deux flèches qui tournent : on apprend, on recommence
      const a0 = t * 0.9 + k * Math.PI, a1 = a0 + 2.1, r = 124;
      ctx.strokeStyle = "#fff3d6"; ctx.fillStyle = "#fff3d6"; ctx.globalAlpha = 0.9; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.shadowColor = "#e9c27a"; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1); ctx.stroke();
      const px = cx + Math.cos(a1) * r, py = cy + Math.sin(a1) * r;
      ctx.save(); ctx.translate(px, py); ctx.rotate(a1 + Math.PI / 2);
      ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-8, -10); ctx.lineTo(-8, 10); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.shadowBlur = 0;
  }
  const SCENES = [scene1, scene2, scene3, scene4];

  function accueillir() {
    let i = 0, t0 = performance.now(), id = 0;
    const el = document.createElement("div");
    el.className = "bienvenue";
    el.innerHTML = '<canvas></canvas><h2></h2><div class="points"></div><button class="bouton plein grand"></button>';
    const toile = el.querySelector("canvas"), ctx = toile.getContext("2d");
    const rendre = () => {
      t0 = performance.now();
      const h = el.querySelector("h2");
      h.textContent = INTRO[i];
      h.style.animation = "none"; void h.offsetWidth; h.style.animation = "";
      el.querySelector(".points").innerHTML = INTRO.map((_, j) => `<i class="${j === i ? "ok" : ""}"></i>`).join("");
      el.querySelector("button").textContent = i === INTRO.length - 1 ? "Jouer" : "Suivant";
    };
    function image(maintenant) {
      const ratio = Math.min(2, window.devicePixelRatio || 1), L = toile.clientWidth, H = toile.clientHeight;
      if (toile.width !== Math.round(L * ratio) || toile.height !== Math.round(H * ratio)) { toile.width = Math.round(L * ratio); toile.height = Math.round(H * ratio); }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      ctx.clearRect(0, 0, L, H);
      ctx.globalCompositeOperation = "lighter";
      SCENES[i](ctx, L, H, (maintenant - t0) / 1000);
      id = requestAnimationFrame(image);
    }
    el.querySelector("button").addEventListener("click", () => {
      if (++i < INTRO.length) return rendre();
      cancelAnimationFrame(id);
      S.profil.accueilVu = true;
      AH.sauver();
      el.remove();
    });
    $("app").appendChild(el);
    rendre();
    id = requestAnimationFrame(image);
  }
  if (!S.profil.accueilVu) accueillir();

  /* ---------- installation sur l'écran d'accueil et usage hors ligne ---------- */
  let invite = null;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); invite = e; const b = $("installer"); if (b) b.hidden = false; });
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
