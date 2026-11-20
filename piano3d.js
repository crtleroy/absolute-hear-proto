/* Absolute Hear — le piano de verre de l'accueil, en vraie 3D (three.js).
   88 touches de verre posées sur une table sombre. Chaque touche acquise contient une vraie source de lumière, à la couleur
   de sa note : elle éclaire ses voisines et la table, s'y reflète, et rayonne. Si la 3D n'est pas disponible, l'appli garde
   le clavier dessiné en 2D. */
(function () {
  "use strict";
  if (!window.THREE) return;
  const T = window.THREE;
  const NOIRES = [1, 3, 6, 8, 10], DECAL = { 1: -0.12, 3: 0.12, 6: -0.16, 8: 0, 10: 0.16 };
  const LB = 2.35, LONG_B = 15, HAUT_B = 2.1, LN = 1.37, LONG_N = 9.6, HAUT_N = 1.1; // dimensions réelles, en centimètres
  const FORCE = [0, 0.3, 0.5, 0.72, 0.95, 1.25]; // intensité lumineuse selon le niveau de la touche (0 à 5)
  const NB_LAMPES = 14; // vraies sources de lumière simultanées (les touches les plus avancées)

  const vue = { x: 0, l: 0, cx: 0, cl: 0 };
  let rendu, scene, camera, composeur, zone, touches = {}, lampes = [], actif = false, dernier = 0, t0 = performance.now();

  function monter(el) {
    zone = el;
    rendu = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    rendu.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    rendu.setClearColor(0x000000, 0);
    rendu.physicallyCorrectLights = true;
    rendu.toneMapping = T.ACESFilmicToneMapping;
    rendu.toneMappingExposure = 1.0;
    zone.innerHTML = "";
    zone.appendChild(rendu.domElement);
    scene = new T.Scene();
    scene.fog = null;
    camera = new T.PerspectiveCamera(18, 2, 0.5, 900);

    // la table : sombre, lisse, légèrement réfléchissante
    const table = new T.Mesh(new T.PlaneGeometry(600, 300), new T.MeshStandardMaterial({ color: 0x1a1824, roughness: 0.55, metalness: 0.2 }));
    table.rotation.x = -Math.PI / 2;
    table.renderOrder = 1;
    scene.add(table);

    // lumière d'ambiance très faible, et un contre-jour froid qui dessine les arêtes du verre
    scene.add(new T.AmbientLight(0x40435e, 1.5));
    const contre = new T.DirectionalLight(0x9aa6ff, 0.9);
    contre.position.set(-40, 50, -80);
    scene.add(contre);
    const face = new T.DirectionalLight(0xfff0d8, 1.1);
    face.position.set(30, 40, 90);
    scene.add(face);

    const piano = new T.Group(), reflet = new T.Group();
    reflet.scale.y = -1; // le même piano, à l'envers sous la table : son reflet
    scene.add(reflet, piano);
    const geoB = new T.BoxGeometry(LB - 0.12, HAUT_B, LONG_B), geoN = new T.BoxGeometry(LN, HAUT_N, LONG_N);
    const areteB = new T.EdgesGeometry(geoB), areteN = new T.EdgesGeometry(geoN);
    let blanches = 0;
    const x0 = -(52 * LB) / 2;
    for (let m = 21; m <= 108; m++) {
      const noire = NOIRES.includes(m % 12);
      const verre = new T.MeshPhysicalMaterial({
        color: noire ? 0x0a0a10 : 0x9da3bd, roughness: 0.16, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.35,
        transparent: true, opacity: noire ? 0.9 : 0.62, emissive: 0x000000, emissiveIntensity: 0, depthWrite: noire,
      });
      const trait = new T.LineBasicMaterial({ color: noire ? 0x5a5f7a : 0xd8dcf0, transparent: true, opacity: noire ? 0.35 : 0.22 });
      const x = noire ? x0 + (blanches + DECAL[m % 12]) * LB : x0 + blanches * LB + LB / 2;
      const y = noire ? HAUT_B + HAUT_N / 2 : HAUT_B / 2, z = noire ? -(LONG_B - LONG_N) / 2 : 0;
      for (const groupe of [piano, reflet]) {
        const maille = new T.Mesh(noire ? geoN : geoB, verre);
        maille.position.set(x, y + 0.02, z);
        maille.renderOrder = groupe === piano ? (noire ? 4 : 3) : 0;
        groupe.add(maille);
        const arete = new T.LineSegments(noire ? areteN : areteB, trait);
        arete.position.copy(maille.position);
        arete.renderOrder = maille.renderOrder;
        groupe.add(arete);
      }
      touches[m] = { verre, trait, noire, x, y, z, base: 0, cible: 0, flash: 0, couleur: new T.Color(0xffffff), phase: (m * 0.73) % 6.28, opacite: verre.opacity };
      if (!noire) blanches++;
    }
    for (let i = 0; i < NB_LAMPES; i++) { // les vraies lampes : elles éclairent les touches voisines et la table
      const l = new T.PointLight(0xffffff, 0, 40, 2);
      l.visible = false;
      scene.add(l);
      lampes.push(l);
    }
    if (T.EffectComposer && T.UnrealBloomPass) { // le halo : la lumière déborde autour de ce qui brille
      composeur = new T.EffectComposer(rendu);
      composeur.addPass(new T.RenderPass(scene, camera));
      composeur.addPass(new T.UnrealBloomPass(new T.Vector2(256, 256), 0.8, 0.75, 0.32));
    }
    new ResizeObserver(tailler).observe(zone);
    tailler();
    document.addEventListener("visibilitychange", () => { if (!document.hidden) boucle(); });
  }

  function tailler() {
    const L = zone.clientWidth, H = zone.clientHeight;
    if (!L || !H) return;
    rendu.setSize(L, H, false);
    if (composeur) composeur.setSize(L, H);
    camera.aspect = L / H;
    camera.updateProjectionMatrix();
  }

  /* niv : niveau (1 à 5) par touche ; avant : niveaux montrés la fois précédente ; couleurs : une couleur par note */
  function maj(niv, avant, couleurs) {
    const allumees = [];
    for (let m = 21; m <= 108; m++) {
      const k = touches[m], n = niv[m] || 0;
      k.cible = FORCE[n];
      k.couleur.set(couleurs[m % 12]);
      if (avant && n > (avant[m] || 0)) k.flash = 1; // la touche vient de progresser : elle s'éveille
      if (n) allumees.push([m, n]);
    }
    // cadrage : de la touche allumée la plus grave à la plus aiguë, avec une marge, et au moins deux octaves
    const notes = allumees.map((a) => a[0]);
    let bas = Math.max(21, (notes.length ? Math.min(...notes) : 60) - 5), haut = Math.min(108, (notes.length ? Math.max(...notes) : 60) + 5);
    while (haut - bas < 24) { if (bas > 21) bas--; if (haut < 108 && haut - bas < 24) haut++; }
    while (NOIRES.includes(bas % 12)) bas--;
    while (NOIRES.includes(haut % 12)) haut++;
    const g = touches[bas].x - LB / 2, d = touches[haut].x + LB / 2;
    vue.cx = (g + d) / 2;
    vue.cl = (d - g) * 1.03;
    if (!vue.l) { vue.x = vue.cx; vue.l = vue.cl; }
    allumees.sort((a, b) => b[1] - a[1]);
    lampes.forEach((l, i) => {
      const a = allumees[i];
      l.visible = !!a;
      if (!a) return;
      const k = touches[a[0]];
      l.userData.touche = k;
      l.color.copy(k.couleur);
      l.position.set(k.x, k.y + 6, k.z + (k.noire ? 1.5 : 4)); // juste au-dessus de la touche : la lumière tombe sur ses voisines et sur la table
    });
    actif = true;
    boucle();
  }

  let enCours = false;
  function boucle() {
    if (enCours) return;
    enCours = true;
    requestAnimationFrame(image);
  }
  function image(maintenant) {
    enCours = false;
    if (!actif || document.hidden || !zone.offsetParent) return; // on ne calcule rien quand le piano n'est pas à l'écran
    requestAnimationFrame((t) => { enCours = false; image(t); });
    enCours = true;
    if (maintenant - dernier < 30) return; // une trentaine d'images par seconde suffit, et ménage la batterie
    dernier = maintenant;
    const t = (maintenant - t0) / 1000;
    for (let m = 21; m <= 108; m++) {
      const k = touches[m];
      k.base += (k.cible - k.base) * 0.06; // la lumière monte doucement
      k.flash *= 0.965;
      const souffle = 1 + 0.16 * Math.sin(t * 0.7 + k.phase) + 0.05 * Math.sin(t * 1.9 + k.phase * 2);
      const i = k.base * souffle + k.flash * 2.4;
      k.verre.emissive.copy(k.couleur);
      k.verre.emissiveIntensity = i * (k.noire ? 0.45 : 0.6);
      k.verre.opacity = Math.min(0.95, k.opacite + i * 0.3);
      k.trait.color.copy(k.couleur).lerp(new T.Color(k.noire ? 0x5a5f7a : 0xd8dcf0), i > 0.02 ? 0.25 : 1);
      k.trait.opacity = (k.noire ? 0.35 : 0.22) + Math.min(0.6, i * 0.5);
      k.intensite = i;
    }
    lampes.forEach((l) => { if (l.visible) l.intensity = l.userData.touche.intensite * 30; });
    // vue du dessus, cadrée sur la partie du clavier qui sert ; le cadrage glisse doucement quand elle s'élargit
    vue.x += (vue.cx - vue.x) * 0.05;
    vue.l += (vue.cl - vue.l) * 0.05;
    const haut = (vue.l / 2) / (Math.tan((camera.fov * Math.PI) / 360) * camera.aspect);
    camera.up.set(0, 0, -1);
    camera.position.set(vue.x + Math.sin(t * 0.13) * 0.4, haut, 1.2 + Math.sin(t * 0.1) * 0.3);
    camera.lookAt(vue.x, 0, 1.2);
    if (composeur) composeur.render(); else rendu.render(scene, camera);
  }

  window.Piano3D = {
    maj(el, niv, avant, couleurs) {
      try {
        if (!rendu) monter(el);
        maj(niv, avant, couleurs);
        return true;
      } catch (e) {
        console.error("piano 3D indisponible", e);
        window.Piano3D = null; // on retombe sur le clavier 2D
        return false;
      }
    },
  };
})();
