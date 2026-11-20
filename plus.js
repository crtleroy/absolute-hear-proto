/* Absolute Hear — les éléments d'application autour du jeu : profil, série, statistiques, réglages, partage,
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
  function rendreProfil() {
    const liste = AH.maListe(), acquises = liste.filter((p) => S.acquis[p.id]).length;
    const precision = S.stats.reponses ? Math.round((100 * S.stats.justes) / S.stats.reponses) : 0;
    const tempsMoyen = S.stats.reponses ? (S.stats.temps / S.stats.reponses).toFixed(1) : "–";
    const enr = Object.values(AH.ENR);
    $("ecran-profil").innerHTML = `
      <div class="profil-defile">
        <div class="carte-profil">
          <span class="avatar">${S.profil.nom[0].toUpperCase()}</span>
          <div class="qui"><b>${S.profil.nom}</b><small>Progression gardée sur cet appareil</small></div>
        </div>
        <button class="ligne compte" data-bientot="La connexion arrive avec la sauvegarde en ligne"><span class="g">G</span><b>Continuer avec Google</b><em>bientôt</em></button>

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

        <button id="partager" class="bouton plein grand">Partager mon clavier</button>

        <p class="rubrique">Écouter ailleurs</p>
        <button class="ligne" data-bientot="La playlist Spotify sera liée ici"><b>Spotify</b><em>bientôt</em></button>
        <button class="ligne" data-bientot="La playlist Deezer sera liée ici"><b>Deezer</b><em>bientôt</em></button>
        <button class="ligne" data-bientot="La playlist Apple Music sera liée ici"><b>Apple Music</b><em>bientôt</em></button>

        <p class="rubrique">Réglages</p>
        <div class="ligne"><b>Nom des notes</b><span class="choix2" id="reg-notation"><button data-v="fr" class="${S.reglages.notation === "fr" ? "on" : ""}">do ré mi</button><button data-v="en" class="${S.reglages.notation === "en" ? "on" : ""}">C D E</button></span></div>
        <div class="ligne"><b>Vibrations</b><span class="choix2" id="reg-vibration"><button data-v="1" class="${S.reglages.vibration ? "on" : ""}">oui</button><button data-v="" class="${S.reglages.vibration ? "" : "on"}">non</button></span></div>
        <button class="ligne" id="installer" hidden><b>Installer l'application</b><em>gratuit</em></button>
        <button class="ligne" data-bientot="L'offre complète arrive avec le catalogue étendu"><b>Version complète</b><em>bientôt</em></button>
        <button class="ligne danger" id="remise"><b>Recommencer à zéro</b></button>

        <p class="rubrique">Crédits</p>
        <details class="credits"><summary>Enregistrements et partitions</summary>
          ${enr.map((e) => `<p><b>${e.titre}</b> · ${e.interprete || "interprète non précisé"} · ${e.licence} · <a href="${e.source}" target="_blank" rel="noopener">source</a></p>`).join("")}
          <p>Partitions : base PDMX (CC BY 4.0). Sons de piano : Salamander Grand Piano (CC BY 3.0).</p>
        </details>
        <details class="credits"><summary>Confidentialité</summary><p>Ta progression reste sur cet appareil. Aucun compte, aucun suivi, aucune donnée envoyée.</p></details>
        <p class="version">Absolute Hear · prototype</p>
      </div>`;
    document.querySelectorAll("#ecran-profil [data-bientot]").forEach((b) => b.addEventListener("click", () => AH.toast(b.dataset.bientot)));
    document.querySelectorAll("#reg-notation button").forEach((b) => b.addEventListener("click", () => { S.reglages.notation = b.dataset.v; AH.sauver(); appliquerNotation(); rendreProfil(); AH.rendreAccueil(); }));
    document.querySelectorAll("#reg-vibration button").forEach((b) => b.addEventListener("click", () => { S.reglages.vibration = !!b.dataset.v; AH.sauver(); rendreProfil(); }));
    $("partager").addEventListener("click", partager);
    $("remise").addEventListener("click", () => {
      const b = $("remise");
      if (!b.dataset.sur) { b.dataset.sur = "1"; b.querySelector("b").textContent = "Toucher encore pour tout effacer"; return; }
      try { localStorage.removeItem("absolute-hear-3"); } catch (e) { /* ignoré */ }
      location.reload();
    });
    const inst = $("installer");
    inst.hidden = !invite;
    inst.addEventListener("click", async () => { if (invite) { invite.prompt(); invite = null; inst.hidden = true; } });
  }
  document.addEventListener("ah:ecran", (e) => { if (e.detail === "profil") rendreProfil(); });

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
    x.fillStyle = "#e9c27a"; x.font = "600 30px sans-serif"; x.fillText("A B S O L U T E   H E A R", L / 2, 150);
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
    const fichier = new File([blob], "absolute-hear.png", { type: "image/png" });
    try {
      if (navigator.canShare && navigator.canShare({ files: [fichier] })) { await navigator.share({ files: [fichier], title: "Absolute Hear" }); return; }
    } catch (e) { if (e.name === "AbortError") return; }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "absolute-hear.png"; a.click();
    AH.toast("Image enregistrée");
  }

  /* ---------- premier lancement : trois écrans, presque sans texte ---------- */
  function accueillir() {
    const pages = [
      { visuel: '<span class="orbe demo"><svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>', titre: "Une note" },
      { visuel: '<span class="cartes-demo"><i>Nocturne</i><i class="bon">Gymnopédie</i></span>', titre: "Un morceau" },
      { visuel: '<span class="clavier-demo">' + AH.COULEURS.map((c, i) => `<i style="--c:${c};animation-delay:${i * 0.12}s"></i>`).join("") + "</span>", titre: "Ton clavier s'allume" },
    ];
    let i = 0;
    const el = document.createElement("div");
    el.className = "bienvenue";
    const rendre = () => {
      el.innerHTML = `<div class="visuel">${pages[i].visuel}</div><h2>${pages[i].titre}</h2>
        <div class="points">${pages.map((_, j) => `<i class="${j === i ? "ok" : ""}"></i>`).join("")}</div>
        <button class="bouton plein grand">${i === pages.length - 1 ? "Jouer" : "Suivant"}</button>`;
      el.querySelector("button").addEventListener("click", () => {
        if (++i < pages.length) return rendre();
        S.profil.accueilVu = true;
        AH.sauver();
        el.remove();
      });
    };
    rendre();
    $("app").appendChild(el);
  }
  if (!S.profil.accueilVu) accueillir();

  /* ---------- installation sur l'écran d'accueil et usage hors ligne ---------- */
  let invite = null;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); invite = e; const b = $("installer"); if (b) b.hidden = false; });
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
