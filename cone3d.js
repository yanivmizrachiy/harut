/**
 * State-of-the-Art WebGL 3D Geometric Cone Visualization Engine
 * Powered by Three.js (Hardware Accelerated PBR, Real-time Clipping, 3D Billboards, Exploded Views)
 * Single Source of Truth compliant: Zero text modification, dynamic DOM binding.
 */

import * as THREE from '/vendor/three/build/three.module.js';
import { OrbitControls } from '/vendor/three/examples/jsm/controls/OrbitControls.js';

export class Cone3DStudio {
  constructor() {
    this.isOpen = false;
    this.radius = 6;
    this.height = 8;
    this.slantHeight = Math.hypot(this.radius, this.height);

    // Display Toggles
    this.showAxialTriangle = true;
    this.showDimensions = true;
    this.showLabels = true;
    this.isTransparent = true;
    this.isAutoRotate = false;
    this.sliceHeightPercent = 100; // 100% = whole cone
    this.axialSplitDistance = 0; // 0 = closed, >0 = exploded
    this.theme = 'glass'; // 'cyan', 'gold', 'glass', 'wire', 'hologram', 'titanium'

    // Three.js instances
    this.container = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.controls = null;
    this.animId = null;

    // Groups & Meshes
    this.coneGroup = null;
    this.halfConeLeft = null;
    this.halfConeRight = null;
    this.meshBase = null;
    this.sliceCapMesh = null;
    this.slicePlane = null;
    this.axialGroup = null;
    this.dimGroup = null;
    this.labelsGroup = null;

    // Materials cache & textures
    this.waffleTexture = null;

    this.initDOM();
  }

  initDOM() {
    const modal = document.createElement('div');
    modal.id = 'cone3d-modal';
    modal.className = 'cone3d-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-label', 'מעבדת תלת־ממד אינטראקטיבית מתקדמת לחרוט');

    modal.innerHTML = `
      <div class="cone3d-dialog">
        <!-- Studio Header -->
        <header class="cone3d-header">
          <div class="cone3d-header-title">
            <span class="cone3d-header-icon">🧊</span>
            <div>
              <h3>מעבדת תלת־ממד WebGL אינטראקטיבית — חרוט ישר</h3>
              <p>גרפיקה תלת־ממדית מואצת חומרה (PBR) — סיבוב 360°, חתכים דינמיים, משפט פיתגורס ונוסחאות חיות</p>
            </div>
          </div>
          <div class="cone3d-header-actions">
            <!-- Camera Quick View Presets -->
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

        <!-- Studio Body -->
        <div class="cone3d-body">
          <!-- 3D Canvas Viewport -->
          <div class="cone3d-viewport" id="cone3d-canvas-wrap">
            <div class="cone3d-view-badge">
              <span>🖱️ גררו לסיבוב 360°</span>
              <span>•</span>
              <span>🔍 גלגלת לזום</span>
              <span>•</span>
              <span>👆 קליק ימני להזזה</span>
            </div>
            <div class="cone3d-formula-overlay" id="cone3d-formula-overlay">
              <span class="c3d-fo-tag">משפט פיתגורס בחצי החתך הצירי:</span>
              <span class="c3d-fo-math">r² + h² = s² &nbsp;➔&nbsp; <span id="c3d-fo-calc">6² + 8² = 10²</span></span>
            </div>
          </div>

          <!-- Controls & Live Calculations Sidebar -->
          <aside class="cone3d-sidebar">
            <!-- 1. Geometric Dimensions -->
            <section class="cone3d-panel">
              <h4>ממדי החרוט בס״מ</h4>
              <div class="cone3d-field">
                <div class="cone3d-field-header">
                  <label for="c3d-radius">רדיוס הבסיס (r):</label>
                  <span class="cone3d-val" id="c3d-radius-val">6 ס״מ</span>
                </div>
                <input type="range" id="c3d-radius" min="2" max="15" step="0.5" value="6">
              </div>

              <div class="cone3d-field">
                <div class="cone3d-field-header">
                  <label for="c3d-height">גובה החרוט (h):</label>
                  <span class="cone3d-val" id="c3d-height-val">8 ס״מ</span>
                </div>
                <input type="range" id="c3d-height" min="3" max="22" step="0.5" value="8">
              </div>
            </section>

            <!-- 2. Real-time Geometric Calculations -->
            <section class="cone3d-panel cone3d-calc-panel">
              <h4>חישובים גאומטריים בזמן אמת</h4>
              <div class="cone3d-calc-grid">
                <div class="cone3d-calc-item highlight">
                  <span class="c3d-label">היוצר (s = √(r²+h²)):</span>
                  <strong class="c3d-number" id="c3d-s-val">10.00 ס״מ</strong>
                </div>
                <div class="cone3d-calc-item">
                  <span class="c3d-label">היקף הבסיס (2 · π · r):</span>
                  <strong class="c3d-number" id="c3d-c-val">12π ס״מ</strong>
                </div>
                <div class="cone3d-calc-item">
                  <span class="c3d-label">שטח הבסיס (π · r²):</span>
                  <strong class="c3d-number" id="c3d-b-val">36π ס״מ²</strong>
                </div>
                <div class="cone3d-calc-item highlight-alt">
                  <span class="c3d-label">נפח החרוט (⅓ · π · r² · h):</span>
                  <strong class="c3d-number" id="c3d-v-val">96π ס״מ³</strong>
                </div>
                <div class="cone3d-calc-item">
                  <span class="c3d-label">שטח המעטפת (π · r · s):</span>
                  <strong class="c3d-number" id="c3d-m-val">60π ס״מ²</strong>
                </div>
                <div class="cone3d-calc-item">
                  <span class="c3d-label">זווית הגזרה בפריסה:</span>
                  <strong class="c3d-number" id="c3d-alpha-val">216.0°</strong>
                </div>
              </div>
            </section>

            <!-- 3. Real-time Slicing & Conic Sections -->
            <section class="cone3d-panel">
              <h4>חיתוכים גאומטריים (Conic Sections)</h4>
              
              <!-- Horizontal Slice (Truncated Cone) -->
              <div class="cone3d-field">
                <div class="cone3d-field-header">
                  <label for="c3d-slice-slider">חיתוך אופקי מקביל לבסיס:</label>
                  <span class="cone3d-val" id="c3d-slice-val">שלם (100%)</span>
                </div>
                <input type="range" id="c3d-slice-slider" min="20" max="100" step="1" value="100">
                <div class="c3d-sub-info" id="c3d-slice-info">רדיוס מעגל החתך: 6.0 ס״מ</div>
              </div>

              <!-- Exploded Axial Split -->
              <div class="cone3d-field" style="margin-top: 8px;">
                <div class="cone3d-field-header">
                  <label for="c3d-axial-split">פיצול חתך צירי (Exploded View):</label>
                  <span class="cone3d-val" id="c3d-split-val">מחובר (0)</span>
                </div>
                <input type="range" id="c3d-axial-split" min="0" max="12" step="0.5" value="0">
              </div>
            </section>

            <!-- 4. Interactive 3D Layers -->
            <section class="cone3d-panel">
              <h4>שכבות חזותיות בתלת־ממד</h4>
              <div class="cone3d-toggles">
                <label class="cone3d-checkbox">
                  <input type="checkbox" id="c3d-toggle-tri" checked>
                  <span>משולש חצי חתך צירי (פיתגורס r, h, s)</span>
                </label>
                <label class="cone3d-checkbox">
                  <input type="checkbox" id="c3d-toggle-dims" checked>
                  <span>וקטורי מידות וסימון זווית ישרה (∟)</span>
                </label>
                <label class="cone3d-checkbox">
                  <input type="checkbox" id="c3d-toggle-labels" checked>
                  <span>תגיות מרחביות (קודקוד, גובה, רדיוס, יוצר)</span>
                </label>
                <label class="cone3d-checkbox">
                  <input type="checkbox" id="c3d-toggle-trans" checked>
                  <span>שקיפות מעטפת (מבט שקוף לפנים החרוט)</span>
                </label>
              </div>
            </section>

            <!-- 5. Material & Shading Themes -->
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
    this.container = document.getElementById('cone3d-canvas-wrap');

    this.bindEvents();
  }

  bindEvents() {
    // Close
    document.getElementById('cone3d-close').addEventListener('click', () => this.close());
    document.getElementById('cone3d-modal').addEventListener('click', (e) => {
      if (e.target.id === 'cone3d-modal') this.close();
    });

    // Reset camera & views
    document.getElementById('cone3d-reset-cam').addEventListener('click', () => this.setCameraView('iso'));
    document.getElementById('c3d-cam-iso').addEventListener('click', () => this.setCameraView('iso'));
    document.getElementById('c3d-cam-top').addEventListener('click', () => this.setCameraView('top'));
    document.getElementById('c3d-cam-side').addEventListener('click', () => this.setCameraView('side'));
    document.getElementById('c3d-cam-cut').addEventListener('click', () => this.setCameraView('cut'));

    // Auto rotate
    const autoRotBtn = document.getElementById('cone3d-autorotate');
    autoRotBtn.addEventListener('click', () => {
      this.isAutoRotate = !this.isAutoRotate;
      autoRotBtn.classList.toggle('active', this.isAutoRotate);
      if (this.controls) this.controls.autoRotate = this.isAutoRotate;
    });

    // Sliders
    const radiusInput = document.getElementById('c3d-radius');
    const heightInput = document.getElementById('c3d-height');
    const sliceInput = document.getElementById('c3d-slice-slider');
    const splitInput = document.getElementById('c3d-axial-split');

    radiusInput.addEventListener('input', (e) => {
      this.radius = parseFloat(e.target.value);
      document.getElementById('c3d-radius-val').textContent = `${this.radius} ס״מ`;
      this.updateCalculations();
      this.rebuildCone();
    });

    heightInput.addEventListener('input', (e) => {
      this.height = parseFloat(e.target.value);
      document.getElementById('c3d-height-val').textContent = `${this.height} ס״מ`;
      this.updateCalculations();
      this.rebuildCone();
    });

    sliceInput.addEventListener('input', (e) => {
      this.sliceHeightPercent = parseFloat(e.target.value);
      document.getElementById('c3d-slice-val').textContent =
        this.sliceHeightPercent === 100 ? 'שלם (100%)' : `${this.sliceHeightPercent}%`;
      const cutR = (this.radius * (this.sliceHeightPercent / 100)).toFixed(2);
      document.getElementById('c3d-slice-info').textContent = `רדיוס מעגל החתך: ${cutR} ס״מ`;
      this.rebuildCone();
    });

    splitInput.addEventListener('input', (e) => {
      this.axialSplitDistance = parseFloat(e.target.value);
      document.getElementById('c3d-split-val').textContent =
        this.axialSplitDistance === 0 ? 'מחובר (0)' : `${this.axialSplitDistance} ס״מ`;
      this.rebuildCone();
    });

    // Toggles
    document.getElementById('c3d-toggle-tri').addEventListener('change', (e) => {
      this.showAxialTriangle = e.target.checked;
      if (this.axialGroup) this.axialGroup.visible = this.showAxialTriangle;
    });

    document.getElementById('c3d-toggle-dims').addEventListener('change', (e) => {
      this.showDimensions = e.target.checked;
      if (this.dimGroup) this.dimGroup.visible = this.showDimensions;
    });

    document.getElementById('c3d-toggle-labels').addEventListener('change', (e) => {
      this.showLabels = e.target.checked;
      if (this.labelsGroup) this.labelsGroup.visible = this.showLabels;
    });

    document.getElementById('c3d-toggle-trans').addEventListener('change', (e) => {
      this.isTransparent = e.target.checked;
      this.rebuildCone();
    });

    // Theme selector
    const themeBtns = document.querySelectorAll('.c3d-theme-btn');
    themeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        themeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.theme = btn.dataset.theme;
        this.rebuildCone();
      });
    });

    // Responsive Canvas Resize
    window.addEventListener('resize', () => {
      if (!this.isOpen || !this.renderer || !this.camera) return;
      const width = this.container.clientWidth;
      const height = this.container.clientHeight;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    });
  }

  setCameraView(type) {
    if (!this.camera || !this.controls) return;

    // Highlight button
    document.querySelectorAll('.c3d-cam-btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(`c3d-cam-${type}`);
    if (btn) btn.classList.add('active');

    const h = this.height;
    const dist = Math.max(20, Math.max(this.radius, this.height) * 2.5);

    if (type === 'iso') {
      this.camera.position.set(dist * 0.8, h * 0.9, dist * 0.8);
      this.controls.target.set(0, h * 0.45, 0);
    } else if (type === 'top') {
      this.camera.position.set(0, dist * 1.3, 0.01);
      this.controls.target.set(0, 0, 0);
    } else if (type === 'side') {
      this.camera.position.set(dist * 1.2, h * 0.5, 0);
      this.controls.target.set(0, h * 0.5, 0);
    } else if (type === 'cut') {
      this.camera.position.set(0, h * 0.5, dist * 1.2);
      this.controls.target.set(0, h * 0.5, 0);
    }
    this.controls.update();
  }

  initThree() {
    if (this.renderer) return;

    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    // Hardware-accelerated WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.localClippingEnabled = true;
    this.container.appendChild(this.renderer.domElement);

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf6f9fc);

    // Camera
    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
    this.setCameraView('iso');

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 120;
    this.controls.autoRotateSpeed = 1.4;

    // Studio Lighting
    const ambientLight = new THREE.HemisphereLight(0xffffff, 0xc2d4e5, 0.95);
    this.scene.add(ambientLight);

    // Key directional light with soft shadow
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.3);
    keyLight.position.set(25, 40, 30);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.bias = -0.0002;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 150;
    keyLight.shadow.camera.left = -25;
    keyLight.shadow.camera.right = 25;
    keyLight.shadow.camera.top = 25;
    keyLight.shadow.camera.bottom = -25;
    this.scene.add(keyLight);

    // Cyan/Blue cool rim light
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.85);
    rimLight.position.set(-25, 15, -25);
    this.scene.add(rimLight);

    // Warm bounce light
    const bounceLight = new THREE.DirectionalLight(0xffedd5, 0.45);
    bounceLight.position.set(0, -10, 20);
    this.scene.add(bounceLight);

    // Ground Plane with contact shadow receiver
    const floorGeo = new THREE.PlaneGeometry(120, 120);
    const floorMat = new THREE.ShadowMaterial({ opacity: 0.18 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.05;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Circular ground grid
    const polarGrid = new THREE.PolarGridHelper(35, 16, 8, 64, 0x1685a8, 0xd0e2ee);
    polarGrid.position.y = -0.04;
    this.scene.add(polarGrid);

    // Root Group
    this.coneGroup = new THREE.Group();
    this.scene.add(this.coneGroup);

    this.rebuildCone();
    this.startLoop();
  }

  startLoop() {
    const animate = () => {
      this.animId = requestAnimationFrame(animate);
      if (this.controls) this.controls.update();
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
    };
    animate();
  }

  /**
   * Generates a procedural waffle pattern texture for the Ice Cream cone preset
   */
  getWaffleTexture() {
    if (this.waffleTexture) return this.waffleTexture;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Base biscuit tone
    ctx.fillStyle = '#f0ae53';
    ctx.fillRect(0, 0, 512, 512);

    // Diamond waffle grid lines
    ctx.strokeStyle = '#c47d25';
    ctx.lineWidth = 14;

    for (let i = -512; i <= 1024; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 512, 512);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(i, 512);
      ctx.lineTo(i + 512, 0);
      ctx.stroke();
    }

    // Grid highlights for pseudo 3D depth
    ctx.strokeStyle = '#ffd885';
    ctx.lineWidth = 4;
    for (let i = -512; i <= 1024; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i + 4, 0);
      ctx.lineTo(i + 516, 512);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 6);
    this.waffleTexture = tex;
    return tex;
  }

  /**
   * Generates crisp 3D Billboard Sprite badges with Hebrew labels
   */
  createBillboardBadge(text, subtext = '', bgColor = '#0e6785', borderColor = '#38bdf8') {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');

    // Background pill
    ctx.beginPath();
    ctx.roundRect(16, 16, 480, 128, 28);
    ctx.fillStyle = bgColor;
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = borderColor;
    ctx.stroke();

    // Main text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px "Rubik", "Heebo", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = subtext ? 'top' : 'middle';
    ctx.direction = 'rtl';
    ctx.fillText(text, 256, subtext ? 36 : 80);

    // Subtext
    if (subtext) {
      ctx.fillStyle = '#bae6fd';
      ctx.font = 'bold 26px "Rubik", "Heebo", Arial, sans-serif';
      ctx.fillText(subtext, 256, 88);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(6.4, 2.0, 1);
    return sprite;
  }

  rebuildCone() {
    if (!this.scene || !this.coneGroup) return;

    // Clean previous objects
    while (this.coneGroup.children.length > 0) {
      const obj = this.coneGroup.children[0];
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
      this.coneGroup.remove(obj);
    }

    const r = this.radius;
    const h = this.height;
    const s = Math.hypot(r, h);
    const sliceRatio = this.sliceHeightPercent / 100;
    const currentH = h * sliceRatio;
    const currentTopR = r * (1 - sliceRatio);
    const splitX = this.axialSplitDistance;

    // 1. Shading Material Creation
    let coneMat, baseMat, edgeMat;

    if (this.theme === 'glass') {
      coneMat = new THREE.MeshPhysicalMaterial({
        color: 0x93c5fd,
        transmission: 0.82,
        opacity: 1,
        transparent: true,
        roughness: 0.12,
        ior: 1.48,
        reflectivity: 0.6,
        clearcoat: 0.9,
        clearcoatRoughness: 0.1,
        side: THREE.DoubleSide
      });
      baseMat = new THREE.MeshPhysicalMaterial({
        color: 0x60a5fa,
        transmission: 0.75,
        roughness: 0.2,
        transparent: true,
        side: THREE.DoubleSide
      });
      edgeMat = new THREE.LineBasicMaterial({ color: 0x0369a1, linewidth: 2 });
    } else if (this.theme === 'gold') {
      const waffle = this.getWaffleTexture();
      coneMat = new THREE.MeshStandardMaterial({
        map: waffle,
        roughness: 0.45,
        metalness: 0.05,
        side: THREE.DoubleSide
      });
      baseMat = new THREE.MeshStandardMaterial({
        color: 0xffedd5,
        roughness: 0.6,
        side: THREE.DoubleSide
      });
      edgeMat = new THREE.LineBasicMaterial({ color: 0x92400e, linewidth: 2 });
    } else if (this.theme === 'hologram') {
      coneMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        wireframe: true,
        transparent: true,
        opacity: 0.75
      });
      baseMat = new THREE.MeshBasicMaterial({
        color: 0x0e7490,
        wireframe: true,
        transparent: true,
        opacity: 0.8
      });
      edgeMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 3 });
    } else if (this.theme === 'titanium') {
      coneMat = new THREE.MeshStandardMaterial({
        color: 0x64748b,
        metalness: 0.9,
        roughness: 0.2,
        side: THREE.DoubleSide
      });
      baseMat = new THREE.MeshStandardMaterial({
        color: 0x475569,
        metalness: 0.85,
        roughness: 0.25,
        side: THREE.DoubleSide
      });
      edgeMat = new THREE.LineBasicMaterial({ color: 0x1e293b, linewidth: 2 });
    } else if (this.theme === 'wire') {
      coneMat = new THREE.MeshBasicMaterial({ color: 0x0e6785, wireframe: true });
      baseMat = new THREE.MeshBasicMaterial({ color: 0x1685a8, wireframe: true });
      edgeMat = new THREE.LineBasicMaterial({ color: 0x0e6785, linewidth: 2 });
    } else {
      // Classic Pedagogical Cyan (matching the workbook)
      coneMat = new THREE.MeshPhysicalMaterial({
        color: 0x1685a8,
        roughness: 0.28,
        metalness: 0.12,
        clearcoat: 0.7,
        clearcoatRoughness: 0.15,
        transparent: this.isTransparent,
        opacity: this.isTransparent ? 0.78 : 1.0,
        side: THREE.DoubleSide
      });
      baseMat = new THREE.MeshPhysicalMaterial({
        color: 0xd9f2fb,
        roughness: 0.35,
        transparent: this.isTransparent,
        opacity: this.isTransparent ? 0.88 : 1.0,
        side: THREE.DoubleSide
      });
      edgeMat = new THREE.LineBasicMaterial({ color: 0x0e6785, linewidth: 2 });
    }

    // 2. Cone Mesh Construction (Supports Exploded Axial Split)
    if (splitX > 0.1) {
      // Split into Left and Right Half-Cones
      // CylinderGeometry(radiusTop, radiusBottom, height, radialSegments, heightSegments, openEnded, thetaStart, thetaLength)
      const halfGeoLeft = new THREE.CylinderGeometry(currentTopR, r, currentH, 32, 16, true, Math.PI / 2, Math.PI);
      const halfMeshLeft = new THREE.Mesh(halfGeoLeft, coneMat);
      halfMeshLeft.position.set(-splitX / 2, currentH / 2, 0);
      halfMeshLeft.castShadow = true;
      this.coneGroup.add(halfMeshLeft);

      const halfGeoRight = new THREE.CylinderGeometry(currentTopR, r, currentH, 32, 16, true, -Math.PI / 2, Math.PI);
      const halfMeshRight = new THREE.Mesh(halfGeoRight, coneMat);
      halfMeshRight.position.set(splitX / 2, currentH / 2, 0);
      halfMeshRight.castShadow = true;
      this.coneGroup.add(halfMeshRight);

      // Base halves
      const baseLeftGeo = new THREE.CircleGeometry(r, 32, Math.PI / 2, Math.PI);
      const baseMeshLeft = new THREE.Mesh(baseLeftGeo, baseMat);
      baseMeshLeft.rotation.x = Math.PI / 2;
      baseMeshLeft.position.set(-splitX / 2, 0, 0);
      this.coneGroup.add(baseMeshLeft);

      const baseRightGeo = new THREE.CircleGeometry(r, 32, -Math.PI / 2, Math.PI);
      const baseMeshRight = new THREE.Mesh(baseRightGeo, baseMat);
      baseMeshRight.rotation.x = Math.PI / 2;
      baseMeshRight.position.set(splitX / 2, 0, 0);
      this.coneGroup.add(baseMeshRight);
    } else {
      // Full unified cone
      const coneGeo = new THREE.CylinderGeometry(currentTopR, r, currentH, 64, 16, true);
      const meshCone = new THREE.Mesh(coneGeo, coneMat);
      meshCone.position.y = currentH / 2;
      meshCone.castShadow = true;
      meshCone.receiveShadow = true;
      this.coneGroup.add(meshCone);

      // Base disk
      const baseGeo = new THREE.CircleGeometry(r, 64);
      const meshBase = new THREE.Mesh(baseGeo, baseMat);
      meshBase.rotation.x = Math.PI / 2;
      meshBase.position.y = 0;
      meshBase.receiveShadow = true;
      this.coneGroup.add(meshBase);

      // Base rim outline
      const baseEdgeGeo = new THREE.EdgesGeometry(baseGeo);
      const baseRim = new THREE.LineSegments(baseEdgeGeo, edgeMat);
      baseRim.rotation.x = Math.PI / 2;
      this.coneGroup.add(baseRim);
    }

    // 3. Top Cut Plane Cap (when truncated / sliced)
    if (sliceRatio < 0.999 && currentTopR > 0.05) {
      const topCapGeo = new THREE.CircleGeometry(currentTopR, 64);
      const topCapMat = new THREE.MeshPhysicalMaterial({
        color: 0x38bdf8,
        metalness: 0.1,
        roughness: 0.2,
        clearcoat: 0.8,
        side: THREE.DoubleSide
      });
      const topCapMesh = new THREE.Mesh(topCapGeo, topCapMat);
      topCapMesh.rotation.x = -Math.PI / 2;
      topCapMesh.position.y = currentH;
      this.coneGroup.add(topCapMesh);

      // Glowing slice rim
      const sliceRimGeo = new THREE.EdgesGeometry(topCapGeo);
      const sliceRim = new THREE.LineSegments(sliceRimGeo, new THREE.LineBasicMaterial({ color: 0x0284c7, linewidth: 3 }));
      sliceRim.rotation.x = -Math.PI / 2;
      sliceRim.position.y = currentH;
      this.coneGroup.add(sliceRim);
    }

    // 4. Axial Half-Section Triangle (Pythagorean Theorem: r, h, s)
    const axialGroup = new THREE.Group();
    const triGeo = new THREE.BufferGeometry();
    const triVerts = new Float32Array([
      0, 0, 0,        // Center of base
      r, 0, 0,        // Radius endpoint
      0, h, 0         // Apex
    ]);
    triGeo.setAttribute('position', new THREE.BufferAttribute(triVerts, 3));
    triGeo.computeVertexNormals();

    const triMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide
    });
    const meshTri = new THREE.Mesh(triGeo, triMat);
    axialGroup.add(meshTri);

    // Glowing border around axial triangle
    const triBorderPoints = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(r, 0, 0),
      new THREE.Vector3(0, h, 0),
      new THREE.Vector3(0, 0, 0)
    ];
    const triBorderGeo = new THREE.BufferGeometry().setFromPoints(triBorderPoints);
    const triBorderLine = new THREE.Line(triBorderGeo, new THREE.LineBasicMaterial({ color: 0xd97706, linewidth: 2.5 }));
    axialGroup.add(triBorderLine);

    // Right-angle square (∟) at the base center (0, 0, 0)
    const sqSize = Math.min(1.4, r * 0.22);
    const sqPoints = [
      new THREE.Vector3(0, sqSize, 0),
      new THREE.Vector3(sqSize, sqSize, 0),
      new THREE.Vector3(sqSize, 0, 0)
    ];
    const sqGeo = new THREE.BufferGeometry().setFromPoints(sqPoints);
    const sqLine = new THREE.Line(sqGeo, new THREE.LineBasicMaterial({ color: 0x1f2937, linewidth: 2 }));
    axialGroup.add(sqLine);

    axialGroup.visible = this.showAxialTriangle;
    this.axialGroup = axialGroup;
    this.coneGroup.add(axialGroup);

    // 5. Dimension Vectors (Height h, Radius r, Slant s)
    const dimGroup = new THREE.Group();

    // Height vector: Dashed red/coral
    const hPoints = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, h, 0)];
    const hLineGeo = new THREE.BufferGeometry().setFromPoints(hPoints);
    const hLine = new THREE.Line(hLineGeo, new THREE.LineDashedMaterial({ color: 0xef4444, dashSize: 0.5, gapSize: 0.3, linewidth: 3 }));
    hLine.computeLineDistances();
    dimGroup.add(hLine);

    // Radius vector: Solid deep blue
    const rPoints = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(r, 0, 0)];
    const rLineGeo = new THREE.BufferGeometry().setFromPoints(rPoints);
    const rLine = new THREE.Line(rLineGeo, new THREE.LineBasicMaterial({ color: 0x0284c7, linewidth: 4 }));
    dimGroup.add(rLine);

    // Slant height line: Amber gold
    const sPoints = [new THREE.Vector3(0, h, 0), new THREE.Vector3(r, 0, 0)];
    const sLineGeo = new THREE.BufferGeometry().setFromPoints(sPoints);
    const sLine = new THREE.Line(sLineGeo, new THREE.LineBasicMaterial({ color: 0xf59e0b, linewidth: 4 }));
    dimGroup.add(sLine);

    // Apex Dot Marker
    const apexGeo = new THREE.SphereGeometry(Math.min(0.4, r * 0.06), 16, 16);
    const apexMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const apexDot = new THREE.Mesh(apexGeo, apexMat);
    apexDot.position.set(0, h, 0);
    dimGroup.add(apexDot);

    // Center Dot Marker
    const centerDot = new THREE.Mesh(apexGeo, apexMat);
    centerDot.position.set(0, 0, 0);
    dimGroup.add(centerDot);

    dimGroup.visible = this.showDimensions;
    this.dimGroup = dimGroup;
    this.coneGroup.add(dimGroup);

    // 6. Floating 3D Billboard Badges
    const labelsGroup = new THREE.Group();

    // Apex label badge
    const apexBadge = this.createBillboardBadge('קודקוד החרוט', `גובה מוחלט: ${h} ס״מ`, '#b91c1c', '#f87171');
    apexBadge.position.set(0, h + 1.8, 0);
    labelsGroup.add(apexBadge);

    // Height badge
    const hBadge = this.createBillboardBadge(`גובה h = ${h} ס״מ`, 'אנך למישור הבסיס', '#dc2626', '#fca5a5');
    hBadge.position.set(-2.8, h * 0.5, 0);
    labelsGroup.add(hBadge);

    // Radius badge
    const rBadge = this.createBillboardBadge(`רדיוס r = ${r} ס״מ`, `היקף = ${(2 * r).toFixed(1)}π`, '#0284c7', '#38bdf8');
    rBadge.position.set(r * 0.5, -1.2, 0);
    labelsGroup.add(rBadge);

    // Slant height badge
    const sBadge = this.createBillboardBadge(`יוצר s = ${s.toFixed(2)} ס״מ`, 'היתר בחצי החתך', '#d97706', '#fde047');
    sBadge.position.set(r * 0.65 + 1.8, h * 0.5 + 0.5, 0);
    labelsGroup.add(sBadge);

    labelsGroup.visible = this.showLabels;
    this.labelsGroup = labelsGroup;
    this.coneGroup.add(labelsGroup);
  }

  updateCalculations() {
    const r = this.radius;
    const h = this.height;
    const s = Math.hypot(r, h);
    const circ = 2 * Math.PI * r;
    const baseArea = Math.PI * r * r;
    const volume = (1 / 3) * Math.PI * r * r * h;
    const lateralArea = Math.PI * r * s;
    const alpha = 360 * (r / s);

    // DOM Elements
    const sEl = document.getElementById('c3d-s-val');
    const cEl = document.getElementById('c3d-c-val');
    const bEl = document.getElementById('c3d-b-val');
    const vEl = document.getElementById('c3d-v-val');
    const mEl = document.getElementById('c3d-m-val');
    const aEl = document.getElementById('c3d-alpha-val');
    const foCalc = document.getElementById('c3d-fo-calc');

    if (sEl) sEl.textContent = `${s.toFixed(2)} ס״מ`;
    if (cEl) cEl.textContent = `${(2 * r).toFixed(1)}π ס״מ (${circ.toFixed(1)})`;
    if (bEl) bEl.textContent = `${(r * r).toFixed(1)}π ס״מ² (${baseArea.toFixed(1)})`;
    if (vEl) vEl.textContent = `${((1 / 3) * r * r * h).toFixed(1)}π ס״מ³ (${volume.toFixed(1)})`;
    if (mEl) mEl.textContent = `${(r * s).toFixed(1)}π ס״מ² (${lateralArea.toFixed(1)})`;
    if (aEl) aEl.textContent = `${alpha.toFixed(1)}°`;

    if (foCalc) {
      foCalc.textContent = `${r}² + ${h}² = ${s.toFixed(2)}² (${r * r} + ${h * h} = ${(s * s).toFixed(1)})`;
    }
  }

  openWithParams(radius, height) {
    if (radius && !isNaN(radius)) this.radius = radius;
    if (height && !isNaN(height)) this.height = height;

    const rInput = document.getElementById('c3d-radius');
    const hInput = document.getElementById('c3d-height');
    const rVal = document.getElementById('c3d-radius-val');
    const hVal = document.getElementById('c3d-height-val');

    if (rInput) rInput.value = this.radius;
    if (hInput) hInput.value = this.height;
    if (rVal) rVal.textContent = `${this.radius} ס״מ`;
    if (hVal) hVal.textContent = `${this.height} ס״מ`;

    this.open();
  }

  open() {
    this.isOpen = true;
    const modal = document.getElementById('cone3d-modal');
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';

    this.initThree();
    this.updateCalculations();
    this.rebuildCone();
    this.setCameraView('iso');
  }

  close() {
    this.isOpen = false;
    const modal = document.getElementById('cone3d-modal');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
  }
}
