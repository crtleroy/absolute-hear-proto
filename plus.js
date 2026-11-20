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
        <button class="ligne" id="revoir"><b>Revoir l'introduction</b></button>
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
    $("revoir").addEventListener("click", accueillir);
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

  /* ---------- introduction : quatre écrans animés qui montrent la mécanique ---------- */
  const INTRO = [
    "Écouter la note",
    "Retrouver le morceau",
    "Puis retrouver le nom de la note",
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

  /* 1. Une note tombe, touche le centre, et son onde se répand. */
  function scene1(ctx, L, H, t) {
    const cycle = 2.8, u = (t % cycle) / cycle, coul = C[(Math.floor(t / cycle) * 5 + 10) % 12];
    const cx = L / 2, cy = H * 0.4;
    const y = u < 0.28 ? -60 + (cy + 60) * Math.pow(u / 0.28, 2) : cy - 14 * Math.exp(-(u - 0.28) * 9) * Math.abs(Math.sin((u - 0.28) * 22));
    if (u >= 0.28) {
      const k = (u - 0.28) / 0.72;
      nappe(ctx, cx, cy, 60 + k * L * 0.9, coul, 0.42 * Math.pow(1 - k, 1.4));
      for (let j = 0; j < 9; j++) anneau(ctx, cx, cy + 6, k * L * 0.95 - j * 24, coul, Math.pow(1 - k, 1.3) * (1 - j * 0.09), 1 + 1.6 * (1 - k), t, j);
    }
    noteDessin(ctx, cx - 6, y, 1.35, "#fffaf0");
  }

  /* 2. Des partitions de toutes les couleurs arrivent de partout et s'assemblent en pavage ; l'une d'elles s'illumine. */
  function scene2(ctx, L, H, t) {
    const cols = 4, rangs = 5, w = L / (cols + 0.5), h = w * 1.28, x0 = (L - cols * w) / 2 + w / 2, y0 = H * 0.06 + h / 2;
    const cycle = 6, u = t % cycle, sortie = doux((u - 5.1) / 0.8), elue = 9;
    for (let i = 0; i < cols * rangs; i++) {
      const p = doux((u - 0.15 - i * 0.07) / 1.1) * (1 - sortie);
      const tx = x0 + (i % cols) * w, ty = y0 + Math.floor(i / cols) * h * 0.86;
      const sx = L / 2 + (alea(i, 1) - 0.5) * L * 2.4, sy = H * 0.4 + (alea(i, 2) - 0.5) * H * 1.8;
      const x = sx + (tx - sx) * p, y = sy + (ty - sy) * p, rot = (alea(i, 3) - 0.5) * 3 * (1 - p), coul = C[(i * 5) % 12];
      const choisie = i === elue ? doux((u - 2.6) / 0.6) * (1 - sortie) : 0, ech = 0.9 + 0.22 * choisie;
      ctx.save();
      ctx.translate(x, y); ctx.rotate(rot); ctx.scale(ech, ech);
      ctx.globalAlpha = (0.14 + 0.5 * choisie) * (0.25 + 0.75 * p);
      ctx.fillStyle = coul;
      ctx.beginPath(); ctx.roundRect(-w * 0.44, -h * 0.4, w * 0.88, h * 0.8, 8); ctx.fill();
      ctx.globalAlpha = (0.75 + 0.25 * choisie) * (0.2 + 0.8 * p);
      ctx.strokeStyle = coul; ctx.lineWidth = 1.2 + choisie * 1.5;
      if (choisie) { ctx.shadowColor = coul; ctx.shadowBlur = 26 * choisie; }
      ctx.stroke();
      ctx.shadowBlur = 0; ctx.lineWidth = 0.8;
      for (let p2 = 0; p2 < 2; p2++) { // deux portées de cinq lignes, quelques notes
        const py = -h * 0.2 + p2 * h * 0.36;
        for (let l = 0; l < 5; l++) { ctx.beginPath(); ctx.moveTo(-w * 0.34, py + l * 3.4); ctx.lineTo(w * 0.34, py + l * 3.4); ctx.stroke(); }
        ctx.fillStyle = choisie ? "#fff" : coul;
        for (let n = 0; n < 5; n++) { ctx.beginPath(); ctx.ellipse(-w * 0.26 + n * w * 0.13, py + alea(i * 7 + n, p2 + 4) * 15 - 1, 2.6, 2, -0.3, 0, Math.PI * 2); ctx.fill(); }
      }
      ctx.restore();
    }
  }

  /* 3. Les noms des notes flottent ; l'un après l'autre, ils viennent au centre. */
  const NOMS = [["do", 0], ["ré", 2], ["mi", 4], ["fa", 5], ["sol", 7], ["la", 9], ["si", 11], ["do♯", 1], ["mi♭", 3], ["fa♯", 6], ["la♭", 8], ["si♭", 10], ["C", 0], ["D", 2], ["E", 4], ["F", 5], ["G", 7], ["A", 9], ["B", 11], ["F♯", 6], ["B♭", 10], ["sol", 7], ["ré", 2], ["la", 9]];
  function scene3(ctx, L, H, t) {
    const cycle = 2.4, elu = Math.floor(t / cycle) % NOMS.length, u = (t % cycle) / cycle, cx = L / 2, cy = H * 0.38;
    const vers = doux(u * 3) * (1 - doux((u - 0.82) * 6)), coulElu = C[NOMS[elu][1]];
    nappe(ctx, cx, cy, L * 0.8, coulElu, 0.3 * vers);
    for (let j = 0; j < 6; j++) anneau(ctx, cx, cy, (70 + j * 30 + u * 60) * vers, coulElu, vers * (0.7 - j * 0.1), 1.3, t, j);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    NOMS.forEach(([nom, pc], i) => {
      const bx = L * (0.08 + 0.84 * alea(i, 5)) + Math.sin(t * 0.5 + i * 1.7) * 16, by = H * (0.06 + 0.62 * alea(i, 6)) + Math.cos(t * 0.4 + i * 2.3) * 14;
      const k = i === elu ? vers : 0, taille = (16 + alea(i, 7) * 26) * (1 - k) + 104 * k;
      ctx.font = `600 ${taille}px Fraunces, Georgia, serif`;
      ctx.fillStyle = k > 0.5 ? "#fff" : C[pc];
      ctx.shadowColor = C[pc]; ctx.shadowBlur = 8 + 30 * k;
      ctx.globalAlpha = (0.3 + 0.5 * alea(i, 8)) * (1 - k) + k;
      ctx.fillText(nom, bx + (cx - bx) * k, by + (cy - by) * k);
    });
    ctx.shadowBlur = 0;
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
    oreille(ctx, cx - 4, cy, 0.92);
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
      if (toile.width !== Math.round(L * ratio)) { toile.width = Math.round(L * ratio); toile.height = Math.round(H * ratio); }
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
