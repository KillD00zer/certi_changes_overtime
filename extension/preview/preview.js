/**
 * Controller for Dakahlia Spatial Variables Certificate - Preview & Print Page
 * v3 — Visual Layout Editor System
 * Reads parcel, shots, and committee metadata from chrome.storage.local
 * Renders pixel-perfect A4 printable layout with instant window.print() (PDF) support
 * Features a collapsible side drawer with full layout controls
 */

document.addEventListener('DOMContentLoaded', () => {
  let currentParcel = null;
  let currentShots = [];
  let currentCommittee = {};
  let currentOrientation = 'landscape'; // 'landscape' | 'portrait'

  // ============================================================
  // DOM Elements
  // ============================================================
  const printSheet = document.getElementById('print-sheet');
  const citizenNameBadge = document.getElementById('citizen-name-badge');
  const btnPrintPdf = document.getElementById('btn-print-pdf');
  const btnImportCert = document.getElementById('btn-import-cert');
  const inputImportCert = document.getElementById('input-import-cert');
  const btnSaveCertDraft = document.getElementById('btn-save-cert-draft');
  const btnRotate90 = document.getElementById('btn-rotate-90');
  const rotateLabel = document.getElementById('rotate-label');
  const btnToggleOrient = document.getElementById('btn-toggle-orient');
  const orientIcon = document.getElementById('orient-icon');
  const orientLabel = document.getElementById('orient-label');
  let isRotated90 = false;

  // Logos
  const imgDakahliaLogo = document.getElementById('img-dakahlia-logo');
  const imgSpatialLogo = document.getElementById('img-spatial-logo');
  const imgNorthArrow = document.getElementById('img-north-arrow');

  // Metadata Elements
  const metaName = document.getElementById('meta-name');
  const metaLng = document.getElementById('meta-lng');
  const metaLat = document.getElementById('meta-lat');
  const metaCenter = document.getElementById('meta-center');
  const metaVillage = document.getElementById('meta-village');
  const metaAddress = document.getElementById('meta-address');

  // Gallery Container
  const certGallerySection = document.getElementById('cert-gallery-section');

  // Signatures
  const sigSurveyor = document.getElementById('sig-surveyor');
  const sigDirector = document.getElementById('sig-director');
  const sigReviewer = document.getElementById('sig-reviewer');

  // ============================================================
  // Layout Editor DOM Elements
  // ============================================================
  const btnToggleEditor = document.getElementById('btn-toggle-editor');
  const layoutEditor = document.getElementById('layout-editor');
  const btnCloseEditor = document.getElementById('btn-close-editor');

  // Grid Layout
  const gridLayoutOptions = document.getElementById('grid-layout-options');

  // Sliders
  const edImgHeight = document.getElementById('ed-img-height');
  const edImgHeightVal = document.getElementById('ed-img-height-val');
  const edSectionSpacing = document.getElementById('ed-section-spacing');
  const edSectionSpacingVal = document.getElementById('ed-section-spacing-val');
  const edSectionGap = document.getElementById('ed-section-gap');
  const edSectionGapVal = document.getElementById('ed-section-gap-val');
  const edCaptionFont = document.getElementById('ed-caption-font');
  const edCaptionFontVal = document.getElementById('ed-caption-font-val');

  // Logo Sizes
  const edLogoSpatial = document.getElementById('ed-logo-spatial');
  const edLogoSpatialVal = document.getElementById('ed-logo-spatial-val');
  const edLogoGov = document.getElementById('ed-logo-gov');
  const edLogoGovVal = document.getElementById('ed-logo-gov-val');

  // Image Fit
  const fitToggleGroup = document.getElementById('fit-toggle-group');

  // Actions
  const btnFitPage = document.getElementById('btn-fit-page');
  const btnSavePreset = document.getElementById('btn-save-preset');
  const btnResetLayout = document.getElementById('btn-reset-layout');

  // Text Formatting Toolbar Elements
  const textFormatToolbar = document.getElementById('text-format-toolbar');
  const btnTextSizeInc = document.getElementById('btn-text-size-inc');
  const btnTextSizeDec = document.getElementById('btn-text-size-dec');
  const textSizeBadge = document.getElementById('text-size-badge');
  const btnTextBold = document.getElementById('btn-text-bold');
  const btnTextReset = document.getElementById('btn-text-reset');
  let activeEditableEl = null;

  // ============================================================
  // Layout State (defaults)
  // ============================================================
  const DEFAULTS = {
    layout: 'auto',
    imgHeight: null,        // null = auto-calculate
    sectionSpacing: 8,      // Inter-section spacing (px)
    gap: 8,                 // Image gallery gap (px)
    fontSize: 10,           // Caption font size (pt)
    logoSpatial: 100,       // Spatial variables logo (px)
    logoGov: 56,            // Governorate logo (px)
    imgFit: 'cover'
  };

  let editorState = { ...DEFAULTS };

  // ============================================================
  // 1. Load Data from Storage
  // ============================================================
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['previewData'], (res) => {
      const data = res ? res.previewData : null;
      if (!data || !data.parcel) {
        initPreviewWithData(getMockTestData());
      } else {
        initPreviewWithData(data);
      }
    });
  } else {
    try {
      const local = JSON.parse(localStorage.getItem('previewData'));
      initPreviewWithData(local || getMockTestData());
    } catch (e) {
      initPreviewWithData(getMockTestData());
    }
  }

  function initPreviewWithData(data) {
    if (!data) return;
    currentParcel = data.parcel || {};
    currentShots = Array.isArray(data.shots) ? data.shots : [];
    currentCommittee = data.committee || {};

    // Auto-determine orientation based on shot count:
    currentOrientation = (currentShots.length === 6) ? 'portrait' : 'landscape';

    // Load saved layout preset before rendering
    loadSavedPreset();
    renderCertificate();
  }

  function getMockTestData() {
    return {
      parcel: {
        applicantName: 'محمد محمد ابوبكر محمد محمد',
        markaz: 'دكرنس',
        village: 'دكرنس',
        basin: 'عزبة أبو سليمان',
        centerCity: 'دكرنس',
        sheikhah: 'دكرنس',
        placeName: 'عزبة أبو سليمان',
        vertices: [
          { lat: 31.087575, lon: 31.580089 },
          { lat: 31.087600, lon: 31.580150 },
          { lat: 31.087520, lon: 31.580180 },
          { lat: 31.087500, lon: 31.580100 }
        ]
      },
      shots: [
        { id: 1, captureDate: '2013/2', status: 'أول لقطة متاحة للمبنى', notes: '', dataUrl: '' },
        { id: 2, captureDate: '2014/8', status: 'ظهور سقف للمبني', notes: '', dataUrl: '' },
        { id: 3, captureDate: '2018/7', status: 'ظهور حوائط للمبني', notes: '', dataUrl: '' },
        { id: 4, captureDate: '2023/5', status: 'ظهور سقف للمبني', notes: '', dataUrl: '' }
      ],
      committee: {
        surveyor: 'مسؤول المتغيرات المكانية',
        director: 'مروة محمد رضوان',
        reviewer: 'د / عماد عبدالله احمد'
      }
    };
  }

  // ============================================================
  // 2. Render Certificate Content
  // ============================================================
  function renderCertificate() {
    if (!currentParcel) return;

    // A. Apply Orientation
    applyOrientation(currentOrientation);

    // B. Logos
    if (window.TemplateAssets) {
      if (window.TemplateAssets.DAKAHLIA_LOGO) {
        imgDakahliaLogo.src = 'data:image/png;base64,' + window.TemplateAssets.DAKAHLIA_LOGO;
      }
      if (window.TemplateAssets.SPATIAL_LOGO) {
        imgSpatialLogo.src = 'data:image/jpeg;base64,' + window.TemplateAssets.SPATIAL_LOGO;
      }
      if (window.TemplateAssets.NORTH_ARROW) {
        imgNorthArrow.src = 'data:image/png;base64,' + window.TemplateAssets.NORTH_ARROW;
      }
    }

    // C. Citizen Metadata
    const applicantName = currentParcel.applicantName || 'غير محدد';
    citizenNameBadge.textContent = `المواطن: ${applicantName}`;
    document.title = `بيان تسلسل زمني - ${applicantName}`;

    metaName.textContent = applicantName;
    metaCenter.textContent = currentParcel.markaz || currentParcel.centerCity || '—';
    metaVillage.textContent = currentParcel.village || currentParcel.sheikhah || '—';

    // Address / Basin: Inherit from parcel properties or composite from Village + Center
    const fallbackAddress = (currentParcel.village || currentParcel.sheikhah) && (currentParcel.markaz || currentParcel.centerCity)
      ? `${currentParcel.village || currentParcel.sheikhah} ــ ${currentParcel.markaz || currentParcel.centerCity}`
      : (currentParcel.village || currentParcel.sheikhah || currentParcel.markaz || currentParcel.centerCity || '—');
    const applicantAddress = currentParcel.basin || currentParcel.address || currentParcel.place || currentParcel.placeName || fallbackAddress;
    if (metaAddress) {
      metaAddress.textContent = applicantAddress || '—';
    }

    // Calculate Polygon Centroid
    const centroid = calculateCentroid(currentParcel);
    metaLng.textContent = (centroid.lon !== null && !isNaN(centroid.lon)) ? centroid.lon.toFixed(6) : '—';
    metaLat.textContent = (centroid.lat !== null && !isNaN(centroid.lat)) ? centroid.lat.toFixed(6) : '—';

    // D. Gallery Section
    renderGallery();

    // E. Signatures
    const surveyor = currentCommittee.surveyor || 'مسؤول المتغيرات المكانية';
    const director = currentCommittee.director || 'مروة محمد رضوان';
    const reviewer = currentCommittee.reviewer || 'د / عماد عبدالله احمد';

    sigSurveyor.textContent = `الاسم: ${surveyor}`;
    sigDirector.textContent = `مهندسة / ${director}`;
    sigReviewer.textContent = reviewer;

    // F. Apply layout editor state
    applyEditorState();
  }

  // ============================================================
  // 3. Render Satellite Images Gallery
  // ============================================================
  function renderGallery() {
    certGallerySection.innerHTML = '';

    // Sort shots chronologically (Oldest to Newest)
    const sortedShots = [...currentShots].sort((a, b) => {
      return parseDateScore(a.captureDate) - parseDateScore(b.captureDate);
    });

    const count = sortedShots.length;
    if (count === 0) {
      certGallerySection.innerHTML = `
        <div style="grid-column: 1 / -1; width: 100%; border: 1.5px dashed #cbd5e1; border-radius: 8px; background: #f8fafc; padding: 30px 15px; text-align: center; color: #64748b; font-family: 'Cairo', sans-serif;">
          <div style="font-size: 24px; margin-bottom: 6px;">📄</div>
          <div style="font-size: 14px; font-weight: 700; color: #1e293b; margin-bottom: 4px;">شهادة بيان ومطابقة مكانية (بيانات نصية ومساحية)</div>
          <div style="font-size: 11.5px; max-width: 500px; margin: 0 auto;">تم استيراد بيانات الشهادة وإحداثيات مركز الثقل بنجاح. يمكنك طباعة الشهادة أو تصديرها الآن، أو التقاط صور عبر Google Earth لإضافتها في أي وقت.</div>
        </div>
      `;
      return;
    }

    let layout = editorState.layout; // 'auto' | '1row' | '2rows'

    if (layout === 'auto') {
      if (count === 4 || count === 6) {
        layout = '2rows';
      } else {
        layout = '1row';
      }
    }

    if (layout === '2rows') {
      if (count === 4) {
        const grid = document.createElement('div');
        grid.className = 'gallery-grid-4';
        sortedShots.forEach((shot, idx) => {
          grid.appendChild(createShotCard(shot, idx + 1));
        });
        certGallerySection.appendChild(grid);
      } else if (count === 6) {
        const grid = document.createElement('div');
        grid.className = 'gallery-grid-6';
        sortedShots.forEach((shot, idx) => {
          grid.appendChild(createShotCard(shot, idx + 1));
        });
        certGallerySection.appendChild(grid);
      } else if (count === 5) {
        const container = document.createElement('div');
        container.className = 'gallery-grid-5-2rows';
        const rowTop = document.createElement('div');
        rowTop.className = 'grid-row-top';
        const rowBottom = document.createElement('div');
        rowBottom.className = 'grid-row-bottom';

        sortedShots.slice(0, 3).forEach((shot, idx) => {
          rowTop.appendChild(createShotCard(shot, idx + 1));
        });
        sortedShots.slice(3).forEach((shot, idx) => {
          rowBottom.appendChild(createShotCard(shot, idx + 4));
        });

        container.appendChild(rowTop);
        container.appendChild(rowBottom);
        certGallerySection.appendChild(container);
      } else {
        const row = document.createElement('div');
        row.className = `gallery-row count-${count}`;
        sortedShots.forEach((shot, idx) => {
          row.appendChild(createShotCard(shot, idx + 1));
        });
        certGallerySection.appendChild(row);
      }
    } else {
      const row = document.createElement('div');
      row.className = `gallery-row count-${count}`;
      sortedShots.forEach((shot, idx) => {
        row.appendChild(createShotCard(shot, idx + 1));
      });
      certGallerySection.appendChild(row);
    }

    // Run dynamic height calculation
    autoComputeOptimalHeight();
  }

  // ============================================================
  // 4. Smart Dynamic Auto-Fit Calculation
  // ============================================================
  function autoComputeOptimalHeight() {
    if (editorState.imgHeight !== null) {
      applyEditorState();
      return;
    }

    try {
      const sheetH = printSheet.clientHeight || 794;
      const headerEl = printSheet.querySelector('.cert-header');
      const metaEl = printSheet.querySelector('.cert-meta-section');
      const discEl = printSheet.querySelector('.cert-disclaimer-section');
      const footEl = printSheet.querySelector('.cert-footer');

      const headerH = headerEl ? headerEl.offsetHeight : 100;
      const metaH = metaEl ? metaEl.offsetHeight : 80;
      const discH = discEl ? discEl.offsetHeight : 60;
      const footH = footEl ? footEl.offsetHeight : 80;
      const paddingH = 80;

      const availH = sheetH - (headerH + metaH + discH + footH + paddingH);
      const count = currentShots.length;
      const isTwoRows = (editorState.layout === '2rows') || (editorState.layout === 'auto' && (count === 4 || count === 6 || count === 5));

      let optH = isTwoRows ? Math.floor((availH - editorState.gap) / 2) : Math.floor(availH);
      optH = Math.max(95, Math.min(optH, 250));

      document.documentElement.style.setProperty('--gallery-card-height', `${optH}px`);

      // Sync slider
      if (edImgHeight) edImgHeight.value = optH;
      if (edImgHeightVal) edImgHeightVal.textContent = `${optH}px (ذكي)`;
    } catch (e) {
      console.warn('Auto height calculation:', e);
    }
    applyEditorState();
  }

  // ============================================================
  // 5. Apply Editor State to CSS Variables & DOM
  // ============================================================
  function applyEditorState() {
    const root = document.documentElement;

    // Image height
    if (editorState.imgHeight !== null) {
      root.style.setProperty('--gallery-card-height', `${editorState.imgHeight}px`);
      if (edImgHeight) edImgHeight.value = editorState.imgHeight;
      if (edImgHeightVal) edImgHeightVal.textContent = `${editorState.imgHeight}px`;
    }

    // Section spacing
    root.style.setProperty('--section-spacing', `${editorState.sectionSpacing || 8}px`);
    if (edSectionSpacing) edSectionSpacing.value = editorState.sectionSpacing || 8;
    if (edSectionSpacingVal) edSectionSpacingVal.textContent = `${editorState.sectionSpacing || 8}px`;

    // Gallery gap
    root.style.setProperty('--gallery-gap', `${editorState.gap}px`);
    if (edSectionGap) edSectionGap.value = editorState.gap;
    if (edSectionGapVal) edSectionGapVal.textContent = `${editorState.gap}px`;

    // Caption font size
    root.style.setProperty('--caption-font-size', `${editorState.fontSize}pt`);
    if (edCaptionFont) edCaptionFont.value = editorState.fontSize;
    if (edCaptionFontVal) edCaptionFontVal.textContent = `${editorState.fontSize}pt`;

    // Logo sizes
    root.style.setProperty('--logo-spatial-size', `${editorState.logoSpatial}px`);
    if (edLogoSpatial) edLogoSpatial.value = editorState.logoSpatial;
    if (edLogoSpatialVal) edLogoSpatialVal.textContent = `${editorState.logoSpatial}px`;

    root.style.setProperty('--logo-gov-size', `${editorState.logoGov}px`);
    if (edLogoGov) edLogoGov.value = editorState.logoGov;
    if (edLogoGovVal) edLogoGovVal.textContent = `${editorState.logoGov}px`;

    // Image fit
    root.style.setProperty('--img-object-fit', editorState.imgFit);

    // Sync grid layout buttons
    if (gridLayoutOptions) {
      gridLayoutOptions.querySelectorAll('.grid-opt').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-layout') === editorState.layout);
      });
    }

    // Sync fit toggle
    if (fitToggleGroup) {
      fitToggleGroup.querySelectorAll('.fit-opt').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-fit') === editorState.imgFit);
      });
    }
  }

  // ============================================================
  // 6. Layout Editor Drawer Toggle
  // ============================================================
  if (btnToggleEditor) {
    btnToggleEditor.addEventListener('click', () => {
      const isOpen = layoutEditor.classList.contains('open');
      if (isOpen) {
        layoutEditor.classList.remove('open');
        btnToggleEditor.classList.remove('active');
        document.body.classList.remove('editor-open');
      } else {
        layoutEditor.classList.add('open');
        btnToggleEditor.classList.add('active');
        document.body.classList.add('editor-open');
      }
    });
  }

  if (btnCloseEditor) {
    btnCloseEditor.addEventListener('click', () => {
      layoutEditor.classList.remove('open');
      btnToggleEditor.classList.remove('active');
      document.body.classList.remove('editor-open');
    });
  }

  // ============================================================
  // 7. Grid Layout Buttons
  // ============================================================
  if (gridLayoutOptions) {
    gridLayoutOptions.addEventListener('click', (e) => {
      const btn = e.target.closest('.grid-opt');
      if (!btn) return;
      const layout = btn.getAttribute('data-layout');
      if (!layout) return;

      editorState.layout = layout;
      renderGallery();
    });
  }

  // ============================================================
  // 8. Slider: Image Height
  // ============================================================
  if (edImgHeight) {
    edImgHeight.addEventListener('input', (e) => {
      editorState.imgHeight = parseInt(e.target.value, 10);
      applyEditorState();
    });
  }

  // ============================================================
  // 9. Slider: Inter-Section Spacing
  // ============================================================
  if (edSectionSpacing) {
    edSectionSpacing.addEventListener('input', (e) => {
      editorState.sectionSpacing = parseInt(e.target.value, 10);
      applyEditorState();
    });
  }

  // ============================================================
  // 10. Slider: Section Gap (Images)
  // ============================================================
  if (edSectionGap) {
    edSectionGap.addEventListener('input', (e) => {
      editorState.gap = parseInt(e.target.value, 10);
      applyEditorState();
    });
  }

  // ============================================================
  // 11. Slider: Caption Font Size
  // ============================================================
  if (edCaptionFont) {
    edCaptionFont.addEventListener('input', (e) => {
      editorState.fontSize = parseFloat(e.target.value);
      applyEditorState();
    });
  }

  // ============================================================
  // 12. Slider: Logo Spatial Size
  // ============================================================
  if (edLogoSpatial) {
    edLogoSpatial.addEventListener('input', (e) => {
      editorState.logoSpatial = parseInt(e.target.value, 10);
      applyEditorState();
    });
  }

  // ============================================================
  // 14. Slider: Logo Gov Size
  // ============================================================
  if (edLogoGov) {
    edLogoGov.addEventListener('input', (e) => {
      editorState.logoGov = parseInt(e.target.value, 10);
      applyEditorState();
    });
  }

  // ============================================================
  // 15. Image Fit Toggle (Contain / Cover)
  // ============================================================
  if (fitToggleGroup) {
    fitToggleGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('.fit-opt');
      if (!btn) return;
      const fit = btn.getAttribute('data-fit');
      if (!fit) return;

      editorState.imgFit = fit;
      applyEditorState();
    });
  }

  // ============================================================
  // 16. Fit-to-Page Auto Calculation
  // ============================================================
  if (btnFitPage) {
    btnFitPage.addEventListener('click', () => {
      editorState.imgHeight = null; // Reset to auto
      autoComputeOptimalHeight();
      showEditorToast('🎯 تم ضبط الارتفاع تلقائياً لملاءمة الصفحة');
    });
  }

  // ============================================================
  // 17. Save Preset to localStorage
  // ============================================================
  if (btnSavePreset) {
    btnSavePreset.addEventListener('click', () => {
      try {
        localStorage.setItem('cert_layout_preset', JSON.stringify(editorState));
        showEditorToast('⭐ تم حفظ التنسيق كقالب افتراضي بنجاح!');
      } catch (e) {
        console.warn('Could not save preset:', e);
      }
    });
  }

  // ============================================================
  // 18. Reset Layout to Factory Defaults
  // ============================================================
  if (btnResetLayout) {
    btnResetLayout.addEventListener('click', () => {
      editorState = { ...DEFAULTS };
      try {
        localStorage.removeItem('cert_layout_preset');
      } catch (e) {}
      renderGallery();
      showEditorToast('↺ تم إعادة الضبط للقيم الأصلية');
    });
  }

  // ============================================================
  // 19. Load Saved Preset from localStorage
  // ============================================================
  function loadSavedPreset() {
    try {
      const saved = localStorage.getItem('cert_layout_preset');
      if (saved) {
        const pref = JSON.parse(saved);
        // Merge with defaults to handle any missing keys
        editorState = { ...DEFAULTS, ...pref };
      }

      // Also try to migrate from old v2 cert_tuning_pref
      const oldSaved = localStorage.getItem('cert_tuning_pref');
      if (oldSaved && !saved) {
        const oldPref = JSON.parse(oldSaved);
        if (oldPref.layout) editorState.layout = oldPref.layout;
        if (oldPref.height) editorState.imgHeight = oldPref.height;
        if (oldPref.fontSize) editorState.fontSize = oldPref.fontSize;
        if (oldPref.gap) editorState.gap = oldPref.gap;
        // Remove old key
        localStorage.removeItem('cert_tuning_pref');
      }
    } catch (e) {
      console.warn('Could not load saved preset:', e);
    }
  }

  // ============================================================
  // Editor Toast Notification
  // ============================================================
  function showEditorToast(msg) {
    let toast = document.querySelector('.editor-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'editor-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  }

  // ============================================================
  // Helper: Create individual shot card
  // ============================================================
  function createShotCard(shot, index) {
    const card = document.createElement('div');
    card.className = 'shot-card';

    const rawImg = shot.imageData || shot.dataUrl || '';
    const dateLabel = shot.captureDate || '—';
    let statusLabel = shot.status || 'معاينة الموقع';
    if (shot.notes && !statusLabel.includes(shot.notes)) {
      statusLabel = `${statusLabel} (${shot.notes})`;
    }

    const captionText = `${statusLabel} ${dateLabel}`;

    card.innerHTML = `
      <div class="shot-img-box">
        <img src="${rawImg}" alt="لقطة ${index} - ${dateLabel}" loading="eager">
      </div>
      <div class="shot-caption-box">
        <p class="shot-caption-text" contenteditable="true" title="انقر لتعديل نص التوصيف مباشرة قبل الطباعة">${captionText}</p>
      </div>
    `;

    return card;
  }

  // ============================================================
  // Orientation Handler & Print CSS injection
  // ============================================================
  function applyOrientation(orient) {
    currentOrientation = orient;
    if (orient === 'portrait') {
      printSheet.classList.remove('landscape');
      printSheet.classList.add('portrait');
      orientIcon.textContent = '📄';
      orientLabel.textContent = 'قالب طولي';
      if (!isRotated90) {
        setPrintPageRule('A4 portrait');
      }
    } else {
      printSheet.classList.remove('portrait');
      printSheet.classList.add('landscape');
      orientIcon.textContent = '📐';
      orientLabel.textContent = 'قالب عرضي';
      if (!isRotated90) {
        setPrintPageRule('A4 landscape');
      }
    }
  }

  function setPrintPageRule(rule) {
    let styleEl = document.getElementById('dynamic-print-page');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'dynamic-print-page';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = `@page { size: ${rule}; margin: 0; }`;
  }

  // Action: Toggle 90-Degree Rotation for Edge-to-Edge Portrait Printing
  if (btnRotate90) {
    btnRotate90.addEventListener('click', () => {
      isRotated90 = !isRotated90;
      if (isRotated90) {
        document.body.classList.add('mode-rotate-90');
        btnRotate90.classList.add('active');
        if (rotateLabel) rotateLabel.textContent = '🔄 تدوير 90° (مُفعّل - طولي)';
        setPrintPageRule('A4 portrait');
      } else {
        document.body.classList.remove('mode-rotate-90');
        btnRotate90.classList.remove('active');
        if (rotateLabel) rotateLabel.textContent = '🔄 تدوير 90° (للطباعة الطولية)';
        setPrintPageRule(currentOrientation === 'portrait' ? 'A4 portrait' : 'A4 landscape');
      }
    });
  }

  btnToggleOrient.addEventListener('click', () => {
    const nextOrient = (currentOrientation === 'landscape') ? 'portrait' : 'landscape';
    applyOrientation(nextOrient);
    renderGallery();
  });

  // Sync DOM in-place edits back to memory state
  function syncDomEditsToState() {
    if (!currentParcel) currentParcel = {};
    if (metaName && metaName.textContent.trim()) currentParcel.applicantName = metaName.textContent.trim();
    if (metaCenter && metaCenter.textContent.trim()) currentParcel.centerCity = metaCenter.textContent.trim();
    if (metaVillage && metaVillage.textContent.trim()) currentParcel.village = metaVillage.textContent.trim();
    if (metaAddress && metaAddress.textContent.trim()) currentParcel.address = metaAddress.textContent.trim();
    if (metaLng && !isNaN(parseFloat(metaLng.textContent))) {
      currentParcel.centroid = currentParcel.centroid || {};
      currentParcel.centroid.lon = parseFloat(metaLng.textContent.trim());
      currentParcel.centerLng = currentParcel.centroid.lon;
    }
    if (metaLat && !isNaN(parseFloat(metaLat.textContent))) {
      currentParcel.centroid = currentParcel.centroid || {};
      currentParcel.centroid.lat = parseFloat(metaLat.textContent.trim());
      currentParcel.centerLat = currentParcel.centroid.lat;
    }
    if (sigSurveyor) {
      currentCommittee.surveyor = sigSurveyor.textContent.replace(/^الاسم:\s*/, '').trim();
    }
    if (sigDirector) {
      currentCommittee.director = sigDirector.textContent.replace(/^مهندسة\s*\/\s*/, '').trim();
    }
    if (sigReviewer) {
      currentCommittee.reviewer = sigReviewer.textContent.trim();
    }
  }

  // ============================================================
  // Action: Print / Save as PDF
  // ============================================================
  btnPrintPdf.addEventListener('click', () => {
    syncDomEditsToState();
    // Re-verify print page rule immediately before printing
    if (isRotated90) {
      setPrintPageRule('A4 portrait');
    } else {
      setPrintPageRule(currentOrientation === 'portrait' ? 'A4 portrait' : 'A4 landscape');
    }
    window.print();
  });



  // ============================================================
  // Action: Standalone Certificate Import (Word DOCX / PDF / JSON)
  // ============================================================
  if (btnImportCert && inputImportCert) {
    btnImportCert.addEventListener('click', () => {
      inputImportCert.value = '';
      inputImportCert.click();
    });

    inputImportCert.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      await handleImportCertificateFile(file);
    });
  }

  async function handleImportCertificateFile(file) {
    const filename = file.name.toLowerCase();
    try {
      if (filename.endsWith('.docx')) {
        alert('⚠️ تم الاستغناء عن ملفات Word بالكامل لصالح الاعتماد الرقمي وتصدير الـ PDF المتجه. يرجى استخدام ملف المشروع (JSON) أو ملف الشهادة (.certi)');
      } else if (filename.endsWith('.pdf')) {
        await importPdfCertificate(file);
      } else if (filename.endsWith('.certi') || filename.endsWith('.json')) {
        await importJsonCertificate(file);
      } else {
        alert('⚠️ صيغة الملف غير مدعومة. يرجى اختيار ملف Word (.docx) أو PDF (.pdf) أو ملف شهادة (.certi)');
      }
    } catch (err) {
      console.error('[ImportCert] Error importing file:', err);
      alert('⚠️ حدث خطأ أثناء استيراد الملف: ' + (err.message || err));
    }
  }

  // A. Import from Word DOCX (Extracts metadata table & embedded satellite photos!)
  async function importDocxCertificate(file) {
    if (typeof JSZip === 'undefined') {
      alert('⚠️ مكتبة JSZip غير متوفرة في الصفحة.');
      return;
    }
    showEditorToast('⏳ جاري استخراج بيانات وصور الشهادة من ملف Word...');
    const zip = await JSZip.loadAsync(file);

    const docXmlFile = zip.file('word/document.xml');
    if (!docXmlFile) {
      alert('⚠️ لم يتم العثور على محتوى المستند داخل ملف Word.');
      return;
    }

    const docXmlStr = await docXmlFile.async('string');
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(docXmlStr, 'application/xml');

    // 1. Extract metadata table
    const tables = xmlDoc.getElementsByTagName('w:tbl');
    let extractedMeta = {};

    for (let t = 0; t < tables.length; t++) {
      const rows = tables[t].getElementsByTagName('w:tr');
      if (rows.length >= 2) {
        const headerRow = rows[0];
        const valRow = rows[1];
        const hTexts = Array.from(headerRow.getElementsByTagName('w:tc')).map(tc => tc.textContent.trim());
        const vTexts = Array.from(valRow.getElementsByTagName('w:tc')).map(tc => tc.textContent.trim());

        if (hTexts.some(h => h.includes('المواطن') || h.includes('خط') || h.includes('المركز'))) {
          hTexts.forEach((header, idx) => {
            const val = vTexts[idx] || '';
            if (header.includes('المواطن') || header.includes('الاسم')) extractedMeta.name = val;
            else if (header.includes('العرض') || header.includes('شمال')) extractedMeta.lat = parseFloat(val);
            else if (header.includes('الطول') || header.includes('شرق')) extractedMeta.lon = parseFloat(val);
            else if (header.includes('المركز')) extractedMeta.center = val;
            else if (header.includes('المحلية') || header.includes('القرية')) extractedMeta.village = val;
            else if (header.includes('العنوان') || header.includes('الحوض')) extractedMeta.address = val;
          });
          break;
        }
      }
    }

    // 2. Extract satellite images from word/media/
    const extractedShots = [];
    const mediaFiles = Object.keys(zip.files).filter(k => k.startsWith('word/media/image'));
    mediaFiles.sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, '')) || 0;
      const numB = parseInt(b.replace(/\D/g, '')) || 0;
      return numA - numB;
    });

    for (let mIdx = 0; mIdx < mediaFiles.length; mIdx++) {
      const mediaKey = mediaFiles[mIdx];
      const base64Data = await zip.files[mediaKey].async('base64');
      const ext = mediaKey.endsWith('.png') ? 'png' : (mediaKey.endsWith('.jpg') || mediaKey.endsWith('.jpeg') ? 'jpeg' : 'png');
      const dataUrl = `data:image/${ext};base64,${base64Data}`;

      if (base64Data.length > 15000) {
        extractedShots.push({
          id: extractedShots.length + 1,
          captureDate: `${2016 + extractedShots.length * 2}`,
          status: 'معاينة الموقع',
          notes: '',
          dataUrl: dataUrl,
          imageData: dataUrl
        });
      }
    }

    // 3. Assemble State
    const cLat = extractedMeta.lat || 31.063055;
    const cLon = extractedMeta.lon || 31.404767;

    currentParcel = {
      applicantName: extractedMeta.name || 'المواطن',
      centerCity: extractedMeta.center || 'المركز',
      markaz: extractedMeta.center || 'المركز',
      village: extractedMeta.village || 'القرية',
      sheikhah: extractedMeta.village || 'القرية',
      address: extractedMeta.address || 'العنوان',
      basin: extractedMeta.address || 'العنوان',
      place: extractedMeta.address || 'العنوان',
      center: { lon: cLon, lat: cLat },
      centerLng: cLon,
      centerLat: cLat,
      centroid: { lon: cLon, lat: cLat },
      isCentroidUserEdited: true,
      vertices: [
        { id: 1, lat: cLat + 0.00007, lon: cLon - 0.00008 },
        { id: 2, lat: cLat + 0.00007, lon: cLon + 0.00008 },
        { id: 3, lat: cLat - 0.00007, lon: cLon + 0.00008 },
        { id: 4, lat: cLat - 0.00007, lon: cLon - 0.00008 }
      ]
    };

    if (extractedShots.length > 0) {
      currentShots = extractedShots;
      currentOrientation = (currentShots.length === 6) ? 'portrait' : 'landscape';
    }

    renderCertificate();
    showEditorToast(`✅ تم استيراد شهادة Word بنجاح (${currentParcel.applicantName}) بكامل البيانات والصور!`);
  }

  // B. Import from PDF
  async function importPdfCertificate(file) {
    if (typeof pdfjsLib === 'undefined') {
      alert('⚠️ مكتبة PDF.js غير متوفرة في الصفحة.');
      return;
    }
    showEditorToast('⏳ جاري قراءة وتحليل ملف شهادة PDF...');
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('libs/pdf.worker.min.js');
    } catch (e) {}

    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = '';
    const textItems = [];
    for (let pNum = 1; pNum <= pdfDoc.numPages; pNum++) {
      const page = await pdfDoc.getPage(pNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(it => it.str).join(' ');
      fullText += '\n' + pageText;
      textItems.push(...textContent.items);
    }

    const parsedData = parsePdfCertificateText(fullText, textItems);

    const cLat = parsedData.centroidLat || 31.063055;
    const cLon = parsedData.centroidLon || 31.404767;

    currentParcel = {
      applicantName: parsedData.name || 'المواطن',
      nationalId: parsedData.nationalId || '',
      centerCity: parsedData.center || '',
      markaz: parsedData.center || '',
      village: parsedData.village || '',
      sheikhah: parsedData.village || '',
      address: parsedData.address || '',
      basin: parsedData.address || '',
      place: parsedData.address || '',
      center: { lon: cLon, lat: cLat },
      centerLng: cLon,
      centerLat: cLat,
      centroid: { lon: cLon, lat: cLat },
      isCentroidUserEdited: true,
      vertices: [
        { id: 1, lat: cLat + 0.00007, lon: cLon - 0.00008 },
        { id: 2, lat: cLat + 0.00007, lon: cLon + 0.00008 },
        { id: 3, lat: cLat - 0.00007, lon: cLon + 0.00008 },
        { id: 4, lat: cLat - 0.00007, lon: cLon - 0.00008 }
      ]
    };

    if (parsedData.surveyor || parsedData.director || parsedData.reviewer) {
      currentCommittee = {
        surveyor: parsedData.surveyor || currentCommittee.surveyor,
        director: parsedData.director || currentCommittee.director,
        reviewer: parsedData.reviewer || currentCommittee.reviewer
      };
    }

    renderCertificate();
    showEditorToast(`✅ تم استيراد بيانات الشهادة بنجاح من PDF (${currentParcel.applicantName})!`);
  }

  // C. Import from JSON / .certi
  async function importJsonCertificate(file) {
    const text = await file.text();
    const data = JSON.parse(text);
    if (data.parcel) currentParcel = data.parcel;
    if (Array.isArray(data.shots)) {
      currentShots = data.shots;
      currentOrientation = (currentShots.length === 6) ? 'portrait' : 'landscape';
    }
    if (data.committee) currentCommittee = data.committee;
    if (chrome.storage && chrome.storage.local) {
      const updateObj = {
        currentParcel,
        capturedShots: currentShots,
        previewData: {
          parcel: currentParcel,
          shots: currentShots,
          committee: currentCommittee
        }
      };
      if (data.pinStyle) {
        if (data.pinStyle.color) updateObj.pinTextColor = data.pinStyle.color;
        if (data.pinStyle.size) updateObj.pinTextSize = Number(data.pinStyle.size);
        if (data.pinStyle.text !== undefined) updateObj.pinCustomText = data.pinStyle.text;
        if (data.pinStyle.position) updateObj.pinTextPosition = data.pinStyle.position;
        if (data.pinStyle.showBg !== undefined) updateObj.pinShowBg = data.pinStyle.showBg;
      }
      chrome.storage.local.set(updateObj);
    }
    renderCertificate();
    showEditorToast(`✅ تم استرجاع ملف المشروع بالكامل (${currentParcel.applicantName || 'المواطن'})!`);
  }

  // Action: Save Project File (.json) with Citizen Name and Center
  if (btnSaveCertDraft) {
    btnSaveCertDraft.addEventListener('click', () => {
      syncDomEditsToState();
      if (!currentParcel) {
        alert('لا توجد بيانات مشروع لحفظها.');
        return;
      }

      chrome.storage.local.get(['pinTextColor', 'pinTextSize', 'pinCustomText', 'pinTextPosition', 'pinShowBg'], (pinRes) => {
        const exportData = {
          version: '3.5',
          exportedAt: new Date().toISOString(),
          parcel: currentParcel,
          shots: currentShots,
          committee: currentCommittee,
          pinStyle: {
            color: (pinRes && pinRes.pinTextColor) || '#fbbf24',
            size: (pinRes && pinRes.pinTextSize) || 12,
            text: (pinRes && pinRes.pinCustomText !== undefined) ? pinRes.pinCustomText : '🎯 المركز',
            position: (pinRes && pinRes.pinTextPosition) || 'below',
            showBg: (pinRes && pinRes.pinShowBg !== undefined) ? pinRes.pinShowBg : true
          }
        };
        const jsonStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });

        const rawName = (currentParcel.applicantName || currentParcel.name || 'المواطن').trim();
        const rawCenter = (currentParcel.centerCity || currentParcel.center || currentParcel.markaz || '').trim();

        const safeName = rawName.replace(/[\\/:*?"<>|]/g, '_');
        const safeCenter = rawCenter.replace(/[\\/:*?"<>|]/g, '_');

        const fileName = safeCenter ? `${safeName} - ${safeCenter}.json` : `${safeName}.json`;
        saveAs(blob, fileName);
        showEditorToast(`💾 تم حفظ ملف المشروع (${fileName}) بنجاح!`);
      });
    });
  }

  function parsePdfCertificateText(rawText, items) {
    let cleaned = rawText || '';

    if (items && Array.isArray(items) && items.length > 0) {
      try {
        const sortedItems = [...items].sort((a, b) => {
          const yA = (a.transform && a.transform[5]) || 0;
          const yB = (b.transform && b.transform[5]) || 0;
          if (Math.abs(yB - yA) > 4) return yB - yA;
          const xA = (a.transform && a.transform[4]) || 0;
          const xB = (b.transform && b.transform[4]) || 0;
          return xA - xB;
        });
        cleaned += '\n' + sortedItems.map(it => it.str).join(' ');
      } catch (sErr) {}
    }

    const easternDigits = '٠١٢٣٤٥٦٧٨٩';
    for (let i = 0; i < easternDigits.length; i++) {
      cleaned = cleaned.split(easternDigits[i]).join(String(i));
    }
    cleaned = cleaned.replace(/٫/g, '.').replace(/(\d+),(\d+)/g, '$1.$2').replace(/،/g, ',');

    const data = {
      name: '',
      nationalId: '',
      center: '',
      village: '',
      address: '',
      centroidLon: null,
      centroidLat: null,
      surveyor: '',
      director: '',
      reviewer: ''
    };

    const natIdMatch = cleaned.match(/\b([23]\d{13})\b/);
    if (natIdMatch) data.nationalId = natIdMatch[1];

    const DAKAHLIA_CENTERS = [
      'ميت غمر', 'المنصورة', 'السنبلاوين', 'بلقاس', 'دكرنس',
      'أجا', 'اجا', 'شربين', 'طلخا', 'منية النصر', 'ميت سلسيل',
      'الجمالية', 'بني عبيد', 'تمي الأمديد', 'تمى الامديد', 'نبروه', 'المطرية', 'المنزلة'
    ];
    for (const c of DAKAHLIA_CENTERS) {
      if (cleaned.includes(c)) {
        data.center = (c === 'اجا') ? 'أجا' : ((c === 'تمى الامديد') ? 'تمي الأمديد' : c);
        break;
      }
    }

    const coordMatches = cleaned.match(/\b(3[012]\.\d{3,9})\b/g);
    if (coordMatches && coordMatches.length >= 2) {
      const lonLabel = cleaned.match(/(?:خط\s*الطول|طول|شرقيات|X)\s*[:=]?\s*(3[012]\.\d+)/i);
      const latLabel = cleaned.match(/(?:خط\s*العرض|عرض|شماليات|Y)\s*[:=]?\s*(3[012]\.\d+)/i);
      if (lonLabel && latLabel) {
        data.centroidLon = parseFloat(lonLabel[1]);
        data.centroidLat = parseFloat(latLabel[1]);
      } else {
        const num1 = parseFloat(coordMatches[0]);
        const num2 = parseFloat(coordMatches[1]);
        data.centroidLon = Math.max(num1, num2);
        data.centroidLat = Math.min(num1, num2);
      }
    }

    const namePatterns = [
      /(?:اسم\s*المواطن|المواطن|صاحب\s*الشأن|السيد|الاسم)\s*[:/=\-]?\s*([^\n\r,\t|]+)/,
      /(?:المواطن\s*\/)\s*([^\n\r,\t|]+)/
    ];
    for (const pat of namePatterns) {
      const m = cleaned.match(pat);
      if (m && m[1]) {
        let val = m[1].trim().replace(/(?:الرقم|بطاقة|مركز|الوحدة|تاريخ|طلب|شهادة).*$/, '').trim();
        if (val.length >= 4) {
          data.name = val;
          break;
        }
      }
    }

    const villageMatch = cleaned.match(/(?:الوحدة\s*المحلية|قرية|القرية)\s*[:/=\-]?\s*([^\n\r,\t|]+)/);
    if (villageMatch && villageMatch[1]) {
      data.village = villageMatch[1].trim().replace(/(?:المركز|العنوان|حوض|شارع|محافظة).*$/, '').trim();
    }

    const addrMatch = cleaned.match(/(?:العنوان\s*\/\s*الحوض|العنوان|الموقع|الحوض|حوض)\s*[:/=\-]?\s*([^\n\r,\t|]+)/);
    if (addrMatch && addrMatch[1]) {
      data.address = addrMatch[1].trim().replace(/(?:الوحدة|المركز|تاريخ|المواطن).*$/, '').trim();
    }

    const survMatch = cleaned.match(/(?:مسؤول\s*المتغيرات|المساح|القائم\s*بالمعاينة)\s*[:/=\-]?\s*([^\n\r,\t|]+)/);
    if (survMatch && survMatch[1]) data.surveyor = survMatch[1].trim().replace(/(?:الاسم|مهندس).*[:/]/, '').trim();

    const dirMatch = cleaned.match(/(?:مدير\s*الإدارة|مديرة\s*الإدارة|مدير\s*إدارة)\s*[:/=\-]?\s*([^\n\r,\t|]+)/);
    if (dirMatch && dirMatch[1]) data.director = dirMatch[1].trim().replace(/(?:الاسم|مهندسة).*[:/]/, '').trim();

    const revMatch = cleaned.match(/(?:المراجع|رئيس\s*اللجنة)\s*[:/=\-]?\s*([^\n\r,\t|]+)/);
    if (revMatch && revMatch[1]) data.reviewer = revMatch[1].trim();

    return data;
  }

  // ============================================================
  // Centroid Calculation Helper
  // ============================================================
  function calculateCentroid(parcel) {
    if (!parcel) return { lon: null, lat: null };

    // 0. If user edited / provided custom centroid, prioritize it directly
    if (parcel.centroid && parcel.centroid.lon !== undefined && parcel.centroid.lat !== undefined && !isNaN(parcel.centroid.lon) && !isNaN(parcel.centroid.lat)) {
      return { lon: Number(parcel.centroid.lon), lat: Number(parcel.centroid.lat) };
    }

    const vertices = parcel.vertices || [];
    if (Array.isArray(vertices) && vertices.length >= 3) {
      const pts = [];
      for (let i = 0; i < vertices.length; i++) {
        const v = vertices[i];
        const x = (v.lon !== undefined ? Number(v.lon) : (v.lng !== undefined ? Number(v.lng) : (v.rawX !== undefined ? Number(v.rawX) : null)));
        const y = (v.lat !== undefined ? Number(v.lat) : (v.rawY !== undefined ? Number(v.rawY) : null));
        if (x !== null && y !== null && !isNaN(x) && !isNaN(y)) {
          pts.push([x, y]);
        }
      }

      if (pts.length > 3) {
        const first = pts[0];
        const last = pts[pts.length - 1];
        if (Math.abs(first[0] - last[0]) < 1e-7 && Math.abs(first[1] - last[1]) < 1e-7) {
          pts.pop();
        }
      }

      const n = pts.length;
      if (n >= 3) {
        // High-precision origin-shift to eliminate floating point cancellation in WGS84 coordinates:
        const x0 = pts[0][0];
        const y0 = pts[0][1];
        const relPts = pts.map(p => [p[0] - x0, p[1] - y0]);

        let signedArea = 0;
        let cx = 0;
        let cy = 0;
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          const cross = (relPts[i][0] * relPts[j][1]) - (relPts[j][0] * relPts[i][1]);
          signedArea += cross;
          cx += (relPts[i][0] + relPts[j][0]) * cross;
          cy += (relPts[i][1] + relPts[j][1]) * cross;
        }
        signedArea = signedArea / 2.0;

        if (Math.abs(signedArea) > 1e-12) {
          cx = cx / (6.0 * signedArea);
          cy = cy / (6.0 * signedArea);
          const trueCx = cx + x0;
          const trueCy = cy + y0;
          if (!isNaN(trueCx) && !isNaN(trueCy)) {
            return { lon: trueCx, lat: trueCy };
          }
        }

        let sumX = 0, sumY = 0;
        for (let i = 0; i < n; i++) {
          sumX += pts[i][0];
          sumY += pts[i][1];
        }
        return { lon: sumX / n, lat: sumY / n };
      }
    }

    if (parcel.center) {
      const lat = (parcel.center.lat !== undefined) ? Number(parcel.center.lat) : null;
      const lon = (parcel.center.lon !== undefined) ? Number(parcel.center.lon) : ((parcel.center.lng !== undefined) ? Number(parcel.center.lng) : null);
      if (lat !== null && lon !== null && !isNaN(lat) && !isNaN(lon)) {
        return { lon, lat };
      }
    }

    const lat = (parcel.centerLat !== undefined) ? Number(parcel.centerLat) : null;
    const lon = (parcel.centerLng !== undefined) ? Number(parcel.centerLng) : ((parcel.centerLon !== undefined) ? Number(parcel.centerLon) : null);
    if (lat !== null && lon !== null && !isNaN(lat) && !isNaN(lon)) {
      return { lon, lat };
    }

    return { lon: null, lat: null };
  }

  function parseDateScore(dateStr) {
    if (!dateStr) return 0;
    const parts = String(dateStr).trim().split(/[\/\-]/);
    if (parts.length >= 2) {
      const y = parseInt(parts[0], 10) || 0;
      const m = parseInt(parts[1], 10) || 1;
      return y * 100 + m;
    }
    return parseInt(dateStr, 10) || 0;
  }

  // ============================================================
  // 20. Floating Text Format Toolbar Logic (A+ / A- / Bold / Reset)
  // ============================================================
  function updateTextToolbarPosition(el) {
    if (!textFormatToolbar || !el) return;
    const rect = el.getBoundingClientRect();
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;

    const top = rect.top + scrollY - 6;
    const left = rect.left + scrollX + (rect.width / 2);

    textFormatToolbar.style.top = `${Math.max(10, top)}px`;
    textFormatToolbar.style.left = `${left}px`;
    textFormatToolbar.style.display = 'block';

    // Read current font size
    const computed = window.getComputedStyle(el);
    const pxVal = parseFloat(computed.fontSize) || 14;
    const ptVal = Math.round(pxVal * 0.75 * 10) / 10;
    if (textSizeBadge) {
      textSizeBadge.textContent = `${ptVal}pt`;
    }

    const fw = computed.fontWeight;
    const isBold = (parseInt(fw, 10) >= 700 || fw === 'bold');
    if (btnTextBold) {
      btnTextBold.classList.toggle('active', isBold);
    }
  }

  function hideTextToolbar() {
    if (textFormatToolbar) {
      textFormatToolbar.style.display = 'none';
    }
    activeEditableEl = null;
  }

  // Focusin event on any contenteditable element
  document.addEventListener('focusin', (e) => {
    const editable = e.target.closest('[contenteditable="true"]');
    if (editable) {
      activeEditableEl = editable;
      updateTextToolbarPosition(editable);
    }
  });

  // Click event on or outside editable elements
  document.addEventListener('click', (e) => {
    if (textFormatToolbar && textFormatToolbar.contains(e.target)) {
      return; // Keep open when interacting with toolbar
    }
    const editable = e.target.closest('[contenteditable="true"]');
    if (editable) {
      activeEditableEl = editable;
      updateTextToolbarPosition(editable);
    } else {
      hideTextToolbar();
    }
  });

  // Reposition on scroll or resize
  window.addEventListener('resize', () => {
    if (activeEditableEl) updateTextToolbarPosition(activeEditableEl);
  });
  window.addEventListener('scroll', () => {
    if (activeEditableEl) updateTextToolbarPosition(activeEditableEl);
  }, true);

  // Increase Font Size Button (A+)
  if (btnTextSizeInc) {
    btnTextSizeInc.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!activeEditableEl) return;
      const currentPx = parseFloat(window.getComputedStyle(activeEditableEl).fontSize) || 14;
      const newPx = Math.min(50, currentPx + 1);
      activeEditableEl.style.fontSize = `${newPx}px`;
      updateTextToolbarPosition(activeEditableEl);
    });
  }

  // Decrease Font Size Button (A-)
  if (btnTextSizeDec) {
    btnTextSizeDec.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!activeEditableEl) return;
      const currentPx = parseFloat(window.getComputedStyle(activeEditableEl).fontSize) || 14;
      const newPx = Math.max(7, currentPx - 1);
      activeEditableEl.style.fontSize = `${newPx}px`;
      updateTextToolbarPosition(activeEditableEl);
    });
  }

  // Bold Toggle Button (B)
  if (btnTextBold) {
    btnTextBold.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!activeEditableEl) return;
      const fw = window.getComputedStyle(activeEditableEl).fontWeight;
      const isBold = (parseInt(fw, 10) >= 700 || fw === 'bold');
      activeEditableEl.style.fontWeight = isBold ? '400' : '800';
      updateTextToolbarPosition(activeEditableEl);
    });
  }

  // Reset Font Button (↺)
  if (btnTextReset) {
    btnTextReset.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!activeEditableEl) return;
      activeEditableEl.style.fontSize = '';
      activeEditableEl.style.fontWeight = '';
      updateTextToolbarPosition(activeEditableEl);
    });
  }

  // Keyboard Shortcuts: Ctrl + Plus / Ctrl + Minus
  document.addEventListener('keydown', (e) => {
    if (activeEditableEl && (e.ctrlKey || e.metaKey)) {
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        btnTextSizeInc.click();
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        btnTextSizeDec.click();
      }
    }
  });
});
