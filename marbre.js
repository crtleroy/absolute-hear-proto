/* Marbrures : une encre arc-en-ciel qui flotte, se déforme dans tous les sens, s'ouvre en anneaux et se referme.
   window.marbrer(bouton, numéro de variante) habille un bouton. Sert à la page d'essai (boutons.html) et,
   avec ?bouton=N dans l'adresse, au bouton Jouer de l'appli pour juger chaque variante en situation. */
(function () {
  /* Deuxième série : l'Encre retenue, en plus diffus. flou = flou de la toile (px), large = demi-largeur d'une veine (px),
     mot = "phrase" (Inter demi-gras) ou "capitales" (Inter, capitales espacées, comme les étiquettes de l'appli). */
  const VARIANTES = [
    { nom: "Encre diffuse", flou: 5, large: 5, force: 1, mot: "phrase" },
    { nom: "Encre très diffuse", flou: 12, large: 10, force: 1, k: 0.85, mot: "capitales" },
    { nom: "Encre diffuse et filet", flou: 5, large: 5, force: 1, mot: "phrase", filet: true },
    { nom: "Bord vif diffus", flou: 6, large: 6, force: 1, mot: "capitales", centre: true },
    { nom: "Bord vif diffus et filet", flou: 6, large: 6, force: 1, mot: "phrase", centre: true, filet: true },
    { nom: "Encre diffuse, avec le signe lecture", flou: 8, large: 7, force: 1, k: 1.2, mot: "phrase", signe: true },
  ];
  // les douze couleurs des notes, comme dans l'appli (do = rouge)
  const COUL = Array.from({ length: 12 }, (_, i) => {
    const h = i * 30, s = 0.85, l = 0.62, a = s * Math.min(l, 1 - l);
    const f = (n) => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
    return [f(0), f(8), f(4)];
  });
  const style = document.createElement("style");
  style.textContent = `
.marbre { position: relative; isolation: isolate; overflow: hidden; border: 0 !important; background: #191622 !important; box-shadow: 0 14px 34px rgba(0, 0, 0, .55), 0 0 0 1px rgba(255, 255, 255, .06); }
.marbre canvas { position: absolute; inset: -16px; width: calc(100% + 32px); height: calc(100% + 32px); z-index: -1; pointer-events: none; }
.marbre .mot { position: relative; display: inline-flex; align-items: center; gap: 12px; font-family: "Inter", system-ui, sans-serif; line-height: 1; color: #fffaf0; text-shadow: 0 0 8px rgba(15, 14, 20, .95), 0 0 20px rgba(15, 14, 20, .9), 0 1px 2px rgba(0, 0, 0, .9); }
.marbre .mot.phrase { font-weight: 600; font-size: 1.45rem; letter-spacing: .005em; }
.marbre .mot.capitales { font-weight: 600; font-size: 1.08rem; letter-spacing: .24em; text-transform: uppercase; padding-left: .24em; }
.marbre .mot svg { width: .95em; height: .95em; filter: drop-shadow(0 0 6px rgba(15, 14, 20, .9)); }
.marbre.filet::after { content: ""; position: absolute; inset: 0; border-radius: inherit; box-shadow: inset 0 0 0 1.5px rgba(233, 194, 122, .8); pointer-events: none; }
.essai-bouton { display: block; margin: 12px auto 0; padding: 4px 12px; color: #a7a1b2; font-size: .78rem; letter-spacing: .04em; text-align: center; }
.essai-bouton b { color: #e9c27a; font-weight: 600; }
`;
  document.head.appendChild(style);

  const lisse = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  function marbrer(bouton, numero) {
    const v = VARIANTES[(numero - 1 + VARIANTES.length) % VARIANTES.length];
    if (bouton.__marbre) bouton.__marbre();
    bouton.classList.remove("plein", "filet");
    bouton.classList.add("marbre");
    if (v.filet) bouton.classList.add("filet");
    const mot = bouton.textContent.trim() || "Jouer";
    const signe = v.signe ? '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>' : "";
    bouton.innerHTML = `<canvas aria-hidden="true"></canvas><span class="mot ${v.mot}">${signe}${mot}</span>`;
    const toile = bouton.firstChild, ctx = toile.getContext("2d");
    toile.style.filter = `blur(${v.flou}px)`;
    const phase = Math.random() * 100;
    let L = 0, H = 0, img = null, haut = null, vivant = true, dernier = 0;
    function taille() {
      const l = Math.max(2, Math.round(toile.clientWidth / 2)), h = Math.max(2, Math.round(toile.clientHeight / 2)); // demi-définition : le flou la rend invisible
      if (l === L && h === H) return;
      L = l; H = h; toile.width = L; toile.height = H;
      img = ctx.createImageData(L, H);
      haut = new Float32Array(L); // la valeur du champ sur la ligne du dessus, pour mesurer sa pente
    }
    function image(maintenant) {
      if (!vivant) return;
      requestAnimationFrame(image);
      if (maintenant - dernier < 33 || !bouton.offsetParent) return; // 30 images par seconde, rien si le bouton est caché
      dernier = maintenant;
      taille();
      const t = maintenant / 1000 + phase, d = img.data, E = 1 / 29; // 29 points de toile (58 px à l'écran) = une unité du champ
      const K = v.k || 1.7, large = v.large / 2; // K : nombre de veines ; moins il y en a, moins les couleurs se mélangent en gris sous le flou
      for (let y = 0, i = 0; y < H; y++) {
        let gauche = 0;
        for (let x = 0; x < L; x++, i += 4) {
          // le champ : des coordonnées tordues plusieurs fois, puis des ondes et deux foyers d'où partent des anneaux
          let u = x * E, w = y * E;
          u += 0.9 * Math.sin(w * 1.3 + t * 0.21) + 0.45 * Math.sin(w * 2.9 - t * 0.17 + 1.3);
          w += 0.9 * Math.sin(u * 1.1 - t * 0.19 + 2.1) + 0.45 * Math.sin(u * 2.3 + t * 0.23);
          u += 0.6 * Math.sin(w * 1.7 + t * 0.13 + 4);
          w += 0.6 * Math.sin(u * 1.9 - t * 0.11 + 0.7);
          const n = Math.sin(u * 1.2 + t * 0.15) + Math.sin(w * 1.4 - t * 0.09)
            + Math.sin(Math.hypot(u - 1.6, w - 0.4) * 1.9 - t * 0.42)
            + Math.sin(Math.hypot(u - 4.6, w - 1.1) * 1.5 + t * 0.3);
          const b = n * K + 40, bord = Math.round(b);
          // la pente du champ donne la distance en pixels à la veine la plus proche : trait d'épaisseur constante,
          // et plus de veines là où elles se serreraient en moiré
          const pente = Math.max(0.004, Math.hypot(x ? b - gauche : 0, y ? b - haut[x] : 0));
          gauche = b; haut[x] = b;
          let trait = (1 - lisse(0, large, Math.abs(b - bord) / pente)) * (1 - lisse(0.3, 0.6, pente)) * v.force;
          const dx = (x / L - 0.5) * 2, dy = (y / H - 0.5) * 2, ell = Math.sqrt(dx * dx * 1.6 + dy * dy * 0.8); // 0 au centre du bouton
          trait *= v.centre ? lisse(0.3, 0.95, ell) : 0.55 + 0.45 * lisse(0.15, 0.8, ell); // le mot reste lisible au centre
          const c = COUL[(bord * 5) % 12];
          const r = 25 + (c[0] - 25) * trait, g = 22 + (c[1] - 22) * trait, bl = 34 + (c[2] - 34) * trait;
          d[i] = r; d[i + 1] = g; d[i + 2] = bl; d[i + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
    }
    requestAnimationFrame(image);
    bouton.__marbre = () => { vivant = false; };
    return v;
  }
  window.marbrer = marbrer;
  window.MARBRES = VARIANTES;

  // dans l'appli : ?bouton=N habille le bouton Jouer avec la variante N ; la ligne sous le bouton passe à la suivante
  const lancer = document.getElementById("lancer");
  const choix = parseInt(new URLSearchParams(location.search).get("bouton"), 10);
  if (lancer && choix) {
    let n = choix;
    const ligne = document.createElement("button");
    ligne.className = "essai-bouton";
    const poser = () => { const v = marbrer(lancer, n); ligne.innerHTML = `bouton <b>${((n - 1) % VARIANTES.length) + 1} · ${v.nom}</b> · suivant ›`; };
    ligne.addEventListener("click", () => { n = (n % VARIANTES.length) + 1; poser(); });
    lancer.style.marginBottom = "0";
    lancer.after(ligne);
    ligne.style.height = "33px"; // 47 px sous le bouton, moins l'écart de 14 px de la colonne
    ligne.style.margin = "0 auto";
    poser();
  }
})();
