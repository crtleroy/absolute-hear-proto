/* Marbrures : une encre arc-en-ciel qui flotte, se déforme dans tous les sens, s'ouvre en anneaux et se referme.
   window.marbrer(bouton, numéro de variante) habille un bouton. Sert à la page d'essai (boutons.html) et,
   avec ?bouton=N dans l'adresse, au bouton Jouer de l'appli pour juger chaque variante en situation. */
(function () {
  /* Quatrième série : les couleurs et les lignes nettes de l'Encre sont retenues. On cherche la police du bouton d'action
     (ni Fraunces, la police des titres, ni Inter, celle des textes) et le moyen de faire ressortir le mot.
     lecture = "eclaircie" (les lignes s'effacent autour du mot) ou "cartouche" (le mot sur une pastille sombre). */
  const VARIANTES = [
    { nom: "Outfit", police: "Outfit", graisse: 600, taille: 1.7, lecture: "eclaircie" },
    { nom: "Sora", police: "Sora", graisse: 600, taille: 1.5, lecture: "eclaircie" },
    { nom: "Syne", police: "Syne", graisse: 700, taille: 1.65, lecture: "eclaircie" },
    { nom: "Unbounded", police: "Unbounded", graisse: 500, taille: 1.3, lecture: "eclaircie" },
    { nom: "Bricolage Grotesque", police: "Bricolage Grotesque", graisse: 700, taille: 1.7, lecture: "eclaircie" },
    { nom: "Manrope", police: "Manrope", graisse: 800, taille: 1.55, lecture: "eclaircie" },
    { nom: "Outfit, sur cartouche", police: "Outfit", graisse: 600, taille: 1.5, lecture: "cartouche" },
    { nom: "Unbounded, sur cartouche", police: "Unbounded", graisse: 500, taille: 1.15, lecture: "cartouche" },
  ];
  const polices = document.createElement("link");
  polices.rel = "stylesheet";
  polices.href = "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@700&family=Manrope:wght@800&family=Outfit:wght@600&family=Sora:wght@600&family=Syne:wght@700&family=Unbounded:wght@500&display=swap";
  document.head.appendChild(polices);
  // les douze couleurs des notes, comme dans l'appli (do = rouge)
  const COUL = Array.from({ length: 12 }, (_, i) => {
    const h = i * 30, s = 0.85, l = 0.62, a = s * Math.min(l, 1 - l);
    const f = (n) => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
    return [f(0), f(8), f(4)];
  });
  const style = document.createElement("style");
  style.textContent = `
.marbre { position: relative; isolation: isolate; overflow: hidden; border: 0 !important; background: #191622 !important; box-shadow: 0 14px 34px rgba(0, 0, 0, .55), 0 0 0 1px rgba(255, 255, 255, .06); }
.marbre canvas { position: absolute; inset: 0; width: 100%; height: 100%; z-index: -1; border-radius: inherit; pointer-events: none; }
.marbre .mot { position: relative; line-height: 1.2; color: #fff3d6; text-shadow: 0 0 6px #0f0e14, 0 0 16px #0f0e14, 0 1px 2px rgba(0, 0, 0, .9); }
.marbre .mot.cartouche { padding: 9px 26px 10px; border-radius: 999px; background: rgba(15, 14, 20, .86); box-shadow: 0 0 0 1px rgba(233, 194, 122, .45), 0 6px 18px rgba(0, 0, 0, .5); text-shadow: none; }
.essai-bouton { display: block; padding: 4px 12px; color: #a7a1b2; font-size: .78rem; letter-spacing: .04em; text-align: center; }
.essai-bouton b { color: #e9c27a; font-weight: 600; }
`;
  document.head.appendChild(style);

  const lisse = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  function marbrer(bouton, numero) {
    const v = VARIANTES[(numero - 1 + VARIANTES.length) % VARIANTES.length];
    if (bouton.__marbre) bouton.__marbre();
    bouton.classList.remove("plein");
    bouton.classList.add("marbre");
    const mot = bouton.textContent.trim() || "Jouer";
    bouton.innerHTML = `<canvas aria-hidden="true"></canvas><span class="mot ${v.lecture}" style="font-family:'${v.police}','Inter',sans-serif;font-weight:${v.graisse};font-size:${v.taille}rem">${mot}</span>`;
    const toile = bouton.firstChild, ctx = toile.getContext("2d");
    const phase = Math.random() * 100;
    let L = 0, H = 0, img = null, haut = null, vivant = true, dernier = 0;
    function taille() {
      const l = Math.max(2, Math.round(bouton.clientWidth)), h = Math.max(2, Math.round(bouton.clientHeight));
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
      const t = maintenant / 1000 + phase, d = img.data, E = 1 / 58, K = 1.7; // 58 px = une unité du champ
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
          let trait = (1 - lisse(0.8, 2.1, Math.abs(b - bord) / pente)) * (1 - lisse(0.16, 0.34, pente));
          const dx = (x / L - 0.5) * 2, dy = (y / H - 0.5) * 2, ell = Math.sqrt(dx * dx * 1.6 + dy * dy * 0.8); // 0 au centre du bouton
          trait *= v.lecture === "eclaircie" ? 0.05 + 0.95 * lisse(0.3, 0.92, ell) : 0.6 + 0.4 * lisse(0.12, 0.8, ell); // les lignes s'effacent autour du mot
          const c = COUL[(bord * 5) % 12];
          d[i] = 25 + (c[0] - 25) * trait; d[i + 1] = 22 + (c[1] - 22) * trait; d[i + 2] = 34 + (c[2] - 34) * trait; d[i + 3] = 255;
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
