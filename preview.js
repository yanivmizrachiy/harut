/**
 * Persistent Preview & Single-Source-of-Truth Navigation Engine
 * Reads page structure dynamically from document DOM (Single Source of Truth)
 * Integrates WebGL 3D Hardware Accelerated Visualization Studio
 */

import { Cone3DStudio } from './cone3d.js';

(function () {
  'use strict';

  let pagesData = [];
  let currentPage = 1;
  let viewMode = 'continuous'; // 'continuous' or 'single'
  let zoomLevel = 1.0;
  let isNavCollapsed = false;
  let cone3dStudio = null;

  // Initialize
  function init() {
    // 1. Single Source of Truth: extract directly from DOM
    pagesData = extractWorkbookPages();

    // 2. Initialize 3D WebGL Studio
    try {
      cone3dStudio = new Cone3DStudio();
      attach3DBadgesToFigures();
    } catch (err) {
      console.warn('3D WebGL Studio init deferred:', err);
    }

    // 3. Build UI
    createPreviewUI();
    setupIntersectionObserver();
    setupKeyboardShortcuts();
    restoreState();
    updateActivePageUI(currentPage, false);
  }

  /**
   * Extract workbook pages dynamically from DOM nodes
   * Guarantees index.html is the Single Source of Truth
   */
  function extractWorkbookPages() {
    const pageNodes = document.querySelectorAll('.a4-page[data-local-page]');
    return Array.from(pageNodes).map((node) => {
      const num = parseInt(node.getAttribute('data-local-page'), 10);

      // Extract title from DOM without hardcoding
      let title = '';
      const titleEl = node.querySelector('.page-title') || node.querySelector('h1') || node.querySelector('.visual-head h1');
      if (titleEl) {
        title = titleEl.textContent.trim();
      }
      if (!title) {
        const vh = node.querySelector('.visually-hidden');
        if (vh) title = vh.textContent.trim();
      }
      if (!title) {
        const img = node.querySelector('img[alt]');
        if (img) title = img.getAttribute('alt').split('—')[0].trim();
      }
      if (!title) {
        title = `עמוד ${num}`;
      }

      // Subtitle / description: only if present in genuine visual instructions
      let desc = '';
      const subEl = node.querySelector('.visual-head p');
      if (subEl) desc = subEl.textContent.trim();

      // Topic categorization derived from DOM content
      const text = node.textContent;
      let category = 'other';
      let categoryName = 'חרוט';
      if (num <= 5 || text.includes('דף מלווה המחשה')) {
        category = 'intro';
        categoryName = 'מבוא והמחשה';
      } else if (node.classList.contains('visual-a4') || node.hasAttribute('data-image-only')) {
        category = 'visual';
        categoryName = 'קומיקס ואיורים';
      } else if (text.includes('תשובה —') || text.includes('דף תשובות')) {
        category = 'answers';
        categoryName = 'דפי תשובות';
      } else if (text.includes('פיתגורס') || text.includes('חתך צירי')) {
        category = 'pythagoras';
        categoryName = 'חתכים ופיתגורס';
      } else if (text.includes('פריסה') || text.includes('גזרה') || text.includes('מבט')) {
        category = 'nets';
        categoryName = 'פריסות ומבטים';
      } else if (text.includes('נפח') || text.includes('גליל')) {
        category = 'volume';
        categoryName = 'נוסחת הנפח';
      } else if (text.includes('הערכה') || text.includes('משימה מסכמת') || text.includes('יסודות לחרוט')) {
        category = 'assessment';
        categoryName = 'הערכה וסיכום';
      } else {
        category = 'inquiry';
        categoryName = 'חקר ותרגול';
      }

      const has3D = !!node.querySelector('[data-cone-render="3d"]');

      return { num, title, desc, category, categoryName, has3D, element: node };
    });
  }

  /**
   * Attach interactive 3D inspect badges onto all figures marked data-cone-render="3d"
   */
  function attach3DBadgesToFigures() {
    const figures = document.querySelectorAll('[data-cone-render="3d"]');
    figures.forEach((fig) => {
      const box = fig.closest('.figure-box') || fig.parentElement;
      if (!box || box.querySelector('.c3d-fig-badge')) return;

      const badge = document.createElement('button');
      badge.type = 'button';
      badge.className = 'c3d-fig-badge';
      badge.title = 'פתח במעבדת תלת־ממד WebGL אינטראקטיבית';
      badge.innerHTML = `<span>🧊</span> <span>פתח ב־3D</span>`;

      // Try to parse dimensions from figure context if present (e.g. text containing radius, height)
      badge.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        let r = 6, h = 8;
        const boxText = box.textContent || '';
        const cardText = box.closest('.q-card')?.textContent || '';
        const combined = boxText + ' ' + cardText;

        const rMatch = combined.match(/רדיוס\s*(?:[=:בערך]*\s*)?(\d+(?:\.\d+)?)/);
        const hMatch = combined.match(/גובה\s*(?:[=:בערך]*\s*)?(\d+(?:\.\d+)?)/);
        const sMatch = combined.match(/יוצר\s*(?:[=:בערך]*\s*)?(\d+(?:\.\d+)?)/);

        if (rMatch) r = parseFloat(rMatch[1]);
        if (hMatch) h = parseFloat(hMatch[1]);
        else if (sMatch && rMatch) {
          const s = parseFloat(sMatch[1]);
          if (s > r) h = Math.round(Math.sqrt(s * s - r * r) * 10) / 10;
        }

        if (cone3dStudio) {
          cone3dStudio.openWithParams(r, h);
        }
      });

      box.style.position = 'relative';
      box.appendChild(badge);
    });
  }

  function createPreviewUI() {
    // Top Persistent Navigation Bar
    const nav = document.createElement('nav');
    nav.id = 'preview-nav';
    nav.className = 'preview-nav';
    nav.setAttribute('aria-label', 'תצוגה מקדימה וניווט בחוברת');

    nav.innerHTML = `
      <div class="pnav-inner">
        <!-- Brand & Book Title -->
        <div class="pnav-brand">
          <div class="pnav-icon" title="חרוט ישר">📐</div>
          <div class="pnav-title-box">
            <span class="pnav-title">חרוט — חוברת עבודה</span>
            <span class="pnav-badge">${pagesData.length} דפי A4</span>
          </div>
        </div>

        <!-- Center: Page Stepper & Dropdown -->
        <div class="pnav-center">
          <button type="button" class="pnav-btn pnav-btn-step" id="pnav-prev" title="עמוד קודם (חץ שמאלה ←)">
            <span class="pnav-arrow">‹</span>
            <span class="pnav-btn-label">הקודם</span>
          </button>

          <div class="pnav-page-picker">
            <label for="pnav-page-select" class="visually-hidden">בחירת עמוד</label>
            <select id="pnav-page-select" class="pnav-select pnav-page-select">
              ${pagesData.map(p => `
                <option value="${p.num}">עמוד ${p.num}: ${escapeHtml(p.title)}</option>
              `).join('')}
            </select>
            <span class="pnav-page-counter" id="pnav-page-counter">1 / ${pagesData.length}</span>
          </div>

          <button type="button" class="pnav-btn pnav-btn-step" id="pnav-next" title="עמוד הבא (חץ ימינה →)">
            <span class="pnav-btn-label">הבא</span>
            <span class="pnav-arrow">›</span>
          </button>
        </div>

        <!-- Left Actions: 3D Studio, View Mode, Zoom, Drawer, Print -->
        <div class="pnav-actions">
          <!-- 3D WebGL Studio Launch Button -->
          <button type="button" class="pnav-btn pnav-btn-3d" id="pnav-3d-btn" title="פתח מעבדת תלת־ממד WebGL אינטראקטיבית">
            <span>🧊</span>
            <span>מעבדת 3D</span>
          </button>

          <!-- View Mode: Continuous vs Single -->
          <div class="pnav-button-group" role="group" aria-label="מצב תצוגה">
            <button type="button" class="pnav-btn pnav-btn-mode active" id="pnav-mode-cont" title="תצוגת רצף גלילה של כל הדפים">
              רצף
            </button>
            <button type="button" class="pnav-btn pnav-btn-mode" id="pnav-mode-single" title="תצוגת עמוד בודד ממוקד">
              בודד
            </button>
          </div>

          <!-- Zoom Controls -->
          <div class="pnav-zoom-group">
            <button type="button" class="pnav-btn pnav-btn-icon" id="pnav-zoom-out" title="הקטן תצוגה (−)">−</button>
            <span class="pnav-zoom-val" id="pnav-zoom-val">100%</span>
            <button type="button" class="pnav-btn pnav-btn-icon" id="pnav-zoom-in" title="הגדל תצוגה (+)">+</button>
            <button type="button" class="pnav-btn pnav-btn-sm" id="pnav-zoom-fit" title="התאם לרוחב המסך">רוחב</button>
          </div>

          <!-- Table of Contents / Thumbnails Drawer Toggle -->
          <button type="button" class="pnav-btn pnav-btn-primary" id="pnav-drawer-toggle" title="פתח תוכן עניינים ודפים ממוזערים">
            <span>📋</span>
            <span>אינדקס</span>
          </button>

          <!-- Print Dropdown -->
          <div class="pnav-dropdown-wrap">
            <button type="button" class="pnav-btn pnav-btn-print" id="pnav-print-btn" title="הדפסת החוברת">
              <span>🖨️</span>
              <span>הדפסה</span>
            </button>
            <div class="pnav-dropdown-menu" id="pnav-print-menu">
              <button type="button" class="pnav-menu-item" id="pnav-print-all">
                <strong>הדפסת כל החוברת</strong>
                <small>כל ${pagesData.length} דפי ה-A4</small>
              </button>
              <button type="button" class="pnav-menu-item" id="pnav-print-current">
                <strong>הדפסת עמוד נוכחי</strong>
                <small id="pnav-print-current-label">עמוד 1 בלבד</small>
              </button>
            </div>
          </div>

          <!-- Minimize / Collapse Nav -->
          <button type="button" class="pnav-btn pnav-btn-icon" id="pnav-collapse-btn" title="מזער את סרגל התצוגה המקדימה">
            <span id="pnav-collapse-icon">▲</span>
          </button>
        </div>
      </div>

      <!-- Current page topic subbar banner -->
      <div class="pnav-subbar" id="pnav-subbar">
        <span class="pnav-subbar-topic" id="pnav-subbar-topic">עמוד 1: דף מלווה המחשה</span>
        <span class="pnav-subbar-desc" id="pnav-subbar-desc"></span>
      </div>
    `;

    document.body.prepend(nav);

    // Floating restore pill when collapsed
    const pill = document.createElement('button');
    pill.id = 'preview-restore-pill';
    pill.className = 'preview-restore-pill';
    pill.title = 'פתח סרגל תצוגה מקדימה';
    pill.innerHTML = `<span>📐</span> <span>עמוד <strong id="pill-page-num">1</strong> / ${pagesData.length}</span>`;
    pill.style.display = 'none';
    pill.addEventListener('click', expandNav);
    document.body.appendChild(pill);

    // Thumbnails / Table of Contents Drawer
    const drawer = document.createElement('aside');
    drawer.id = 'preview-drawer';
    drawer.className = 'preview-drawer';
    drawer.setAttribute('aria-label', 'אינדקס ודפים ממוזערים');

    drawer.innerHTML = `
      <div class="pdrawer-header">
        <div class="pdrawer-title">
          <h3>תוכן עניינים ודפי החוברת</h3>
          <span class="pdrawer-sub">${pagesData.length} דפי A4 להדפסה</span>
        </div>
        <button type="button" class="pdrawer-close" id="pdrawer-close" title="סגור אינדקס">✕</button>
      </div>

      <div class="pdrawer-search-wrap">
        <input type="search" id="pdrawer-search" class="pdrawer-search" placeholder="חיפוש לפי נושא, מילה או מספר עמוד (למשל: נפח, פיתגורס, אניס)..." />
      </div>

      <div class="pdrawer-list" id="pdrawer-list">
        ${pagesData.map(p => `
          <button type="button" class="pdrawer-card ${p.num === 1 ? 'active' : ''}" data-target-page="${p.num}">
            <div class="pdrawer-card-badge">${p.num}</div>
            <div class="pdrawer-card-info">
              <span class="pdrawer-card-tag">${escapeHtml(p.categoryName)}</span>
              <strong class="pdrawer-card-title">${escapeHtml(p.title)}</strong>
              ${p.desc ? `<small class="pdrawer-card-desc">${escapeHtml(p.desc)}</small>` : ''}
            </div>
            ${p.has3D ? `<span class="pdrawer-3d-tag" title="כולל איור תלת־ממדי">3D</span>` : ''}
          </button>
        `).join('')}
      </div>
    `;

    document.body.appendChild(drawer);

    // Backdrop for drawer
    const backdrop = document.createElement('div');
    backdrop.id = 'preview-backdrop';
    backdrop.className = 'preview-backdrop';
    backdrop.addEventListener('click', closeDrawer);
    document.body.appendChild(backdrop);

    attachEvents();
  }

  function attachEvents() {
    // 3D Studio Open Button
    const btn3d = document.getElementById('pnav-3d-btn');
    if (btn3d) {
      btn3d.addEventListener('click', () => {
        if (cone3dStudio) cone3dStudio.open();
      });
    }

    // Steppers
    document.getElementById('pnav-prev').addEventListener('click', () => goToPage(currentPage - 1));
    document.getElementById('pnav-next').addEventListener('click', () => goToPage(currentPage + 1));

    // Page Dropdown
    document.getElementById('pnav-page-select').addEventListener('change', (e) => {
      goToPage(parseInt(e.target.value, 10));
    });

    // View Mode toggles
    document.getElementById('pnav-mode-cont').addEventListener('click', () => setViewMode('continuous'));
    document.getElementById('pnav-mode-single').addEventListener('click', () => setViewMode('single'));

    // Zoom Controls
    document.getElementById('pnav-zoom-in').addEventListener('click', () => adjustZoom(0.1));
    document.getElementById('pnav-zoom-out').addEventListener('click', () => adjustZoom(-0.1));
    document.getElementById('pnav-zoom-fit').addEventListener('click', fitWidthZoom);
    document.getElementById('pnav-zoom-val').addEventListener('click', () => setZoom(1.0));

    // Drawer Toggles
    document.getElementById('pnav-drawer-toggle').addEventListener('click', toggleDrawer);
    document.getElementById('pdrawer-close').addEventListener('click', closeDrawer);

    // Drawer Cards click
    document.getElementById('pdrawer-list').addEventListener('click', (e) => {
      const card = e.target.closest('.pdrawer-card');
      if (card) {
        const targetPage = parseInt(card.dataset.targetPage, 10);
        goToPage(targetPage);
        closeDrawer();
      }
    });

    // Drawer Search Filter
    document.getElementById('pdrawer-search').addEventListener('input', (e) => {
      const query = e.target.value.trim().toLowerCase();
      const cards = document.querySelectorAll('.pdrawer-card');
      cards.forEach(card => {
        const pageNum = card.dataset.targetPage;
        const text = card.textContent.toLowerCase();
        if (!query || text.includes(query) || pageNum === query) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    });

    // Print Menu
    const printBtn = document.getElementById('pnav-print-btn');
    const printMenu = document.getElementById('pnav-print-menu');
    printBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      printMenu.classList.toggle('open');
    });

    document.addEventListener('click', () => {
      printMenu.classList.remove('open');
    });

    document.getElementById('pnav-print-all').addEventListener('click', () => {
      printMenu.classList.remove('open');
      window.print();
    });

    document.getElementById('pnav-print-current').addEventListener('click', () => {
      printMenu.classList.remove('open');
      printSinglePage(currentPage);
    });

    // Collapse nav
    document.getElementById('pnav-collapse-btn').addEventListener('click', collapseNav);
  }

  function goToPage(pageNum) {
    if (pageNum < 1) pageNum = 1;
    if (pageNum > pagesData.length) pageNum = pagesData.length;

    currentPage = pageNum;
    sessionStorage.setItem('harut_active_page', pageNum);

    const pageElement = document.querySelector(`.a4-page[data-local-page="${pageNum}"]`);
    if (!pageElement) return;

    if (viewMode === 'single') {
      document.querySelectorAll('.a4-page').forEach(p => p.classList.remove('current-page'));
      pageElement.classList.add('current-page');
      window.scrollTo({ top: 0, behavior: 'instant' });
    } else {
      const navHeight = isNavCollapsed ? 0 : 80;
      const elementRect = pageElement.getBoundingClientRect();
      const absoluteTop = window.scrollY + elementRect.top - navHeight;
      window.scrollTo({ top: Math.max(0, absoluteTop), behavior: 'smooth' });
    }

    updateActivePageUI(pageNum, true);
  }

  function updateActivePageUI(pageNum, updateDropdowns) {
    const pData = pagesData.find(p => p.num === pageNum) || {
      num: pageNum,
      title: `עמוד ${pageNum}`,
      categoryName: 'חרוט',
      desc: ''
    };

    // Subbar
    const topicEl = document.getElementById('pnav-subbar-topic');
    const descEl = document.getElementById('pnav-subbar-desc');
    if (topicEl) topicEl.textContent = `עמוד ${pData.num}: ${pData.title}`;
    if (descEl) descEl.textContent = pData.categoryName;

    // Counter
    const counterEl = document.getElementById('pnav-page-counter');
    if (counterEl) counterEl.textContent = `${pData.num} / ${pagesData.length}`;

    // Dropdown
    if (updateDropdowns) {
      const selectEl = document.getElementById('pnav-page-select');
      if (selectEl && selectEl.value !== String(pageNum)) {
        selectEl.value = String(pageNum);
      }
    }

    // Pill
    const pillNum = document.getElementById('pill-page-num');
    if (pillNum) pillNum.textContent = pageNum;

    // Print label
    const printCur = document.getElementById('pnav-print-current-label');
    if (printCur) printCur.textContent = `עמוד ${pageNum} בלבד`;

    // Highlight in drawer
    const allCards = document.querySelectorAll('.pdrawer-card');
    allCards.forEach(card => {
      if (parseInt(card.dataset.targetPage, 10) === pageNum) {
        card.classList.add('active');
        if (document.getElementById('preview-drawer').classList.contains('open')) {
          card.scrollIntoView({ block: 'nearest' });
        }
      } else {
        card.classList.remove('active');
      }
    });

    // Steppers disabled state
    const prevBtn = document.getElementById('pnav-prev');
    const nextBtn = document.getElementById('pnav-next');
    if (prevBtn) prevBtn.disabled = (pageNum <= 1);
    if (nextBtn) nextBtn.disabled = (pageNum >= pagesData.length);
  }

  function setViewMode(mode) {
    viewMode = mode;
    sessionStorage.setItem('harut_view_mode', mode);

    const btnCont = document.getElementById('pnav-mode-cont');
    const btnSingle = document.getElementById('pnav-mode-single');

    if (mode === 'single') {
      btnSingle.classList.add('active');
      btnCont.classList.remove('active');
      document.body.classList.add('view-single-page');
      goToPage(currentPage);
    } else {
      btnCont.classList.add('active');
      btnSingle.classList.remove('active');
      document.body.classList.remove('view-single-page');
      goToPage(currentPage);
    }
  }

  function adjustZoom(delta) {
    setZoom(Math.max(0.4, Math.min(1.8, Math.round((zoomLevel + delta) * 10) / 10)));
  }

  function setZoom(val) {
    zoomLevel = val;
    document.documentElement.style.setProperty('--preview-zoom', zoomLevel);
    const zoomValEl = document.getElementById('pnav-zoom-val');
    if (zoomValEl) zoomValEl.textContent = `${Math.round(zoomLevel * 100)}%`;

    const pages = document.querySelectorAll('.a4-page');
    pages.forEach(p => {
      p.style.transform = zoomLevel === 1.0 ? 'none' : `scale(${zoomLevel})`;
      p.style.transformOrigin = 'top center';
    });
  }

  function fitWidthZoom() {
    const windowWidth = window.innerWidth;
    const a4WidthPx = 794;
    const padding = 48;
    const fit = Math.min(1.2, Math.max(0.5, (windowWidth - padding) / a4WidthPx));
    setZoom(Math.round(fit * 100) / 100);
  }

  function toggleDrawer() {
    const drawer = document.getElementById('preview-drawer');
    const backdrop = document.getElementById('preview-backdrop');
    const isOpen = drawer.classList.contains('open');
    if (isOpen) {
      closeDrawer();
    } else {
      drawer.classList.add('open');
      backdrop.classList.add('open');
      const searchInput = document.getElementById('pdrawer-search');
      if (searchInput) searchInput.focus();
    }
  }

  function closeDrawer() {
    const drawer = document.getElementById('preview-drawer');
    const backdrop = document.getElementById('preview-backdrop');
    if (drawer) drawer.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
  }

  function collapseNav() {
    isNavCollapsed = true;
    const nav = document.getElementById('preview-nav');
    const pill = document.getElementById('preview-restore-pill');
    nav.classList.add('collapsed');
    document.body.classList.add('nav-is-collapsed');
    pill.style.display = 'flex';
  }

  function expandNav() {
    isNavCollapsed = false;
    const nav = document.getElementById('preview-nav');
    const pill = document.getElementById('preview-restore-pill');
    nav.classList.remove('collapsed');
    document.body.classList.remove('nav-is-collapsed');
    pill.style.display = 'none';
  }

  function printSinglePage(pageNum) {
    document.body.classList.add('print-single-page');
    const pages = document.querySelectorAll('.a4-page');
    pages.forEach(p => {
      if (p.getAttribute('data-local-page') === String(pageNum)) {
        p.classList.add('active-print-target');
      } else {
        p.classList.remove('active-print-target');
      }
    });

    window.print();

    setTimeout(() => {
      document.body.classList.remove('print-single-page');
      pages.forEach(p => p.classList.remove('active-print-target'));
    }, 1500);
  }

  function setupIntersectionObserver() {
    let scrollTimeout;
    const observer = new IntersectionObserver((entries) => {
      if (viewMode === 'single') return;

      const visibleEntries = entries.filter(e => e.isIntersecting);
      if (visibleEntries.length > 0) {
        visibleEntries.sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const topEntry = visibleEntries[0];
        const pageNum = parseInt(topEntry.target.getAttribute('data-local-page'), 10);
        if (pageNum && pageNum !== currentPage) {
          clearTimeout(scrollTimeout);
          scrollTimeout = setTimeout(() => {
            currentPage = pageNum;
            updateActivePageUI(pageNum, true);
          }, 100);
        }
      }
    }, {
      rootMargin: '-10% 0px -40% 0px',
      threshold: [0.1, 0.5, 0.8]
    });

    document.querySelectorAll('.a4-page').forEach(page => observer.observe(page));
  }

  function setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        if (e.key === 'Escape') {
          closeDrawer();
          if (cone3dStudio) cone3dStudio.close();
          document.activeElement.blur();
        }
        return;
      }

      if (e.key === 'ArrowLeft') {
        goToPage(currentPage - 1);
      } else if (e.key === 'ArrowRight') {
        goToPage(currentPage + 1);
      } else if (e.key === 'PageUp') {
        e.preventDefault();
        goToPage(currentPage - 1);
      } else if (e.key === 'PageDown') {
        e.preventDefault();
        goToPage(currentPage + 1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        goToPage(1);
      } else if (e.key === 'End') {
        e.preventDefault();
        goToPage(pagesData.length);
      } else if (e.key === 'Escape') {
        closeDrawer();
        if (cone3dStudio) cone3dStudio.close();
      }
    });
  }

  function restoreState() {
    const savedPage = parseInt(sessionStorage.getItem('harut_active_page'), 10);
    const savedMode = sessionStorage.getItem('harut_view_mode');

    if (savedMode === 'single') {
      setViewMode('single');
    }

    if (savedPage && savedPage >= 1 && savedPage <= pagesData.length) {
      goToPage(savedPage);
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
