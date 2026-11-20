/* Absolute Hear — prototype d'application.
   Données : data/pieces.js (window.PIECES, du plus connu au moins connu) et data/enregistrements.js (window.ENREGISTREMENTS). */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const PIECES = window.PIECES || [];
  const PAR_ID = Object.fromEntries(PIECES.map((p) => [p.id, p]));
  const ENR = Object.fromEntries((window.ENREGISTREMENTS || []).map((e) => [e.titre, e]));
  const EN = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
  const FR = ["do", "do♯", "ré", "mi♭", "mi", "fa", "fa♯", "sol", "la♭", "la", "si♭", "si"];
  const NOIRES = [1, 3, 6, 8, 10];

  /* ---------- règles du jeu ---------- */
  const DEPART = 2; // morceaux dans la liste au tout début
  const VIES = 3;
  const PALIERS = ["2 choix", "4 choix", "compositeur, morceau", "compositeur, type, numéro", "la note seule"]; // échelle du morceau
  const NIVEAUX_NOTE = 3; // échelle de la note : 2 notes, 4 notes, puis le clavier
  const DERNIER = PALIERS.length - 1;
  const DEMI_VIE = 6; // les points en jeu sont divisés par deux toutes les 6 secondes
  const COEF_NOTES = [1, 0.75, 0.5, 0.35]; // selon le nombre de notes entendues (1 à 4)
  const COEF_ECOUTE = 0.2; // après « le début »
  const INTRO = 2.6; // en écoute synthétique : la première note seule, puis le morceau
  const ENTRACTE = 700; // silence entre deux morceaux, en millisecondes

  /* Une couleur par note : arc-en-ciel continu sur les douze demi-tons (do rouge, ré jaune, mi vert, sol bleu, la violet…),
     pour que deux notes voisines aient deux couleurs voisines. */
  const COULEURS = Array.from({ length: 12 }, (_, i) => {
    const h = i * 30, sat = 0.85, lum = 0.62, a = sat * Math.min(lum, 1 - lum);
    const f = (n) => { const k = (n + h / 30) % 12; return Math.round(255 * (lum - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, "0"); };
    return "#" + f(0) + f(8) + f(4);
  });
  const couleur = (p) => COULEURS[p.midis[0] % 12];
  const sci = (m) => EN[m % 12] + (Math.floor(m / 12) - 1);
  const pc = (p) => p.midis[0] % 12;
  const nomCourt = (p) => FR[pc(p)];
  const nomLong = (p) => (p.midis.length > 1 ? `${FR[pc(p)]} en octaves · ${p.midis.map(sci).join(" + ")}` : `${FR[pc(p)]} · ${sci(p.midis[0])}`);
  const melange = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const uniques = (a) => [...new Set(a)];
  const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
  /* « Nocturne op. 9 n°2 » → forme « Nocturne », numéro « op. 9 n°2 » */
  PIECES.forEach((p) => {
    const m = p.titre.match(/^(.*?)\s+((?:op\.|n°|BWV|en |«|\().*)$/);
    p.forme = m ? m[1] : p.titre;
    p.numero = m ? m[2] : "";
  });
  const ICONE = {
    lire: '<svg viewBox="0 0 24 24" width="46%" height="46%" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" width="46%" height="46%" fill="currentColor"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>',
  };

  /* ---------- motif : houle dorée en aplats ---------- */
  function vague(couleur, periode, haut, ampl) {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${periode} 100' preserveAspectRatio='none'><path fill='${couleur}' d='M0 ${haut} Q${periode / 4} ${haut - 2 * ampl} ${periode / 2} ${haut} T${periode} ${haut} V100 H0Z'/></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }
  const racine = document.documentElement.style;
  racine.setProperty("--v1", vague("#8f6a2c", 120, 22, 7));
  racine.setProperty("--v2", vague("#d9ae62", 180, 50, 8));
  racine.setProperty("--v3", vague("#fff0c8", 240, 76, 6));

  /* ---------- état persistant ---------- */
  let S = { liste: [], palier: {}, niveauNote: {}, acquis: {}, points: 0, record: 0 };
  try { S = Object.assign(S, JSON.parse(localStorage.getItem("absolute-hear-3") || "{}")); } catch (e) { /* stockage indisponible */ }
  S.liste = S.liste.filter((id) => PAR_ID[id]);
  if (S.liste.length < DEPART) S.liste = PIECES.slice(0, DEPART).map((p) => p.id);
  const sauver = () => { try { localStorage.setItem("absolute-hear-3", JSON.stringify(S)); } catch (e) { /* ignoré */ } };
  const maListe = () => S.liste.map((id) => PAR_ID[id]);
  const palier = (p) => Math.min(DERNIER, S.palier[p.id] || 0);
  const niveauNote = (p) => S.niveauNote[p.id] || 0;
  const prochain = () => PIECES.find((p) => !S.liste.includes(p.id));

  let toastTimer;
  function toast(texte) {
    const t = $("toast");
    t.textContent = texte;
    t.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("visible"), 2600);
  }

  /* ---------- son ----------
     Deux sources : un vrai enregistrement (balise audio) quand il existe, sinon le piano échantillonné qui rejoue la partition.
     Les notes du jeu (une note, + 1 note) passent toujours par le piano échantillonné. */
  let piano = null, pianoPret = null;
  function pretAudio() {
    if (!pianoPret) {
      pianoPret = (async () => {
        await Tone.start();
        const urls = {};
        ["A0", "C1", "D#1", "F#1", "A1", "C2", "D#2", "F#2", "A2", "C3", "D#3", "F#3", "A3", "C4", "D#4", "F#4", "A4", "C5", "D#5", "F#5", "A5", "C6", "D#6", "F#6", "A6", "C7", "D#7", "F#7", "A7", "C8"]
          .forEach((n) => { urls[n] = n.replace("#", "s") + ".mp3"; });
        toast("Chargement du piano…");
        piano = new Tone.Sampler({ urls, release: 1.2, baseUrl: "https://tonejs.github.io/audio/salamander/" }).toDestination();
        await Tone.loaded();
      })().catch((e) => { pianoPret = null; toast("Le piano n'a pas pu se charger (connexion ?)"); throw e; });
    }
    return pianoPret;
  }
  const reveiller = () => { try { if (Tone.context.state !== "running") Tone.context.resume(); } catch (e) { /* pas encore démarré */ } };
  ["pointerdown", "touchend", "click"].forEach((ev) => document.addEventListener(ev, reveiller, true));
  document.addEventListener("visibilitychange", reveiller);
  const son = new Audio();
  son.preload = "auto";
  const lecteur = { piece: null, mode: null, source: null, duree: 0, joue: false, pause: false, file: null };
  function arreter() {
    Tone.Transport.stop();
    Tone.Transport.cancel();
    if (piano) piano.releaseAll();
    son.pause();
    lecteur.joue = false;
    lecteur.pause = false;
  }
  /* Fondu de sortie, pour ne jamais couper net ni mélanger deux morceaux. */
  async function fondre(ms = 350) {
    if (lecteur.joue && !lecteur.pause) {
      if (lecteur.source === "audio") {
        const v0 = son.volume;
        for (let i = 1; i <= 7; i++) { son.volume = Math.max(0, v0 * (1 - i / 7)); await attendre(ms / 7); }
      } else if (piano) {
        Tone.Destination.volume.rampTo(-60, ms / 1000);
        await attendre(ms);
      }
    }
    arreter();
    son.volume = 1;
    if (piano) Tone.Destination.volume.value = 0;
  }
  /* Programme les notes ; renvoie la durée en secondes. nb = nombre d'attaques distinctes. */
  function programmer(p, nb, tenir, intro) {
    const spb = 60 / p.bpm;
    const attaques = [];
    for (const n of p.notes) { if (attaques[attaques.length - 1] !== n[0]) attaques.push(n[0]); if (attaques.length > nb) break; }
    const limite = attaques.length > nb ? attaques[nb] : Infinity;
    const derniere = attaques[Math.min(nb, attaques.length) - 1];
    const sonner = (midi, d, quand) => Tone.Transport.schedule((t) => piano.triggerAttackRelease(Tone.Frequency(midi, "midi").toFrequency(), d, t, 0.8), quand);
    let fin = 0;
    if (intro) p.notes.filter((n) => n[0] === 0).forEach((n) => sonner(n[1], Math.max(n[2] * spb, 1.9), 0));
    for (const [t, midi, dur] of p.notes) {
      if (t >= limite) break;
      let d = Math.max(dur * spb, 0.12);
      if (tenir && t === derniere) d = Math.max(d, 1.7);
      sonner(midi, d, intro + t * spb);
      fin = Math.max(fin, intro + t * spb + d);
    }
    return fin;
  }
  async function jouerEnregistrement(p, mode) {
    arreter();
    son.src = ENR[p.titre].audio;
    son.currentTime = 0;
    son.volume = 1;
    Object.assign(lecteur, { piece: p, mode, source: "audio", duree: 0, joue: true, pause: false });
    majLecture();
    try { await son.play(); } catch (e) { lecteur.joue = false; majLecture(); }
  }
  async function jouerSynthese(p, mode, nb, tenir, intro) {
    await pretAudio();
    reveiller();
    arreter();
    Object.assign(lecteur, { piece: p, mode, source: "synth", duree: programmer(p, nb, tenir, intro), joue: true, pause: false });
    Tone.Transport.start("+0.05", 0);
    majLecture();
  }
  /* Écoute libre d'un morceau. `file` : liste à enchaîner (lecture en continu depuis Ma liste). */
  async function ecouter(p, file) {
    if (lecteur.piece === p && lecteur.mode === "ecoute" && lecteur.joue) {
      lecteur.pause = !lecteur.pause;
      if (lecteur.source === "audio") { if (lecteur.pause) son.pause(); else son.play().catch(() => {}); }
      else if (lecteur.pause) { Tone.Transport.pause(); piano.releaseAll(); } else Tone.Transport.start();
      majLecture();
      return;
    }
    lecteur.file = file || null;
    if (ENR[p.titre]) await jouerEnregistrement(p, "ecoute"); else await jouerSynthese(p, "ecoute", Infinity, false, INTRO);
  }
  /* Notes isolées du jeu. */
  const extrait = (p, nb) => jouerSynthese(p, "extrait", nb, true, 0);
  /* À la révélation : le vrai début du morceau. */
  const apercu = (p) => (ENR[p.titre] ? jouerEnregistrement(p, "extrait") : extrait(p, nbAttaquesMesures(p, 4)));
  const nbAttaquesMesures = (p, mesures) => {
    const temps = mesures * (p.mesure ? (parseInt(p.mesure) * 4) / parseInt(p.mesure.split("/")[1]) : 4);
    return new Set(p.notes.filter((n) => n[0] < temps).map((n) => n[0])).size;
  };
  function finLecture() {
    const f = lecteur.file, p = lecteur.piece, enEcoute = lecteur.mode === "ecoute";
    arreter();
    const i = f ? f.indexOf(p) : -1;
    if (enEcoute && f && i >= 0 && i < f.length - 1) { ecouter(f[i + 1], f); return; }
    majLecture();
  }
  function morceauSuivant() {
    const f = lecteur.file || maListe();
    const i = f.indexOf(lecteur.piece);
    const p = f[(i + 1) % f.length];
    arreter();
    ecouter(p, f);
  }
  son.addEventListener("ended", finLecture);
  setInterval(() => {
    if (!lecteur.joue || lecteur.pause) return;
    const audio = lecteur.source === "audio";
    const t = audio ? son.currentTime : Tone.Transport.seconds;
    const d = audio ? son.duration || 0 : lecteur.duree;
    if (lecteur.mode === "ecoute" && d) $("mini-barre").style.width = Math.min(100, (100 * t) / d) + "%";
    if (!audio && t > d + 1.2) finLecture();
  }, 200);

  /* ---------- claviers ---------- */
  /* Clavier de la fiche : toute la largeur, sans défilement, avec les touches du morceau allumées. */
  function clavierPlein(zone, bas, haut, cibles) {
    zone.innerHTML = "";
    let nb = 0;
    for (let m = bas; m <= haut; m++) if (!NOIRES.includes(m % 12)) nb++;
    const lb = 100 / nb;
    let blanches = 0;
    for (let m = bas; m <= haut; m++) {
      const t = document.createElement("span");
      if (NOIRES.includes(m % 12)) { t.className = "noire"; t.style.width = `${lb * 0.6}%`; t.style.left = `${blanches * lb - lb * 0.3}%`; }
      else { t.className = "blanche"; blanches++; }
      if (cibles.includes(m)) t.classList.add("cible");
      zone.appendChild(t);
    }
  }
  /* Une octave de do à do : on répond par le nom de la note, sans l'octave. */
  function clavierOctave(zone, surClic) {
    const el = document.createElement("div");
    el.className = "octave";
    let blanches = 0;
    for (let m = 0; m <= 12; m++) {
      const t = document.createElement("button");
      t.dataset.pc = m % 12;
      if (NOIRES.includes(m % 12)) { t.className = "noire"; t.style.left = `calc(${blanches * 12.5}% - 4.2%)`; t.setAttribute("aria-label", FR[m % 12]); }
      else { t.className = "blanche"; t.textContent = FR[m % 12]; blanches++; }
      t.addEventListener("click", () => surClic(m % 12, t));
      el.appendChild(t);
    }
    zone.appendChild(el);
  }

  /* ---------- partition ---------- */
  const attente = {};
  window.__SCORE = (id, xml) => { if (attente[id]) { attente[id](xml); delete attente[id]; } };
  const cachePartition = {};
  const chargerPartition = (id) => cachePartition[id] || (cachePartition[id] = new Promise((ok, ko) => {
    attente[id] = ok;
    const s = document.createElement("script");
    s.src = `data/scores/${id}.js`;
    s.onerror = ko;
    document.head.appendChild(s);
  }));
  async function afficherPartition(p, zone) {
    zone.innerHTML = "";
    try {
      const xml = await chargerPartition(p.id);
      if (fiche.piece !== p) return;
      const osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay(zone, { autoResize: false, drawTitle: false, drawSubtitle: false, drawComposer: false, drawLyricist: false, drawPartNames: false, drawingParameters: "compacttight" });
      await osmd.load(xml);
      osmd.zoom = 1;
      osmd.render();
    } catch (e) { zone.innerHTML = ""; console.error("partition", p.titre, e); }
  }

  /* ---------- navigation ---------- */
  let ecran = "jouer";
  function aller(nom) {
    if (ecran === "jouer" && nom !== "jouer" && lecteur.mode === "extrait") arreter();
    ecran = nom;
    document.querySelectorAll(".ecran").forEach((e) => e.classList.toggle("actif", e.id === "ecran-" + nom));
    document.querySelectorAll(".onglets button").forEach((b) => b.classList.toggle("actif", b.dataset.ecran === nom));
    if (nom === "liste") rendreListe();
    document.dispatchEvent(new CustomEvent("ah:ecran", { detail: nom }));
    majLecture();
  }
  document.querySelectorAll(".onglets button").forEach((b) => b.addEventListener("click", () => aller(b.dataset.ecran)));

  /* ---------- ma liste : le lecteur ---------- */
  function rendreListe() {
    const zone = $("pl-liste");
    const liste = maListe();
    const reels = liste.filter((p) => ENR[p.titre]).length;
    $("pl-resume").textContent = `${liste.length} morceaux · ${reels} en vrai enregistrement`;
    zone.innerHTML = "";
    liste.forEach((p) => {
      const r = document.createElement("div");
      const actif = lecteur.piece === p && lecteur.mode === "ecoute" && lecteur.joue;
      r.className = "rang" + (actif ? " encours" : "");
      r.innerHTML = `<button class="rond" aria-label="Écouter">${actif && !lecteur.pause ? ICONE.pause : ICONE.lire}</button>
        <button class="texte"><b>${p.titre}</b><small>${p.compositeur} · ${PALIERS[palier(p)]}</small></button>
        <span class="etoiles">${[0, 1, 2, 3, 4].map((i) => `<i class="${palier(p) >= i ? "ok" : ""}"></i>`).join("")}</span>
        <span class="pastille" style="--c:${couleur(p)}">${nomCourt(p)}</span>`;
      r.querySelector(".rond").addEventListener("click", () => ecouter(p, maListe()));
      r.querySelector(".texte").addEventListener("click", () => ouvrirFiche(p));
      zone.appendChild(r);
    });
    if (prochain()) {
      const r = document.createElement("div");
      r.className = "rang cache";
      r.innerHTML = `<span class="rond">?</span><span class="texte"><b>Morceau suivant</b><small>Termine une partie pour le débloquer</small></span>`;
      zone.appendChild(r);
    }
  }

  /* ---------- fiche (feuille du bas) ---------- */
  const fiche = { piece: null, suite: null };
  /* resultat (en jeu) : { juste, gain, parts: [{ txt, non }], avant, apres, acquis } */
  function ouvrirFiche(p, resultat, suite) {
    fiche.piece = p;
    fiche.suite = suite || null;
    const pan = document.querySelector(".feuille-panneau");
    pan.style.setProperty("--c", couleur(p));
    $("f-resultat").hidden = !resultat;
    if (resultat) {
      const pts = $("f-points");
      pts.className = "f-points" + (resultat.juste ? "" : " rate");
      pts.textContent = resultat.juste ? "+" + resultat.gain : "Raté";
      if (resultat.juste) compter(pts, resultat.gain);
      $("f-detail").textContent = resultat.parts.filter((x) => !x.non).map((x) => x.txt).join("  ·  ");
      // le palier : cinq points, celui qui vient d'être gagné (ou perdu) s'anime
      const pips = (n, marque) => [0, 1, 2, 3, 4].map((i) => `<i class="${n >= i ? "ok" : ""}${i === marque ? " bouge" : ""}"></i>`).join("");
      $("f-pips").innerHTML = pips(resultat.avant, -1);
      if (resultat.apres !== resultat.avant) setTimeout(() => {
        if (fiche.piece === p) $("f-pips").innerHTML = pips(resultat.apres, Math.max(resultat.avant, resultat.apres));
      }, 700);
    }
    $("f-pastille").textContent = nomCourt(p);
    $("f-note").textContent = p.midis.map(sci).join(" + ");
    $("f-titre").textContent = p.titre;
    $("f-comp").textContent = p.compositeur;
    grandClavier($("f-clavier"), niveauxTouches(), null, p.midis);
    const e = ENR[p.titre];
    $("f-credit").textContent = resultat ? "" : e ? `Enregistrement : ${e.interprete || "interprète non précisé"} · ${e.licence}` : "Écoute en rendu synthétique";
    $("f-suite").textContent = suite ? "Continuer" : "Fermer";
    $("feuille").hidden = false;
    majFiche();
    afficherPartition(p, $("f-partition"));
  }
  /* Le total de points défile de 0 à sa valeur. */
  function compter(el, total, prefixe = "+", duree = 700, attente = 0) {
    el.textContent = prefixe + (attente ? 0 : total);
    setTimeout(() => {
      const t0 = performance.now();
      const pas = () => {
        const k = Math.min(1, (performance.now() - t0) / duree);
        el.textContent = prefixe + Math.round(total * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(pas);
      };
      requestAnimationFrame(pas);
      setTimeout(() => { el.textContent = prefixe + total; }, duree + 80); // valeur finale garantie même si l'animation est suspendue
    }, attente);
  }
  function majFiche() {
    const p = fiche.piece;
    if (p) $("f-lecture").innerHTML = lecteur.piece === p && lecteur.joue && !lecteur.pause ? ICONE.pause : ICONE.lire;
  }
  function fermerFiche() {
    $("feuille").hidden = true;
    const suite = fiche.suite;
    fiche.piece = null;
    fiche.suite = null;
    if (suite) suite();
  }
  $("feuille-fond").addEventListener("click", fermerFiche);
  $("f-suite").addEventListener("click", fermerFiche);
  $("f-pastille").addEventListener("click", () => { if (fiche.piece) extrait(fiche.piece, 1).catch(() => {}); });
  $("f-lecture").addEventListener("click", () => {
    const p = fiche.piece;
    if (lecteur.piece === p && lecteur.joue && lecteur.mode === "extrait") { arreter(); majLecture(); } else ecouter(p);
  });

  /* ---------- accueil : le clavier-jauge ---------- */
  let run = null; // { file, i, vies, score }
  let q = null; // question en cours
  const vue = (nom) => ["accueil", "partie", "fin"].forEach((id) => { $(id).hidden = id !== nom; });

  /* Niveau de chaque touche, de 0 (éteinte) à 5 (note acquise) : le meilleur des morceaux qui commencent dessus. */
  function niveauxTouches() {
    const niv = {};
    maListe().forEach((p) => {
      const n = S.acquis[p.id] ? 5 : Math.min(4, palier(p) + 1);
      p.midis.forEach((m) => { niv[m] = Math.max(niv[m] || 0, n); });
    });
    return niv;
  }
  let niveauxVus = null; // ce que le clavier montrait la dernière fois, pour animer les touches qui ont progressé
  /* Le grand clavier de l'appli (accueil, écran de validation) : 88 touches aux proportions réelles.
     niv : niveau de chaque touche ; avant : niveaux déjà montrés (les touches qui ont progressé s'éveillent) ; ici : touches à mettre en avant. */
  function grandClavier(zone, niv, avant, ici) {
    zone.innerHTML = "";
    const lb = 100 / 52;
    let blanches = 0;
    for (let m = 21; m <= 108; m++) {
      const t = document.createElement("span"), n = niv[m] || 0;
      if (NOIRES.includes(m % 12)) {
        // largeur et décalage d'une vraie touche noire (13,7 mm contre 23,5 mm ; do♯ et fa♯ tirent à gauche, mi♭ et si♭ à droite)
        const decal = { 1: -0.12, 3: 0.12, 6: -0.16, 8: 0, 10: 0.16 }[m % 12];
        t.className = "t tn";
        t.style.width = `${lb * 0.583}%`;
        t.style.left = `${(blanches + decal) * lb - (lb * 0.583) / 2}%`;
      } else { t.className = "t tb"; blanches++; }
      if (n) {
        t.classList.add("n" + n);
        t.style.setProperty("--c", COULEURS[m % 12]);
        if (avant && n > (avant[m] || 0)) t.classList.add("eveil");
      }
      if (ici && ici.includes(m)) { t.classList.add("ici"); t.style.setProperty("--c", COULEURS[m % 12]); }
      zone.appendChild(t);
    }
  }
  function rendreClavierAccueil() {
    const niv = niveauxTouches(), valeurs = Object.values(niv);
    grandClavier($("acc-clavier"), niv, niveauxVus, null);
    niveauxVus = niv;
    $("acc-jauge").textContent = Math.round((100 * valeurs.reduce((a, n) => a + n, 0)) / (88 * 5));
    $("acc-touches").innerHTML = `<b>${valeurs.length}</b> / 88 touches`;
  }
  function rendreAccueil() {
    vue("accueil");
    $("acc-total").textContent = " / " + PIECES.length;
    $("acc-liste").textContent = S.liste.length;
    $("acc-record").textContent = S.record;
    rendreClavierAccueil();
  }

  /* ---------- la fête : des ondes fines qui naissent de la note ----------
     Deux familles d'anneaux déformés par des ondulations lentes ; leur superposition dessine des moirés vivants.
     À l'apparition (et à chaque appui sur la note), une onde de choc part du centre. */
  const fete = (() => {
    const toile = $("fete"), ctx = toile.getContext("2d");
    let actif = false, t0 = 0, choc = 0, teinteNote = "#e9c27a", id = 0;
    const melanger = (hex, vers, k) => {
      const c = (h, i) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16);
      return "#" + [0, 1, 2].map((i) => Math.round(c(hex, i) + (c(vers, i) - c(hex, i)) * k).toString(16).padStart(2, "0")).join("");
    };
    function image(maintenant) {
      if (!actif) return;
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      const L = toile.clientWidth, H = toile.clientHeight;
      if (toile.width !== Math.round(L * ratio)) { toile.width = Math.round(L * ratio); toile.height = Math.round(H * ratio); }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, L, H);
      const med = $("fin-pastille").getBoundingClientRect(), cadre = toile.getBoundingClientRect();
      const cx = med.left + med.width / 2 - cadre.left, cy = med.top + med.height / 2 - cadre.top;
      const t = (maintenant - t0) / 1000, tc = (maintenant - choc) / 1000;
      const R = Math.hypot(L, H) * 0.62, r0 = med.width / 2;
      const lueur = ctx.createRadialGradient(cx, cy, r0, cx, cy, R * 0.8);
      lueur.addColorStop(0, melanger(teinteNote, "#16141d", 0.45));
      lueur.addColorStop(1, "rgba(22,20,29,0)");
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = lueur;
      ctx.globalAlpha = 0.5 * Math.min(1, t / 0.8);
      ctx.fillRect(0, 0, L, H);
      ctx.globalCompositeOperation = "lighter";
      const anneaux = (nombre, vitesse, lobes, phase, clair) => {
        for (let i = 0; i < nombre; i++) {
          const k = ((i / nombre + t * vitesse) % 1 + 1) % 1; // 0 au bord de la note, 1 au loin
          const r = r0 + k * (R - r0);
          const force = Math.pow(1 - k, 1.6) * Math.min(1, t / 1.2) * Math.min(1, k * 12);
          if (force < 0.01) continue;
          ctx.beginPath();
          for (let a = 0; a <= 120; a++) {
            const th = (a / 120) * Math.PI * 2;
            const d = 1 + Math.min(1, k * 2.4) * (0.05 * k * Math.sin(lobes * th + t * 0.8 + phase + i * 0.35) + 0.02 * Math.sin((lobes * 2 + 1) * th - t * 1.1 + i * 0.9) + 0.008 * Math.sin(17 * th + t * 1.9 + phase));
            const x = cx + Math.cos(th) * r * d, y = cy + Math.sin(th) * r * d;
            if (a) ctx.lineTo(x, y); else ctx.moveTo(x, y);
          }
          ctx.strokeStyle = melanger(clair, teinteNote, k * 0.9);
          ctx.globalAlpha = force * 0.75;
          ctx.lineWidth = 0.5 + 1.3 * (1 - k);
          ctx.stroke();
        }
      };
      anneaux(34, 0.045, 3, 0, melanger(teinteNote, "#ffffff", 0.75)); // tout l'écran est à la couleur de la note
      anneaux(26, -0.03, 5, 2.1, melanger(teinteNote, "#ffffff", 0.3));
      if (tc > 0 && tc < 1.6) { // onde de choc
        const k = 1 - Math.pow(1 - tc / 1.6, 3);
        for (let j = 0; j < 4; j++) {
          ctx.beginPath();
          ctx.arc(cx, cy, r0 + k * R * (1 - j * 0.07), 0, Math.PI * 2);
          ctx.strokeStyle = j ? teinteNote : "#fffaf0";
          ctx.globalAlpha = (1 - k) * (1 - j * 0.2);
          ctx.lineWidth = (10 - j * 2) * (1 - k) + 0.6;
          ctx.stroke();
        }
        ctx.globalAlpha = Math.max(0, 0.5 - tc * 1.4);
        ctx.fillStyle = "#fffaf0";
        ctx.fillRect(0, 0, L, H);
      }
      ctx.globalAlpha = 1;
      id = requestAnimationFrame(image);
    }
    return {
      lancer(c) { teinteNote = c; actif = true; t0 = performance.now(); choc = t0 + 300; cancelAnimationFrame(id); id = requestAnimationFrame(image); },
      eclat() { choc = performance.now(); },
      arreter() { actif = false; cancelAnimationFrame(id); ctx.clearRect(0, 0, toile.width, toile.height); },
    };
  })();

  /* ---------- nettoyage d'oreille : trois secondes de notes au hasard, chacune éclatant dans sa couleur ---------- */
  const PHRASES = [
    "Brouillage des oreilles", "Remise à zéro de l'écoute", "Rinçage des tympans", "On efface la note d'avant", "Secouage de cochlée",
    "Amnésie musicale en cours", "Désaccordage provisoire", "On mélange les cartes", "Vidange auditive", "Oreilles en mode avion",
    "Ne retenez rien", "Petit ménage dans les aigus", "Un instant, on brouille les pistes", "Réinitialisation du diapason", "Tout oublier, sauf le plaisir",
  ];
  let phrasePrecedente = -1;
  function rincer(duree = 3000) {
    const toile = $("rincage"), ctx = toile.getContext("2d"), texte = $("rincage-texte");
    let i = Math.floor(Math.random() * PHRASES.length);
    if (i === phrasePrecedente) i = (i + 1) % PHRASES.length;
    phrasePrecedente = i;
    texte.innerHTML = PHRASES[i] + '<i>.</i><i>.</i><i>.</i>';
    toile.hidden = false;
    texte.hidden = false;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const L = toile.clientWidth, H = toile.clientHeight;
    toile.width = Math.round(L * ratio);
    toile.height = Math.round(H * ratio);
    const impacts = [], debut = performance.now(), VIE = 2.4, portee = Math.hypot(L, H) * 0.75;
    let id = 0;
    const note = () => { // cinq notes par seconde, sur tout le clavier utile
      const m = 36 + Math.floor(Math.random() * 54);
      impacts.push({ x: L * (0.08 + 0.84 * Math.random()), y: H * (0.08 + 0.84 * Math.random()), t0: performance.now(), c: COULEURS[m % 12], g: Math.random() * 6, lambda: 26 + Math.random() * 22 });
      if (piano) { reveiller(); piano.triggerAttackRelease(Tone.Frequency(m, "midi").toFrequency(), 0.3, undefined, 0.4); }
    };
    const rythme = setInterval(() => { if (performance.now() - debut < duree - 150) note(); }, 200);
    note();
    function image(maintenant) {
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#0f0e14";
      ctx.fillRect(0, 0, L, H);
      ctx.globalCompositeOperation = "lighter";
      const vivants = impacts.filter((im) => (maintenant - im.t0) / 1000 < VIE);
      // 1. chaque impact teinte l'écran : une nappe de couleur qui s'étale et se mêle aux autres
      for (const im of vivants) {
        const a = (maintenant - im.t0) / 1000, k = 1 - Math.pow(1 - a / VIE, 2.4), r = 40 + k * portee * 0.55;
        const nappe = ctx.createRadialGradient(im.x, im.y, 0, im.x, im.y, r);
        nappe.addColorStop(0, im.c);
        nappe.addColorStop(1, "rgba(0,0,0,0)");
        ctx.globalAlpha = 0.34 * Math.pow(1 - a / VIE, 1.3) * Math.min(1, a * 8);
        ctx.fillStyle = nappe;
        ctx.fillRect(im.x - r, im.y - r, 2 * r, 2 * r);
      }
      // 2. les ondes : chaque anneau est déformé par le passage des ondes des autres impacts
      for (const im of vivants) {
        const a = (maintenant - im.t0) / 1000, k = 1 - Math.pow(1 - a / VIE, 2);
        for (let j = 0; j < 7; j++) {
          const r = k * portee * 0.5 * (1 - j * 0.13);
          if (r < 2) continue;
          ctx.beginPath();
          for (let n = 0; n <= 64; n++) {
            const th = (n / 64) * Math.PI * 2;
            let x = im.x + Math.cos(th) * r, y = im.y + Math.sin(th) * r, pousse = 0;
            for (const autre of vivants) {
              if (autre === im) continue;
              const d = Math.hypot(x - autre.x, y - autre.y), b = (maintenant - autre.t0) / 1000;
              pousse += Math.sin(d / autre.lambda - b * 7) * 13 * Math.exp(-d / 210) * (1 - b / VIE);
            }
            const rr = r + pousse + k * 6 * Math.sin(5 * th + im.g + j);
            x = im.x + Math.cos(th) * rr;
            y = im.y + Math.sin(th) * rr;
            if (n) ctx.lineTo(x, y); else ctx.moveTo(x, y);
          }
          ctx.strokeStyle = im.c;
          ctx.globalAlpha = Math.pow(1 - a / VIE, 1.2) * (0.9 - j * 0.1);
          ctx.lineWidth = 0.7 + 1.7 * (1 - k);
          ctx.stroke();
        }
      }
      id = requestAnimationFrame(image);
    }
    id = requestAnimationFrame(image);
    return new Promise((ok) => setTimeout(() => {
      clearInterval(rythme);
      cancelAnimationFrame(id);
      if (piano) piano.releaseAll();
      toile.hidden = true;
      texte.hidden = true;
      ok();
    }, duree + 500));
  }

  /* ---------- la partie ---------- */
  async function lancer() {
    if (!son.dataset.ouvert && PIECES.some((p) => ENR[p.titre])) {
      son.dataset.ouvert = "1";
      son.muted = true;
      son.src = ENR[PIECES.find((p) => ENR[p.titre]).titre].audio;
      son.play().then(() => { son.pause(); son.muted = false; }).catch(() => { son.muted = false; });
    }
    try { await pretAudio(); } catch (e) { return; }
    await fondre(200);
    majLecture();
    run = { file: melange(maListe()), i: 0, vies: VIES, score: 0 };
    vue("partie");
    poser();
  }
  $("lancer").addEventListener("click", lancer);
  $("rejouer").addEventListener("click", async () => { fete.arreter(); await fondre(300); majLecture(); rendreAccueil(); });

  function majStatut() {
    $("vies").innerHTML = Array.from({ length: VIES }, (_, i) => `<span class="${i < run.vies ? "" : "perdue"}">♥</span>`).join("");
    $("avance").textContent = `${Math.min(run.i + 1, run.file.length)} / ${run.file.length}`;
    $("score").textContent = run.score;
  }
  /* Points en jeu : 100 par palier atteint, divisés par deux toutes les 6 secondes, réduits par les aides. */
  function valeur() {
    const base = q.phase === "titre" || q.T === DERNIER ? 100 * (q.T + 1) : 100 * (q.N + 1);
    const aides = q.phase === "titre" || q.T === DERNIER ? (q.ecoute ? COEF_ECOUTE : COEF_NOTES[q.nb - 1]) : 1;
    return Math.max(1, Math.round(base * aides * Math.pow(0.5, (performance.now() - q.t0) / 1000 / DEMI_VIE)));
  }
  function majEnjeu() {
    $("jauge").innerHTML = COEF_NOTES.map((_, i) => `<span class="${i < q.nb ? "ok" : ""}"></span>`).join("");
    if (!q.fini) $("enjeu").innerHTML = `<b>${valeur()}</b> pts`;
    const fige = q.fini || q.ecoute || (q.phase === "note" && q.T < DERNIER);
    $("plus").disabled = fige || q.nb >= COEF_NOTES.length;
    $("aide-ecoute").disabled = fige;
  }
  setInterval(() => { if (q && !q.fini && !$("partie").hidden) $("enjeu").innerHTML = `<b>${valeur()}</b> pts`; }, 200);
  function sonner() {
    const o = $("orbe"), h = document.querySelector(".houle");
    o.classList.remove("sonne");
    void o.offsetWidth;
    o.classList.add("sonne");
    h.classList.add("vive");
    clearTimeout(sonner.t);
    sonner.t = setTimeout(() => h.classList.remove("vive"), 1500);
    (q.ecoute ? extrait(q.p, nbAttaquesMesures(q.p, 4)) : extrait(q.p, q.nb)).catch(() => {});
  }
  $("orbe").addEventListener("click", () => { if (q) sonner(); });
  $("plus").addEventListener("click", () => { q.nb++; majEnjeu(); sonner(); });
  $("aide-ecoute").addEventListener("click", () => { q.ecoute = true; majEnjeu(); sonner(); });

  function poser() {
    const p = run.file[run.i];
    q = { p, T: palier(p), N: niveauNote(p), nb: 1, ecoute: false, fini: false, phase: palier(p) === DERNIER ? "note" : "titre", etape: 0, choisi: [], gain: 0, bonus: 0, t0: performance.now(), debut: performance.now() };
    majStatut();
    rendreReponses();
    majEnjeu();
    sonner();
  }
  /* autres morceaux pour les mauvaises réponses : d'abord ceux de la liste, puis les suivants du catalogue */
  function leurres(p, n) {
    const dans = melange(maListe().filter((x) => x !== p));
    const hors = melange(PIECES.filter((x) => !S.liste.includes(x.id)).slice(0, 8));
    return [...dans, ...hors].slice(0, n);
  }
  function options(zone, classe, liste, rendu, surChoix) {
    zone.className = "reponses " + classe;
    zone.innerHTML = "";
    liste.forEach((val) => {
      const b = document.createElement("button");
      b.className = "option";
      b.innerHTML = rendu(val);
      b.addEventListener("click", () => surChoix(val, b));
      zone.appendChild(b);
    });
  }
  function rendreReponses() {
    const zone = $("reponses"), p = q.p;
    $("fil").textContent = "";
    if (q.phase === "note") {
      const seule = q.T === DERNIER;
      $("question").textContent = seule ? "Quelle est cette note ?" : "Et sa première note ?";
      if (!seule) $("fil").textContent = `${p.titre} · ${p.compositeur}`;
      if (seule || q.N >= NIVEAUX_NOTE - 1) { // dernier niveau : le clavier
        zone.className = "reponses";
        zone.innerHTML = "";
        clavierOctave(zone, repondreNote);
        return;
      }
      // d'abord 2 notes au choix, puis 4 ; les mauvaises réponses sont des notes voisines
      const autres = melange([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]).slice(0, q.N === 0 ? 1 : 3).map((d) => (pc(p) + d) % 12);
      const liste = melange([pc(p), ...autres]);
      options(zone, q.N === 0 ? "deux" : "quatre", liste, (v) => `<b style="color:${COULEURS[v]}">${FR[v]}</b>`, (v, b) => repondreNote(v, b));
      [...zone.children].forEach((b, i) => { b.dataset.juste = liste[i] === pc(p) ? "1" : ""; });
      return;
    }
    $("question").textContent = "Quel morceau ?";
    if (q.T < 2) {
      const liste = melange([p, ...leurres(p, q.T === 0 ? 1 : 3)]);
      options(zone, q.T === 0 ? "deux" : "quatre", liste, (x) => `<b>${x.titre}</b><small>${x.compositeur}</small>`, (x, b) => repondreTitre(x === p, b));
      [...zone.children].forEach((b, i) => { b.dataset.juste = liste[i] === p ? "1" : ""; });
      return;
    }
    /* en étapes. Palier 3 : compositeur puis morceau. Palier 4 : compositeur, type, numéro. */
    const duMeme = PIECES.filter((x) => x.compositeur === p.compositeur);
    const etapes = (q.T === 2 ? [
      { nom: "Le compositeur ?", juste: p.compositeur, tous: uniques(PIECES.map((x) => x.compositeur)) },
      { nom: "Le morceau ?", juste: p.titre, tous: uniques([...duMeme, ...PIECES].map((x) => x.titre)), garde: Math.max(1, Math.min(3, duMeme.length - 1)) },
    ] : [
      { nom: "Le compositeur ?", juste: p.compositeur, tous: uniques(PIECES.map((x) => x.compositeur)) },
      { nom: "Le type ?", juste: p.forme, tous: uniques([...duMeme, ...PIECES].map((x) => x.forme)), garde: 2 },
      { nom: "Lequel ?", juste: p.numero, tous: uniques(duMeme.filter((x) => x.forme === p.forme).map((x) => x.numero)), strict: true },
    ]).filter((e) => !e.strict || e.tous.length > 1);
    const e = etapes[q.etape];
    $("question").textContent = e.nom;
    $("fil").textContent = q.choisi.join(" › ");
    const autres = e.tous.filter((v) => v !== e.juste);
    const g = e.garde || 0; // les premiers de la liste (même compositeur) sont gardés tels quels, le reste est tiré au hasard
    const faux = e.strict ? autres : [...autres.slice(0, g), ...melange(autres.slice(g))];
    const liste = melange([e.juste, ...faux.slice(0, 3)]);
    options(zone, liste.length > 2 ? "quatre" : "deux", liste, (v) => `<b>${v}</b>`, (v, b) => {
      if (q.fini) return;
      if (v !== e.juste) return repondreTitre(false, b);
      q.choisi.push(v.length > 26 ? v.slice(0, 24) + "…" : v);
      q.etape++;
      if (q.etape >= etapes.length) repondreTitre(true, b); else rendreReponses();
    });
    [...zone.children].forEach((b, i) => { b.dataset.juste = liste[i] === e.juste ? "1" : ""; });
  }
  function repondreTitre(juste, bouton) {
    if (q.fini) return;
    document.querySelectorAll("#reponses .option").forEach((b) => { if (b.dataset.juste) b.classList.add("bon"); });
    if (!juste) { bouton.classList.add("faux"); return conclure(false); }
    q.gain = valeur();
    q.phase = "note";
    q.t0 = performance.now() + 450; // le chrono de la note repart quand ses réponses s'affichent
    majEnjeu();
    setTimeout(rendreReponses, 450);
  }
  function repondreNote(choix, el) {
    if (q.fini) return;
    const p = q.p, juste = choix === pc(p), pts = valeur();
    // on entend la note qu'on vient de choisir, à l'octave la plus proche de la vraie
    const midi = p.midis[0] + ((choix - pc(p) + 18) % 12) - 6;
    arreter();
    if (piano) piano.triggerAttackRelease(Tone.Frequency(midi, "midi").toFrequency(), 1.3, undefined, 0.8);
    const zone = $("reponses");
    zone.style.setProperty("--c", couleur(p));
    if (el.classList.contains("option")) {
      zone.querySelectorAll(".option").forEach((b) => { if (b.dataset.juste) b.classList.add("bon"); });
      if (!juste) el.classList.add("faux");
    } else {
      zone.querySelectorAll(`[data-pc="${pc(p)}"]`).forEach((t) => t.classList.add("cible"));
      if (!juste) el.classList.add("erreur");
    }
    if (q.T === DERNIER) { q.gain = juste ? pts : 0; return conclure(juste, 1100); }
    q.bonus = juste ? pts : 0;
    q.noteJuste = juste;
    conclure(true, 1100);
  }
  function conclure(juste, delai = 700) {
    q.fini = true;
    majEnjeu();
    const p = q.p, avant = q.T, seule = q.T === DERNIER;
    const gain = juste ? q.gain + q.bonus : 0;
    const apres = Math.max(0, Math.min(DERNIER, avant + (juste ? 1 : -1)));
    S.palier[p.id] = apres;
    if (juste && !seule) S.niveauNote[p.id] = Math.max(0, Math.min(NIVEAUX_NOTE - 1, q.N + (q.noteJuste ? 1 : -1))); // la note a sa propre échelle
    if (juste && seule) S.acquis[p.id] = true; // réussi au dernier palier : la note est acquise
    if (!juste) delete S.acquis[p.id];
    S.points += gain;
    run.score += gain;
    if (!juste) run.vies--;
    sauver();
    majStatut();
    $("enjeu").innerHTML = juste ? `<b>+${gain}</b>` : "";
    document.dispatchEvent(new CustomEvent("ah:reponse", { detail: { juste, palier: avant, temps: (performance.now() - q.debut) / 1000 } }));
    const parts = !juste ? [{ txt: "−1 vie" }]
      : seule ? [{ txt: `note +${q.gain}` }]
      : [{ txt: `morceau +${q.gain}` }, q.noteJuste ? { txt: `note +${q.bonus}` } : { txt: "note", non: true }];
    const resultat = { juste, gain, parts, avant, apres, acquis: juste && seule };
    setTimeout(() => { apercu(p).catch(() => {}); ouvrirFiche(p, resultat, suivante); }, delai);
  }
  /* Entre deux morceaux : fondu, silence, puis la note suivante. */
  let enTransition = false;
  async function suivante() {
    if (enTransition) return;
    enTransition = true;
    $("partie").classList.add("entracte");
    await fondre(350);
    run.i++;
    // avant un nouveau morceau : on « nettoie l'oreille », pour ne pas deviner la note par comparaison avec la précédente
    if (run.vies > 0 && run.i < run.file.length) { $("feuille").hidden = true; await rincer(); await attendre(450); } else await attendre(ENTRACTE);
    enTransition = false;
    if (run.vies <= 0) finir(false);
    else if (run.i >= run.file.length) finir(true);
    else poser();
    $("partie").classList.remove("entracte");
  }
  function finir(victoire) {
    q = null;
    const record = run.score > S.record && run.score > 0;
    S.record = Math.max(S.record, run.score);
    const nouveau = victoire ? prochain() : null;
    if (nouveau) { S.liste.push(nouveau.id); S.palier[nouveau.id] = 0; }
    sauver();
    document.dispatchEvent(new CustomEvent("ah:fin", { detail: { victoire, score: run.score } }));
    vue("fin");
    $("fin").classList.toggle("gagne", !!nouveau);
    $("fin-sur").textContent = victoire ? "Liste terminée" : "Partie terminée";
    $("fin-titre").textContent = victoire ? (nouveau ? "Nouveau morceau" : "Liste complète") : "Plus de vies";
    $("fin-carte").hidden = !nouveau;
    fete.arreter();
    if (nouveau) {
      $("fin").style.setProperty("--c", couleur(nouveau));
      $("fin-pastille").textContent = nomCourt(nouveau);
      $("fin-touche").textContent = nouveau.midis.length > 1 ? `en octaves · ${nouveau.midis.map(sci).join(" + ")}` : `nouvelle touche · ${sci(nouveau.midis[0])}`;
      $("fin-comp").textContent = nouveau.compositeur;
      $("fin-morceau").textContent = nouveau.titre;
      $("fin-pastille").onclick = () => { fete.eclat(); extrait(nouveau, 1).catch(() => {}); };
      fete.lancer(couleur(nouveau));
      setTimeout(() => { if (!$("fin").hidden && lecteur.mode !== "ecoute") ecouter(nouveau).catch(() => {}); }, 900);
    }
    $("fin-record").hidden = !record;
    const zs = document.querySelector(".score-fin");
    zs.classList.remove("eclate");
    void zs.offsetWidth;
    zs.classList.add("eclate");
    compter($("fin-score"), run.score, "", 1400, 700);
    majTout();
  }

  /* ---------- mises à jour d'affichage ---------- */
  function majLecture() {
    const p = lecteur.piece;
    const visible = !!p && lecteur.mode === "ecoute" && lecteur.joue;
    $("mini").hidden = !visible;
    if (visible) {
      $("mini-titre").textContent = p.titre;
      $("mini-comp").textContent = p.compositeur;
      $("mini-pastille").textContent = nomCourt(p);
      $("mini-pastille").style.setProperty("--c", couleur(p));
      $("mini-lecture").innerHTML = lecteur.pause ? ICONE.lire : ICONE.pause;
    }
    if (ecran === "liste") rendreListe();
    majFiche();
  }
  function majTout() {
    $("pl-badge").textContent = `· ${S.liste.length}`;
    majLecture();
  }
  $("mini-lecture").addEventListener("click", () => ecouter(lecteur.piece, lecteur.file));
  $("mini-suivant").addEventListener("click", morceauSuivant);
  $("mini-ouvrir").addEventListener("click", () => ouvrirFiche(lecteur.piece));

  // ce que les autres modules de l'appli peuvent utiliser (profil, partage, réglages : voir plus.js)
  window.AH = { S, sauver, PIECES, ENR, COULEURS, FR, maListe, palier, niveauxTouches, rendreAccueil, aller, toast };
  rendreAccueil();
  majTout();
})();
