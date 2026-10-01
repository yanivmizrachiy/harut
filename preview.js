/**
 * Preview & Navigation Engine for A4 Workbook
 * Dynamic DOM extraction (Single Source of Truth) + 3D Studio Integration
 */

import { Cone3DStudio } from './cone3d.js';

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  let pages = [];
  let currentPage = 1;
  let viewMode = 'continuous';
  let zoomLevel = 1.0;
  let isNavCollapsed = false;
  let cone3dStudio = null;

  function init() {
    pages = extractWorkbookPages();

    try {
      cone3dStudio = new Cone3DStudio();
      attach3DBadges();
    } catch (e) {
      console.warn('3D Studio deferred:', e);
    }

    createUI();
    bindEvents();
    setupIntersectionObserver();
    setupShortcuts();
    restoreState();
    updateUI(currentPage, false);
  }

  function extractWorkbookPages() {
    return $$('.a4-page[data-local-page]').map((node) => {
      const num = parseInt(node.getAttribute('data-local-page'), 10);
      const titleEl = node.querySelector('.page-title, h1, .visual-head h1, .visually-hidden');
      const title = titleEl ? titleEl.textContent.trim() : (node.querySelector('img[alt]')?.alt.split('—')[0].trim() || `עמוד ${num}`);
      const desc = node.querySelector('.visual-head p')?.textContent.trim() || '';
      const text = node.textContent;

      let category = 'inquiry', categoryName = 'חקר ותרגול';
      if (num <= 5 || text.includes('דף מלווה המחשה')) { category = 'intro'; categoryName = 'מבוא והמחשה'; }
      else if (node.classList.contains('visual-a4') || node.hasAttribute('data-image-only')) { category = 'visual'; categoryName = 'קומיקס ואיורים'; }
      else if (text.includes('תשובה —') || text.includes('דף תשובות')) { category = 'answers'; categoryName = 'דפי תשובות'; }
      else if (text.includes('פיתגורס') || text.includes('חתך צירי')) { category = 'pythagoras'; categoryName = 'חתכים ופיתגורס'; }
      else if (text.includes('פריסה') || text.includes('גזרה') || text.includes('מבט')) { category = 'nets'; categoryName = 'פריסות ומבטים'; }
      else if (text.includes('נפח') || text.includes('גליל')) { category = 'volume'; categoryName = 'נוסחת הנפח'; }
      else if (text.includes('הערכה') || text.includes('משימה מסכמת') || text.includes('יסודות לחרוט')) { category = 'assessment'; categoryName = 'הערכה וסיכום'; }

      return { num, title, desc, category, categoryName, has3D: !!node.querySelector('[data-cone-render="3d"]'), element: node };
    });
  }

  function attach3DBadges() {
    $$('[data-cone-render="3d"]').forEach((fig) => {
      const box = fig.closest('.figure-box') || fig.parentElement;
      if (!box || box.querySelector('.c3d-fig-badge')) return;

      const badge = document.createElement('button');
      badge.type = 'button';
      badge.className = 'c3d-fig-badge';
      badge.title = 'פתח במעבדת תלת־ממד WebGL אינטראקטיבית';
      badge.innerHTML = `<span>🧊</span> <span>פתח ב־3D</span>`;

      badge.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const text = (box.textContent || '') + ' ' + (box.closest('.q-card')?.textContent || '');
        const r = parseFloat(text.match(/רדיוס\s*(?:[=:בערך]*\s*)?(\d+(?:\.\d+)?)/)?.[1] || 6);
        let h = parseFloat(text.match(/גובה\s*(?:[=:בערך]*\s*)?(\d+(?:\.\d+)?)/)?.[1] || 8);
        const sMatch = text.match(/יוצר\s*(?:[=:בערך]*\s*)?(\d+(?:\.\d+)?)/);
        if (!text.includes('גובה') && sMatch && parseFloat(sMatch[1]) > r) {
          h = Math.round(Math.hypot(parseFloat(sMatch[1]), r) * 10) / 10;
        }
        cone3dStudio?.openWithParams(r, h);
      });

      box.style.position = 'relative';
      box.appendChild(badge);
    });
  }

  function createUI() {
    const nav = document.createElement('nav');
    nav.id = 'preview-nav';
    nav.className = 'preview-nav';
    nav.setAttribute('aria-label', 'תצוגה מקדימה וניווט בחוברת');
    nav.innerHTML = `
      <div class="pnav-inner">
        <div class="pnav-brand">
          <div class="pnav-icon" title="חרוט ישר">📐</div>
          <div class="pnav-title-box">
            <span class="pnav-title">חרוט — חוברת עבודה</span>
            <span class="pnav-badge">${pages.length} דפי A4</span>
          </div>
        </div>
        <div class="pnav-center">
          <button type="button" class="pnav-btn pnav-btn-step" id="pnav-prev" title="עמוד קודם (חץ שמאלה ←)"><span class="pnav-arrow">‹</span><span class="pnav-btn-label">הקודם</span></button>
          <div class="pnav-page-picker">
            <label for="pnav-page-select" class="visually-hidden">בחירת עמוד</label>
            <select id="pnav-page-select" class="pnav-select pnav-page-select">
              ${pages.map(p => `<option value="${p.num}">עמוד ${p.num}: ${escapeHtml(p.title)}</option>`).join('')}
            </select>
            <span class="pnav-page-counter" id="pnav-page-counter">1 / ${pages.length}</span>
          </div>
          <button type="button" class="pnav-btn pnav-btn-step" id="pnav-next" title="עמוד הבא (חץ ימינה →)"><span class="pnav-btn-label">הבא</span><span class="pnav-arrow">›</span></button>
        </div>
        <div class="pnav-actions">
          <button type="button" class="pnav-btn pnav-btn-3d" id="pnav-3d-btn" title="פתח מעבדת תלת־ממד WebGL אינטראקטיבית"><span>🧊</span><span>מעבדת 3D</span></button>
          <div class="pnav-button-group" role="group" aria-label="מצב תצוגה">
            <button type="button" class="pnav-btn pnav-btn-mode active" id="pnav-mode-cont" title="תצוגת רצף גלילה של כל הדפים">רצף</button>
            <button type="button" class="pnav-btn pnav-btn-mode" id="pnav-mode-single" title="תצוגת עמוד בודד ממוקד">בודד</button>
          </div>
          <div class="pnav-zoom-group">
            <button type="button" class="pnav-btn pnav-btn-icon" id="pnav-zoom-out" title="הקטן תצוגה (−)">−</button>
            <span class="pnav-zoom-val" id="pnav-zoom-val">100%</span>
            <button type="button" class="pnav-btn pnav-btn-icon" id="pnav-zoom-in" title="הגדל תצוגה (+)">+</button>
            <button type="button" class="pnav-btn pnav-btn-sm" id="pnav-zoom-fit" title="התאם לרוחב המסך">רוחב</button>
          </div>
          <button type="button" class="pnav-btn pnav-btn-primary" id="pnav-drawer-toggle" title="פתח תוכן עניינים ודפים ממוזערים"><span>📋</span><span>אינדקס</span></button>
          <div class="pnav-dropdown-wrap">
            <button type="button" class="pnav-btn pnav-btn-print" id="pnav-print-btn" title="הדפסת החוברת"><span>🖨️</span><span>הדפסה</span></button>
            <div class="pnav-dropdown-menu" id="pnav-print-menu">
              <button type="button" class="pnav-menu-item" id="pnav-print-all"><strong>הדפסת כל החוברת</strong><small>כל ${pages.length} דפי ה-A4</small></button>
              <button type="button" class="pnav-menu-item" id="pnav-print-current"><strong>הדפסת עמוד נוכחי</strong><small id="pnav-print-current-label">עמוד 1 בלבד</small></button>
            </div>
          </div>
          <button type="button" class="pnav-btn pnav-btn-icon" id="pnav-collapse-btn" title="מזער את סרגל התצוגה המקדימה"><span id="pnav-collapse-icon">▲</span></button>
        </div>
      </div>
      <div class="pnav-subbar">
        <span class="pnav-subbar-topic" id="pnav-subbar-topic">עמוד 1</span>
        <span class="pnav-subbar-desc" id="pnav-subbar-desc"></span>
      </div>`;
    document.body.prepend(nav);

    const pill = document.createElement('button');
    pill.id = 'preview-restore-pill';
    pill.className = 'preview-restore-pill';
    pill.title = 'פתח סרגל תצוגה מקדימה';
    pill.innerHTML = `<span>📐</span> <span>עמוד <strong id="pill-page-num">1</strong> / ${pages.length}</span>`;
    pill.style.display = 'none';
    pill.addEventListener('click', expandNav);
    document.body.appendChild(pill);

    const drawer = document.createElement('aside');
    drawer.id = 'preview-drawer';
    drawer.className = 'preview-drawer';
    drawer.setAttribute('aria-label', 'אינדקס ודפים ממוזערים');
    drawer.innerHTML = `
      <div class="pdrawer-header">
        <div class="pdrawer-title"><h3>תוכן עניינים ודפי החוברת</h3><span class="pdrawer-sub">${pages.length} דפי A4 להדפסה</span></div>
        <button type="button" class="pdrawer-close" id="pdrawer-close" title="סגור אינדקס">✕</button>
      </div>
      <div class="pdrawer-search-wrap">
        <input type="search" id="pdrawer-search" class="pdrawer-search" placeholder="חיפוש לפי נושא, מילה או מספר עמוד..." />
      </div>
      <div class="pdrawer-list" id="pdrawer-list">
        ${pages.map(p => `
          <button type="button" class="pdrawer-card ${p.num === 1 ? 'active' : ''}" data-target-page="${p.num}">
            <div class="pdrawer-card-badge">${p.num}</div>
            <div class="pdrawer-card-info">
              <span class="pdrawer-card-tag">${escapeHtml(p.categoryName)}</span>
              <strong class="pdrawer-card-title">${escapeHtml(p.title)}</strong>
              ${p.desc ? `<small class="pdrawer-card-desc">${escapeHtml(p.desc)}</small>` : ''}
            </div>
            ${p.has3D ? `<span class="pdrawer-3d-tag" title="כולל איור תלת־ממדי">3D</span>` : ''}
          </button>`).join('')}
      </div>`;
    document.body.appendChild(drawer);

    const backdrop = document.createElement('div');
    backdrop.id = 'preview-backdrop';
    backdrop.className = 'preview-backdrop';
    backdrop.addEventListener('click', closeDrawer);
    document.body.appendChild(backdrop);
  }

  function bindEvents() {
    $('pnav-3d-btn')?.addEventListener('click', () => cone3dStudio?.open());
    $('pnav-prev').addEventListener('click', () => goToPage(currentPage - 1));
    $('pnav-next').addEventListener('click', () => goToPage(currentPage + 1));
    $('pnav-page-select').addEventListener('change', (e) => goToPage(parseInt(e.target.value, 10)));

    $('pnav-mode-cont').addEventListener('click', () => setViewMode('continuous'));
    $('pnav-mode-single').addEventListener('click', () => setViewMode('single'));

    $('pnav-zoom-in').addEventListener('click', () => adjustZoom(0.1));
    $('pnav-zoom-out').addEventListener('click', () => adjustZoom(-0.1));
    $('pnav-zoom-fit').addEventListener('click', fitWidthZoom);
    $('pnav-zoom-val').addEventListener('click', () => setZoom(1.0));

    $('pnav-drawer-toggle').addEventListener('click', toggleDrawer);
    $('pdrawer-close').addEventListener('click', closeDrawer);

    $('pdrawer-list').addEventListener('click', (e) => {
      const card = e.target.closest('.pdrawer-card');
      if (card) {
        goToPage(parseInt(card.dataset.targetPage, 10));
        closeDrawer();
      }
    });

    $('pdrawer-search').addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      $$('.pdrawer-card').forEach(card => {
        const match = !q || card.textContent.toLowerCase().includes(q) || card.dataset.targetPage === q;
        card.style.display = match ? 'flex' : 'none';
      });
    });

    const printMenu = $('pnav-print-menu');
    $('pnav-print-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      printMenu.classList.toggle('open');
    });
    document.addEventListener('click', () => printMenu.classList.remove('open'));
    $('pnav-print-all').addEventListener('click', () => { printMenu.classList.remove('open'); window.print(); });
    $('pnav-print-current').addEventListener('click', () => { printMenu.classList.remove('open'); printSinglePage(currentPage); });

    $('pnav-collapse-btn').addEventListener('click', collapseNav);
  }

  function goToPage(num) {
    currentPage = Math.max(1, Math.min(pages.length, num));
    sessionStorage.setItem('harut_active_page', currentPage);

    const el = document.querySelector(`.a4-page[data-local-page="${currentPage}"]`);
    if (!el) return;

    if (viewMode === 'single') {
      $$('.a4-page').forEach(p => p.classList.remove('current-page'));
      el.classList.add('current-page');
      window.scrollTo({ top: 0, behavior: 'instant' });
    } else {
      const top = window.scrollY + el.getBoundingClientRect().top - (isNavCollapsed ? 0 : 80);
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }
    updateUI(currentPage, true);
  }

  function updateUI(num, updateSelect) {
    const p = pages.find(item => item.num === num) || { num, title: `עמוד ${num}`, categoryName: 'חרוט' };
    $('pnav-subbar-topic').textContent = `עמוד ${p.num}: ${p.title}`;
    $('pnav-subbar-desc').textContent = p.categoryName;
    $('pnav-page-counter').textContent = `${p.num} / ${pages.length}`;
    if (updateSelect && $('pnav-page-select').value !== String(num)) $('pnav-page-select').value = String(num);

    const pillNum = $('pill-page-num');
    if (pillNum) pillNum.textContent = num;
    $('pnav-print-current-label').textContent = `עמוד ${num} בלבד`;

    $$('.pdrawer-card').forEach(card => {
      const active = parseInt(card.dataset.targetPage, 10) === num;
      card.classList.toggle('active', active);
      if (active && $('preview-drawer').classList.contains('open')) card.scrollIntoView({ block: 'nearest' });
    });

    $('pnav-prev').disabled = num <= 1;
    $('pnav-next').disabled = num >= pages.length;
  }

  function setViewMode(mode) {
    viewMode = mode;
    sessionStorage.setItem('harut_view_mode', mode);
    $('pnav-mode-cont').classList.toggle('active', mode === 'continuous');
    $('pnav-mode-single').classList.toggle('active', mode === 'single');
    document.body.classList.toggle('view-single-page', mode === 'single');
    goToPage(currentPage);
  }

  function adjustZoom(delta) {
    setZoom(Math.max(0.4, Math.min(1.8, Math.round((zoomLevel + delta) * 10) / 10)));
  }

  function setZoom(val) {
    zoomLevel = val;
    document.documentElement.style.setProperty('--preview-zoom', zoomLevel);
    $('pnav-zoom-val').textContent = `${Math.round(zoomLevel * 100)}%`;
    $$('.a4-page').forEach(p => {
      p.style.transform = zoomLevel === 1.0 ? 'none' : `scale(${zoomLevel})`;
      p.style.transformOrigin = 'top center';
    });
  }

  function fitWidthZoom() {
    setZoom(Math.round(Math.min(1.2, Math.max(0.5, (window.innerWidth - 48) / 794)) * 100) / 100);
  }

  function toggleDrawer() {
    $('preview-drawer').classList.contains('open') ? closeDrawer() : openDrawer();
  }

  function openDrawer() {
    $('preview-drawer').classList.add('open');
    $('preview-backdrop').classList.add('open');
    $('pdrawer-search')?.focus();
  }

  function closeDrawer() {
    $('preview-drawer').classList.remove('open');
    $('preview-backdrop').classList.remove('open');
  }

  function collapseNav() {
    isNavCollapsed = true;
    $('preview-nav').classList.add('collapsed');
    document.body.classList.add('nav-is-collapsed');
    $('preview-restore-pill').style.display = 'flex';
  }

  function expandNav() {
    isNavCollapsed = false;
    $('preview-nav').classList.remove('collapsed');
    document.body.classList.remove('nav-is-collapsed');
    $('preview-restore-pill').style.display = 'none';
  }

  function printSinglePage(num) {
    document.body.classList.add('print-single-page');
    $$('.a4-page').forEach(p => p.classList.toggle('active-print-target', p.getAttribute('data-local-page') === String(num)));
    window.print();
    setTimeout(() => {
      document.body.classList.remove('print-single-page');
      $$('.a4-page').forEach(p => p.classList.remove('active-print-target'));
    }, 1500);
  }

  function setupIntersectionObserver() {
    let t;
    const observer = new IntersectionObserver((entries) => {
      if (viewMode === 'single') return;
      const visible = entries.filter(e => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
      if (visible.length > 0) {
        const num = parseInt(visible[0].target.getAttribute('data-local-page'), 10);
        if (num && num !== currentPage) {
          clearTimeout(t);
          t = setTimeout(() => { currentPage = num; updateUI(num, true); }, 100);
        }
      }
    }, { rootMargin: '-10% 0px -40% 0px', threshold: [0.1, 0.5, 0.8] });

    $$('.a4-page').forEach(p => observer.observe(p));
  }

  function setupShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        if (e.key === 'Escape') { closeDrawer(); cone3dStudio?.close(); document.activeElement.blur(); }
        return;
      }
      if (e.key === 'ArrowLeft') goToPage(currentPage - 1);
      else if (e.key === 'ArrowRight') goToPage(currentPage + 1);
      else if (e.key === 'PageUp') { e.preventDefault(); goToPage(currentPage - 1); }
      else if (e.key === 'PageDown') { e.preventDefault(); goToPage(currentPage + 1); }
      else if (e.key === 'Home') { e.preventDefault(); goToPage(1); }
      else if (e.key === 'End') { e.preventDefault(); goToPage(pages.length); }
      else if (e.key === 'Escape') { closeDrawer(); cone3dStudio?.close(); }
    });
  }

  function restoreState() {
    const savedPage = parseInt(sessionStorage.getItem('harut_active_page'), 10);
    const savedMode = sessionStorage.getItem('harut_view_mode');
    if (savedMode === 'single') setViewMode('single');
    if (savedPage >= 1 && savedPage <= pages.length) goToPage(savedPage);
  }

  function escapeHtml(str) {
    return (str || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
