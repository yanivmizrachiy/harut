/**
 * Interactive WebGL 3D Geometric Cone Visualization Engine
 * Powered by Three.js (Hardware Accelerated PBR, Real-time Clipping, 3D Billboards, Exploded Views)
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class Cone3DStudio {
  constructor() {
    this.isOpen = false;
    this.radius = 6;
    this.height = 8;
    this.showAxialTriangle = true;
    this.showDimensions = true;
    this.showLabels = true;
    this.isTransparent = true;
    this.isAutoRotate = false;
    this.sliceHeightPercent = 100;
    this.axialSplitDistance = 0;
    this.theme = 'glass';

    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.controls = null;
    this.animId = null;
    this.coneGroup = null;
    this.axialGroup = null;
    this.dimGroup = null;
    this.labelsGroup = null;
    this.waffleTexture = null;

    this.initDOM();
  }

  $(id) {
    return document.getElementById(id);
  }

  initDOM() {
    const modal = document.createElement('div');
    modal.id = 'cone3d-modal';
    modal.className = 'cone3d-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-label', 'מעבדת תלת־ממד אינטראקטיבית מתקדמת לחרוט');

    modal.innerHTML = `
      <div class="cone3d-dialog">
        <header class="cone3d-header">
          <div class="cone3d-header-title">
            <span class="cone3d-header-icon">🧊</span>
            <div>
              <h3>מעבדת תלת־ממד WebGL אינטראקטיבית — חרוט ישר</h3>
              <p>גרפיקה תלת־ממדית מואצת חומרה (PBR) — סיבוב 360°, חתכים דינמיים, משפט פיתגורס ונוסחאות חיות</p>
            </div>
          </div>
          <div class="cone3d-header-actions">
            <div class="c3d-cam-presets" role="group" aria-label="זוויות מבט">
              <button type="button" class="c3d-cam-btn active" id="c3d-cam-iso" title="מבט תלת־ממד איזומטרי">3D</button>
              <button type="button" class="c3d-cam-btn" id="c3d-cam-top" title="מבט מלמעלה (עיגול הבסיס)">על</button>
              <button type="button" class="c3d-cam-btn" id="c3d-cam-side" title="מבט מהצד (משולש שווה־שוקיים)">צד</button>
              <button type="button" class="c3d-cam-btn" id="c3d-cam-cut" title="מבט חזיתי לחתך הצירי">חתך</button>
            </div>
            <button type="button" class="cone3d-btn-icon" id="cone3d-autorotate" title="הפעל / השהה סיבוב אוטומטי">🔄</button>
            <button type="button" class="cone3d-btn-icon" id="cone3d-reset-cam" title="איפוס זווית מבט">🎯</button>
            <button type="button" class="cone3d-close-btn" id="cone3d-close" title="סגור מעבדה">✕</button>
          </div>
        </header>

        <div class="cone3d-body">
          <div class="cone3d-viewport" id="cone3d-canvas-wrap">
            <div class="cone3d-view-badge">
              <span>🖱️ גררו לסיבוב 360°</span> • <span>🔍 גלגלת לזום</span> • <span>👆 קליק ימני להזזה</span>
            </div>
            <div class="cone3d-formula-overlay">
              <span class="c3d-fo-tag">משפט פיתגורס בחצי החתך הצירי:</span>
              <span class="c3d-fo-math">r² + h² = s² &nbsp;➔&nbsp; <span id="c3d-fo-calc">6² + 8² = 10²</span></span>
            </div>
          </div>

          <aside class="cone3d-sidebar">
            <section class="cone3d-panel">
              <h4>ממדי החרוט בס״מ</h4>
              <div class="cone3d-field">
                <div class="cone3d-field-header"><label for="c3d-radius">רדיוס הבסיס (r):</label><span class="cone3d-val" id="c3d-radius-val">6 ס״מ</span></div>
                <input type="range" id="c3d-radius" min="2" max="15" step="0.5" value="6">
              </div>
              <div class="cone3d-field">
                <div class="cone3d-field-header"><label for="c3d-height">גובה החרוט (h):</label><span class="cone3d-val" id="c3d-height-val">8 ס״מ</span></div>
                <input type="range" id="c3d-height" min="3" max="22" step="0.5" value="8">
              </div>
            </section>

            <section class="cone3d-panel cone3d-calc-panel">
              <h4>חישובים גאומטריים בזמן אמת</h4>
              <div class="cone3d-calc-grid">
                <div class="cone3d-calc-item highlight"><span class="c3d-label">היוצר (s = √(r²+h²)):</span><strong class="c3d-number" id="c3d-s-val">10.00 ס״מ</strong></div>
                <div class="cone3d-calc-item"><span class="c3d-label">היקף הבסיס (2 · π · r):</span><strong class="c3d-number" id="c3d-c-val">12π ס״מ</strong></div>
                <div class="cone3d-calc-item"><span class="c3d-label">שטח הבסיס (π · r²):</span><strong class="c3d-number" id="c3d-b-val">36π ס״מ²</strong></div>
                <div class="cone3d-calc-item highlight-alt"><span class="c3d-label">נפח החרוט (⅓ · π · r² · h):</span><strong class="c3d-number" id="c3d-v-val">96π ס״מ³</strong></div>
                <div class="cone3d-calc-item"><span class="c3d-label">שטח המעטפת (π · r · s):</span><strong class="c3d-number" id="c3d-m-val">60π ס״מ²</strong></div>
                <div class="cone3d-calc-item"><span class="c3d-label">זווית הגזרה בפריסה:</span><strong class="c3d-number" id="c3d-alpha-val">216.0°</strong></div>
              </div>
            </section>

            <section class="cone3d-panel">
              <h4>חיתוכים גאומטריים (Conic Sections)</h4>
              <div class="cone3d-field">
                <div class="cone3d-field-header"><label for="c3d-slice-slider">חיתוך אופקי מקביל לבסיס:</label><span class="cone3d-val" id="c3d-slice-val">שלם (100%)</span></div>
                <input type="range" id="c3d-slice-slider" min="20" max="100" step="1" value="100">
                <div class="c3d-sub-info" id="c3d-slice-info">רדיוס מעגל החתך: 6.0 ס״מ</div>
              </div>
              <div class="cone3d-field" style="margin-top: 8px;">
                <div class="cone3d-field-header"><label for="c3d-axial-split">פיצול חתך צירי (Exploded View):</label><span class="cone3d-val" id="c3d-split-val">מחובר (0)</span></div>
                <input type="range" id="c3d-axial-split" min="0" max="12" step="0.5" value="0">
              </div>
            </section>

            <section class="cone3d-panel">
              <h4>שכבות חזותיות בתלת־ממד</h4>
              <div class="cone3d-toggles">
                <label class="cone3d-checkbox"><input type="checkbox" id="c3d-toggle-tri" checked><span>משולש חצי חתך צירי (פיתגורס r, h, s)</span></label>
                <label class="cone3d-checkbox"><input type="checkbox" id="c3d-toggle-dims" checked><span>וקטורי מידות וסימון זווית ישרה (∟)</span></label>
                <label class="cone3d-checkbox"><input type="checkbox" id="c3d-toggle-labels" checked><span>תגיות מרחביות (קודקוד, גובה, רדיוס, יוצר)</span></label>
                <label class="cone3d-checkbox"><input type="checkbox" id="c3d-toggle-trans" checked><span>שקיפות מעטפת (מבט שקוף לפנים החרוט)</span></label>
              </div>
            </section>

            <section class="cone3d-panel">
              <h4>חומריות ותאורה מואצת חומרה</h4>
              <div class="cone3d-themes">
                <button type="button" class="c3d-theme-btn" data-theme="cyan">סגנון ספר</button>
                <button type="button" class="c3d-theme-btn active" data-theme="glass">זכוכית קריסטל</button>
                <button type="button" class="c3d-theme-btn" data-theme="gold">גביע וופל תלת־ממדי</button>
                <button type="button" class="c3d-theme-btn" data-theme="hologram">הולוגרמה ניאון</button>
                <button type="button" class="c3d-theme-btn" data-theme="titanium">טיטניום מוברש</button>
                <button type="button" class="c3d-theme-btn" data-theme="wire">שרטוט טכני CAD</button>
              </div>
            </section>
          </aside>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.container = this.$('cone3d-canvas-wrap');
    this.bindEvents();
  }

  bindEvents() {
    this.$('cone3d-close').addEventListener('click', () => this.close());
    this.$('cone3d-modal').addEventListener('click', (e) => e.target.id === 'cone3d-modal' && this.close());

    ['iso', 'top', 'side', 'cut'].forEach(type => {
      this.$(`c3d-cam-${type}`).addEventListener('click', () => this.setCameraView(type));
    });

    this.$('cone3d-reset-cam').addEventListener('click', () => this.setCameraView('iso'));

    const autoRotBtn = this.$('cone3d-autorotate');
    autoRotBtn.addEventListener('click', () => {
      this.isAutoRotate = !this.isAutoRotate;
      autoRotBtn.classList.toggle('active', this.isAutoRotate);
      if (this.controls) this.controls.autoRotate = this.isAutoRotate;
    });

    const bindSlider = (id, valId, format, onChange) => {
      const el = this.$(id);
      el.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.$(valId).textContent = format(val);
        onChange(val);
        this.rebuildCone();
      });
    };

    bindSlider('c3d-radius', 'c3d-radius-val', v => `${v} ס״מ`, v => { this.radius = v; this.updateCalculations(); });
    bindSlider('c3d-height', 'c3d-height-val', v => `${v} ס״מ`, v => { this.height = v; this.updateCalculations(); });
    bindSlider('c3d-slice-slider', 'c3d-slice-val', v => (v === 100 ? 'שלם (100%)' : `${v}%`), v => {
      this.sliceHeightPercent = v;
      this.$('c3d-slice-info').textContent = `רדיוס מעגל החתך: ${(this.radius * (v / 100)).toFixed(2)} ס״מ`;
    });
    bindSlider('c3d-axial-split', 'c3d-split-val', v => (v === 0 ? 'מחובר (0)' : `${v} ס״מ`), v => { this.axialSplitDistance = v; });

    const bindToggle = (id, prop, groupProp, rebuild = false) => {
      this.$(id).addEventListener('change', (e) => {
        this[prop] = e.target.checked;
        if (rebuild) this.rebuildCone();
        else if (this[groupProp]) this[groupProp].visible = this[prop];
      });
    };

    bindToggle('c3d-toggle-tri', 'showAxialTriangle', 'axialGroup');
    bindToggle('c3d-toggle-dims', 'showDimensions', 'dimGroup');
    bindToggle('c3d-toggle-labels', 'showLabels', 'labelsGroup');
    bindToggle('c3d-toggle-trans', 'isTransparent', null, true);

    const themeBtns = document.querySelectorAll('.c3d-theme-btn');
    themeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        themeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.theme = btn.dataset.theme;
        this.rebuildCone();
      });
    });

    window.addEventListener('resize', () => {
      if (!this.isOpen || !this.renderer || !this.camera) return;
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });
  }

  setCameraView(type) {
    if (!this.camera || !this.controls) return;
    document.querySelectorAll('.c3d-cam-btn').forEach(b => b.classList.remove('active'));
    const btn = this.$(`c3d-cam-${type}`);
    if (btn) btn.classList.add('active');

    const h = this.height;
    const dist = Math.max(20, Math.max(this.radius, this.height) * 2.5);

    const views = {
      iso:  [dist * 0.8, h * 0.9, dist * 0.8, 0, h * 0.45, 0],
      top:  [0, dist * 1.3, 0.01, 0, 0, 0],
      side: [dist * 1.2, h * 0.5, 0, 0, h * 0.5, 0],
      cut:  [0, h * 0.5, dist * 1.2, 0, h * 0.5, 0]
    };
    const [cx, cy, cz, tx, ty, tz] = views[type] || views.iso;
    this.camera.position.set(cx, cy, cz);
    this.controls.target.set(tx, ty, tz);
    this.controls.update();
  }

  initThree() {
    if (this.renderer) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.localClippingEnabled = true;
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf6f9fc);

    this.camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 1000);
    this.setCameraView('iso');

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 120;
    this.controls.autoRotateSpeed = 1.4;

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xc2d4e5, 0.95));

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.3);
    keyLight.position.set(25, 40, 30);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.bias = -0.0002;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 150;
    ['left', 'right', 'top', 'bottom'].forEach((side, i) => {
      keyLight.shadow.camera[side] = (i % 2 === 0 ? -1 : 1) * 25;
    });
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.85);
    rimLight.position.set(-25, 15, -25);
    this.scene.add(rimLight);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.ShadowMaterial({ opacity: 0.18 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.05;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const polarGrid = new THREE.PolarGridHelper(35, 16, 8, 64, 0x1685a8, 0xd0e2ee);
    polarGrid.position.y = -0.04;
    this.scene.add(polarGrid);

    this.coneGroup = new THREE.Group();
    this.scene.add(this.coneGroup);

    this.rebuildCone();

    const animate = () => {
      this.animId = requestAnimationFrame(animate);
      if (this.controls) this.controls.update();
      if (this.renderer && this.scene && this.camera) this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  getWaffleTexture() {
    if (this.waffleTexture) return this.waffleTexture;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f0ae53';
    ctx.fillRect(0, 0, 512, 512);

    const drawGrid = (stroke, width, offset = 0) => {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      for (let i = -512; i <= 1024; i += 32) {
        ctx.beginPath();
        ctx.moveTo(i + offset, 0);
        ctx.lineTo(i + 512 + offset, 512);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(i + offset, 512);
        ctx.lineTo(i + 512 + offset, 0);
        ctx.stroke();
      }
    };
    drawGrid('#c47d25', 14);
    drawGrid('#ffd885', 4, 4);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 6);
    return (this.waffleTexture = tex);
  }

  createBillboardBadge(text, subtext = '', bgColor = '#0e6785', borderColor = '#38bdf8') {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');

    ctx.beginPath();
    ctx.roundRect(16, 16, 480, 128, 28);
    ctx.fillStyle = bgColor;
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = borderColor;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px "Rubik", "Heebo", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = subtext ? 'top' : 'middle';
    ctx.direction = 'rtl';
    ctx.fillText(text, 256, subtext ? 36 : 80);

    if (subtext) {
      ctx.fillStyle = '#bae6fd';
      ctx.font = 'bold 26px "Rubik", "Heebo", Arial, sans-serif';
      ctx.fillText(subtext, 256, 88);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sprite.scale.set(6.4, 2.0, 1);
    return sprite;
  }

  getMaterials() {
    const isTrans = this.isTransparent;
    const themes = {
      glass: {
        cone: new THREE.MeshPhysicalMaterial({ color: 0x93c5fd, transmission: 0.82, opacity: 1, transparent: true, roughness: 0.12, ior: 1.48, reflectivity: 0.6, clearcoat: 0.9, clearcoatRoughness: 0.1, side: THREE.DoubleSide }),
        base: new THREE.MeshPhysicalMaterial({ color: 0x60a5fa, transmission: 0.75, roughness: 0.2, transparent: true, side: THREE.DoubleSide }),
        edge: new THREE.LineBasicMaterial({ color: 0x0369a1, linewidth: 2 })
      },
      gold: {
        cone: new THREE.MeshStandardMaterial({ map: this.getWaffleTexture(), roughness: 0.45, metalness: 0.05, side: THREE.DoubleSide }),
        base: new THREE.MeshStandardMaterial({ color: 0xffedd5, roughness: 0.6, side: THREE.DoubleSide }),
        edge: new THREE.LineBasicMaterial({ color: 0x92400e, linewidth: 2 })
      },
      hologram: {
        cone: new THREE.MeshBasicMaterial({ color: 0x00f0ff, wireframe: true, transparent: true, opacity: 0.75 }),
        base: new THREE.MeshBasicMaterial({ color: 0x0e7490, wireframe: true, transparent: true, opacity: 0.8 }),
        edge: new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 3 })
      },
      titanium: {
        cone: new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.9, roughness: 0.2, side: THREE.DoubleSide }),
        base: new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.85, roughness: 0.25, side: THREE.DoubleSide }),
        edge: new THREE.LineBasicMaterial({ color: 0x1e293b, linewidth: 2 })
      },
      wire: {
        cone: new THREE.MeshBasicMaterial({ color: 0x0e6785, wireframe: true }),
        base: new THREE.MeshBasicMaterial({ color: 0x1685a8, wireframe: true }),
        edge: new THREE.LineBasicMaterial({ color: 0x0e6785, linewidth: 2 })
      },
      cyan: {
        cone: new THREE.MeshPhysicalMaterial({ color: 0x1685a8, roughness: 0.28, metalness: 0.12, clearcoat: 0.7, clearcoatRoughness: 0.15, transparent: isTrans, opacity: isTrans ? 0.78 : 1.0, side: THREE.DoubleSide }),
        base: new THREE.MeshPhysicalMaterial({ color: 0xd9f2fb, roughness: 0.35, transparent: isTrans, opacity: isTrans ? 0.88 : 1.0, side: THREE.DoubleSide }),
        edge: new THREE.LineBasicMaterial({ color: 0x0e6785, linewidth: 2 })
      }
    };
    return themes[this.theme] || themes.cyan;
  }

  rebuildCone() {
    if (!this.scene || !this.coneGroup) return;

    while (this.coneGroup.children.length > 0) {
      const obj = this.coneGroup.children[0];
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
      this.coneGroup.remove(obj);
    }

    const { radius: r, height: h } = this;
    const s = Math.hypot(r, h);
    const sliceRatio = this.sliceHeightPercent / 100;
    const currentH = h * sliceRatio;
    const currentTopR = r * (1 - sliceRatio);
    const splitX = this.axialSplitDistance;

    const { cone: coneMat, base: baseMat, edge: edgeMat } = this.getMaterials();

    if (splitX > 0.1) {
      [-1, 1].forEach((dir, i) => {
        const offset = (dir * splitX) / 2;
        const startAngle = i === 0 ? Math.PI / 2 : -Math.PI / 2;
        const halfCone = new THREE.Mesh(new THREE.CylinderGeometry(currentTopR, r, currentH, 32, 16, true, startAngle, Math.PI), coneMat);
        halfCone.position.set(offset, currentH / 2, 0);
        halfCone.castShadow = true;
        this.coneGroup.add(halfCone);

        const halfBase = new THREE.Mesh(new THREE.CircleGeometry(r, 32, startAngle, Math.PI), baseMat);
        halfBase.rotation.x = Math.PI / 2;
        halfBase.position.set(offset, 0, 0);
        this.coneGroup.add(halfBase);
      });
    } else {
      const meshCone = new THREE.Mesh(new THREE.CylinderGeometry(currentTopR, r, currentH, 64, 16, true), coneMat);
      meshCone.position.y = currentH / 2;
      meshCone.castShadow = meshCone.receiveShadow = true;
      this.coneGroup.add(meshCone);

      const baseGeo = new THREE.CircleGeometry(r, 64);
      const meshBase = new THREE.Mesh(baseGeo, baseMat);
      meshBase.rotation.x = Math.PI / 2;
      meshBase.receiveShadow = true;
      this.coneGroup.add(meshBase);

      const baseRim = new THREE.LineSegments(new THREE.EdgesGeometry(baseGeo), edgeMat);
      baseRim.rotation.x = Math.PI / 2;
      this.coneGroup.add(baseRim);
    }

    if (sliceRatio < 0.999 && currentTopR > 0.05) {
      const topCapGeo = new THREE.CircleGeometry(currentTopR, 64);
      const topCapMesh = new THREE.Mesh(topCapGeo, new THREE.MeshPhysicalMaterial({ color: 0x38bdf8, metalness: 0.1, roughness: 0.2, clearcoat: 0.8, side: THREE.DoubleSide }));
      topCapMesh.rotation.x = -Math.PI / 2;
      topCapMesh.position.y = currentH;
      this.coneGroup.add(topCapMesh);

      const sliceRim = new THREE.LineSegments(new THREE.EdgesGeometry(topCapGeo), new THREE.LineBasicMaterial({ color: 0x0284c7, linewidth: 3 }));
      sliceRim.rotation.x = -Math.PI / 2;
      sliceRim.position.y = currentH;
      this.coneGroup.add(sliceRim);
    }

    // 4. Axial Section Triangle
    this.axialGroup = new THREE.Group();
    const triGeo = new THREE.BufferGeometry();
    triGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, r, 0, 0, 0, h, 0]), 3));
    triGeo.computeVertexNormals();
    this.axialGroup.add(new THREE.Mesh(triGeo, new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.72, side: THREE.DoubleSide })));

    const triPts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(r, 0, 0), new THREE.Vector3(0, h, 0), new THREE.Vector3(0, 0, 0)];
    this.axialGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(triPts), new THREE.LineBasicMaterial({ color: 0xd97706, linewidth: 2.5 })));

    const sq = Math.min(1.4, r * 0.22);
    const sqPts = [new THREE.Vector3(0, sq, 0), new THREE.Vector3(sq, sq, 0), new THREE.Vector3(sq, 0, 0)];
    this.axialGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(sqPts), new THREE.LineBasicMaterial({ color: 0x1f2937, linewidth: 2 })));
    this.axialGroup.visible = this.showAxialTriangle;
    this.coneGroup.add(this.axialGroup);

    // 5. Dimension Vectors
    this.dimGroup = new THREE.Group();
    const createDimLine = (pts, mat, isDashed = false) => {
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(geo, mat);
      if (isDashed) line.computeLineDistances();
      return line;
    };

    this.dimGroup.add(createDimLine([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, h, 0)], new THREE.LineDashedMaterial({ color: 0xef4444, dashSize: 0.5, gapSize: 0.3, linewidth: 3 }), true));
    this.dimGroup.add(createDimLine([new THREE.Vector3(0, 0, 0), new THREE.Vector3(r, 0, 0)], new THREE.LineBasicMaterial({ color: 0x0284c7, linewidth: 4 })));
    this.dimGroup.add(createDimLine([new THREE.Vector3(0, h, 0), new THREE.Vector3(r, 0, 0)], new THREE.LineBasicMaterial({ color: 0xf59e0b, linewidth: 4 })));

    const dotGeo = new THREE.SphereGeometry(Math.min(0.4, r * 0.06), 16, 16);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const apexDot = new THREE.Mesh(dotGeo, dotMat);
    apexDot.position.set(0, h, 0);
    this.dimGroup.add(apexDot);
    this.dimGroup.add(new THREE.Mesh(dotGeo, dotMat));
    this.dimGroup.visible = this.showDimensions;
    this.coneGroup.add(this.dimGroup);

    // 6. 3D Billboard Badges
    this.labelsGroup = new THREE.Group();
    const addBadge = (text, sub, bg, border, x, y, z) => {
      const badge = this.createBillboardBadge(text, sub, bg, border);
      badge.position.set(x, y, z);
      this.labelsGroup.add(badge);
    };

    addBadge('קודקוד החרוט', `גובה מוחלט: ${h} ס״מ`, '#b91c1c', '#f87171', 0, h + 1.8, 0);
    addBadge(`גובה h = ${h} ס״מ`, 'אנך למישור הבסיס', '#dc2626', '#fca5a5', -2.8, h * 0.5, 0);
    addBadge(`רדיוס r = ${r} ס״מ`, `היקף = ${(2 * r).toFixed(1)}π`, '#0284c7', '#38bdf8', r * 0.5, -1.2, 0);
    addBadge(`יוצר s = ${s.toFixed(2)} ס״מ`, 'היתר בחצי החתך', '#d97706', '#fde047', r * 0.65 + 1.8, h * 0.5 + 0.5, 0);

    this.labelsGroup.visible = this.showLabels;
    this.coneGroup.add(this.labelsGroup);
  }

  updateCalculations() {
    const { radius: r, height: h } = this;
    const s = Math.hypot(r, h);
    const setTxt = (id, txt) => {
      const el = this.$(id);
      if (el) el.textContent = txt;
    };

    setTxt('c3d-s-val', `${s.toFixed(2)} ס״מ`);
    setTxt('c3d-c-val', `${(2 * r).toFixed(1)}π ס״מ (${(2 * Math.PI * r).toFixed(1)})`);
    setTxt('c3d-b-val', `${(r * r).toFixed(1)}π ס״מ² (${(Math.PI * r * r).toFixed(1)})`);
    setTxt('c3d-v-val', `${((1 / 3) * r * r * h).toFixed(1)}π ס״מ³ (${((1 / 3) * Math.PI * r * r * h).toFixed(1)})`);
    setTxt('c3d-m-val', `${(r * s).toFixed(1)}π ס״מ² (${(Math.PI * r * s).toFixed(1)})`);
    setTxt('c3d-alpha-val', `${(360 * (r / s)).toFixed(1)}°`);
    setTxt('c3d-fo-calc', `${r}² + ${h}² = ${s.toFixed(2)}² (${r * r} + ${h * h} = ${(s * s).toFixed(1)})`);
  }

  openWithParams(radius, height) {
    if (radius && !isNaN(radius)) this.radius = radius;
    if (height && !isNaN(height)) this.height = height;

    const rInput = this.$('c3d-radius');
    const hInput = this.$('c3d-height');
    if (rInput) rInput.value = this.radius;
    if (hInput) hInput.value = this.height;
    this.$('c3d-radius-val').textContent = `${this.radius} ס״מ`;
    this.$('c3d-height-val').textContent = `${this.height} ס״מ`;
    this.open();
  }

  open() {
    this.isOpen = true;
    this.$('cone3d-modal').classList.add('open');
    document.body.style.overflow = 'hidden';
    this.initThree();
    this.updateCalculations();
    this.rebuildCone();
    this.setCameraView('iso');
  }

  close() {
    this.isOpen = false;
    const modal = this.$('cone3d-modal');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
  }
}
