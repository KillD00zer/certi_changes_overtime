/**
 * Controller for Dakahlia Spatial Variables Certificate - Preview & Print Page
 * Reads parcel, shots, and committee metadata from chrome.storage.local
 * Renders pixel-perfect A4 printable layout with instant window.print() (PDF) support
 */

document.addEventListener('DOMContentLoaded', () => {
  let currentParcel = null;
  let currentShots = [];
  let currentCommittee = {};
  let currentOrientation = 'landscape'; // 'landscape' | 'portrait'

  // DOM Elements
  const printSheet = document.getElementById('print-sheet');
  const citizenNameBadge = document.getElementById('citizen-name-badge');
  const btnPrintPdf = document.getElementById('btn-print-pdf');
  const btnRotate90 = document.getElementById('btn-rotate-90');
  const rotateLabel = document.getElementById('rotate-label');
  const btnDownloadCsv = document.getElementById('btn-download-csv');
  const btnDownloadDocx = document.getElementById('btn-download-docx');
  const btnToggleOrient = document.getElementById('btn-toggle-orient');
  const orientIcon = document.getElementById('orient-icon');
  const orientLabel = document.getElementById('orient-label');
  let isRotated90 = false;

  // Dynamic Tuning Bar Elements
  const btnLayoutAuto = document.getElementById('btn-layout-auto');
  const btnLayout1Row = document.getElementById('btn-layout-1row');
  const btnLayout2Rows = document.getElementById('btn-layout-2rows');
  const sliderCardHeight = document.getElementById('slider-card-height');
  const labelCardHeight = document.getElementById('label-card-height');
  const btnFontDown = document.getElementById('btn-font-down');
  const btnFontUp = document.getElementById('btn-font-up');
  const labelFontSize = document.getElementById('label-font-size');
  const btnGapSm = document.getElementById('btn-gap-sm');
  const btnGapMd = document.getElementById('btn-gap-md');
  const btnGapLg = document.getElementById('btn-gap-lg');
  const btnResetTuning = document.getElementById('btn-reset-tuning');

  let currentLayoutMode = 'auto'; // 'auto' | '1row' | '2rows'
  let currentCardHeight = null; // null = dynamic auto calculation
  let currentFontSizePt = 10;
  let currentGapPx = 8;

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

  // 1. Load Data from Storage (supports chrome.storage.local and standalone browser testing)
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
    // 2 to 5 shots: Landscape
    // 6 shots: Portrait (2x3 grid)
    currentOrientation = (currentShots.length === 6) ? 'portrait' : 'landscape';

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

  // 2. Render Certificate Content
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
        imgSpatialLogo.src = 'data:image/png;base64,' + window.TemplateAssets.SPATIAL_LOGO;
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
    metaAddress.textContent = currentParcel.basin || currentParcel.address || currentParcel.placeName || '—';

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
  }

  // 3. Render Satellite Images Gallery
  function renderGallery() {
    certGallerySection.innerHTML = '';

    // Sort shots chronologically (Oldest to Newest)
    const sortedShots = [...currentShots].sort((a, b) => {
      return parseDateScore(a.captureDate) - parseDateScore(b.captureDate);
    });

    const count = sortedShots.length;
    let layout = currentLayoutMode; // 'auto' | '1row' | '2rows'

    if (layout === 'auto') {
      if (count === 4 || count === 6) {
        layout = '2rows';
      } else {
        layout = '1row';
      }
    }

    if (layout === '2rows') {
      if (count === 4) {
        // 2x2 Grid for 4 shots (2 on top, 2 on bottom)
        const grid = document.createElement('div');
        grid.className = 'gallery-grid-4';
        sortedShots.forEach((shot, idx) => {
          grid.appendChild(createShotCard(shot, idx + 1));
        });
        certGallerySection.appendChild(grid);
      } else if (count === 6) {
        // 2x3 Grid for 6 shots (3 columns x 2 rows)
        const grid = document.createElement('div');
        grid.className = 'gallery-grid-6';
        sortedShots.forEach((shot, idx) => {
          grid.appendChild(createShotCard(shot, idx + 1));
        });
        certGallerySection.appendChild(grid);
      } else if (count === 5) {
        // 5 shots in 2 rows: 3 on top, 2 on bottom
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
        // Fallback for 2 or 3 shots
        const row = document.createElement('div');
        row.className = `gallery-row count-${count}`;
        sortedShots.forEach((shot, idx) => {
          row.appendChild(createShotCard(shot, idx + 1));
        });
        certGallerySection.appendChild(row);
      }
    } else {
      // 1 Row (All images in 1 horizontal row)
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

  // Smart Dynamic Auto-Fit Calculation
  function autoComputeOptimalHeight() {
    if (currentCardHeight !== null) {
      updateTuningStyles();
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
      const isTwoRows = (currentLayoutMode === '2rows') || (currentLayoutMode === 'auto' && (count === 4 || count === 6 || count === 5));

      let optH = isTwoRows ? Math.floor((availH - currentGapPx) / 2) : Math.floor(availH);
      optH = Math.max(95, Math.min(optH, 250));

      if (labelCardHeight) labelCardHeight.textContent = `${optH}px (ذكي)`;
      if (sliderCardHeight) sliderCardHeight.value = optH;
      document.documentElement.style.setProperty('--gallery-card-height', `${optH}px`);
    } catch (e) {
      console.warn('Auto height calculation:', e);
    }
    updateTuningStyles();
  }

  // Update Dynamic CSS Variables & Sync with UI
  function updateTuningStyles() {
    if (currentCardHeight !== null) {
      document.documentElement.style.setProperty('--gallery-card-height', `${currentCardHeight}px`);
      if (labelCardHeight) labelCardHeight.textContent = `${currentCardHeight}px`;
      if (sliderCardHeight) sliderCardHeight.value = currentCardHeight;
    }

    document.documentElement.style.setProperty('--caption-font-size', `${currentFontSizePt}pt`);
    if (labelFontSize) labelFontSize.textContent = `${currentFontSizePt}pt`;

    document.documentElement.style.setProperty('--gallery-gap', `${currentGapPx}px`);

    try {
      localStorage.setItem('cert_tuning_pref', JSON.stringify({
        layout: currentLayoutMode,
        height: currentCardHeight,
        fontSize: currentFontSizePt,
        gap: currentGapPx
      }));
    } catch (e) {}
  }

  // Load Saved Preferences from localStorage
  function loadSavedTuning() {
    try {
      const saved = localStorage.getItem('cert_tuning_pref');
      if (saved) {
        const pref = JSON.parse(saved);
        if (pref.layout) currentLayoutMode = pref.layout;
        if (pref.height) currentCardHeight = pref.height;
        if (pref.fontSize) currentFontSizePt = pref.fontSize;
        if (pref.gap) currentGapPx = pref.gap;

        if (currentLayoutMode === '1row' && btnLayout1Row) {
          [btnLayoutAuto, btnLayout1Row, btnLayout2Rows].forEach(b => b && b.classList.remove('active'));
          btnLayout1Row.classList.add('active');
        } else if (currentLayoutMode === '2rows' && btnLayout2Rows) {
          [btnLayoutAuto, btnLayout1Row, btnLayout2Rows].forEach(b => b && b.classList.remove('active'));
          btnLayout2Rows.classList.add('active');
        }

        if (currentGapPx === 4 && btnGapSm) {
          [btnGapSm, btnGapMd, btnGapLg].forEach(b => b && b.classList.remove('active'));
          btnGapSm.classList.add('active');
        } else if (currentGapPx === 12 && btnGapLg) {
          [btnGapSm, btnGapMd, btnGapLg].forEach(b => b && b.classList.remove('active'));
          btnGapLg.classList.add('active');
        }
      }
    } catch (e) {}
  }

  loadSavedTuning();

  // 1. Layout Mode Handlers
  function setLayoutMode(mode) {
    currentLayoutMode = mode;
    [btnLayoutAuto, btnLayout1Row, btnLayout2Rows].forEach(btn => {
      if (btn) btn.classList.remove('active');
    });
    if (mode === 'auto' && btnLayoutAuto) btnLayoutAuto.classList.add('active');
    if (mode === '1row' && btnLayout1Row) btnLayout1Row.classList.add('active');
    if (mode === '2rows' && btnLayout2Rows) btnLayout2Rows.classList.add('active');

    renderGallery();
  }

  if (btnLayoutAuto) btnLayoutAuto.addEventListener('click', () => setLayoutMode('auto'));
  if (btnLayout1Row) btnLayout1Row.addEventListener('click', () => setLayoutMode('1row'));
  if (btnLayout2Rows) btnLayout2Rows.addEventListener('click', () => setLayoutMode('2rows'));

  // 2. Card Height Slider Handler
  if (sliderCardHeight) {
    sliderCardHeight.addEventListener('input', (e) => {
      currentCardHeight = parseInt(e.target.value, 10);
      updateTuningStyles();
    });
  }

  // 3. Caption Font Size Buttons
  if (btnFontDown) {
    btnFontDown.addEventListener('click', () => {
      if (currentFontSizePt > 7.5) {
        currentFontSizePt = Math.max(7.5, currentFontSizePt - 0.5);
        updateTuningStyles();
      }
    });
  }

  if (btnFontUp) {
    btnFontUp.addEventListener('click', () => {
      if (currentFontSizePt < 14) {
        currentFontSizePt = Math.min(14, currentFontSizePt + 0.5);
        updateTuningStyles();
      }
    });
  }

  // 4. Gallery Gap Handlers
  function setGap(px, activeBtn) {
    currentGapPx = px;
    [btnGapSm, btnGapMd, btnGapLg].forEach(b => { if (b) b.classList.remove('active'); });
    if (activeBtn) activeBtn.classList.add('active');
    updateTuningStyles();
  }

  if (btnGapSm) btnGapSm.addEventListener('click', () => setGap(4, btnGapSm));
  if (btnGapMd) btnGapMd.addEventListener('click', () => setGap(8, btnGapMd));
  if (btnGapLg) btnGapLg.addEventListener('click', () => setGap(12, btnGapLg));

  // 5. Reset to Smart GIS Defaults
  if (btnResetTuning) {
    btnResetTuning.addEventListener('click', () => {
      currentCardHeight = null;
      currentFontSizePt = 10;
      currentGapPx = 8;
      setLayoutMode('auto');
      setGap(8, btnGapMd);
      autoComputeOptimalHeight();
    });
  }

  // Helper: Create individual shot card
  function createShotCard(shot, index) {
    const card = document.createElement('div');
    card.className = 'shot-card';

    const rawImg = shot.imageData || shot.dataUrl || '';
    const dateLabel = shot.captureDate || '—';
    let statusLabel = shot.status || 'معاينة الموقع';
    if (shot.notes && !statusLabel.includes(shot.notes)) {
      statusLabel = `${statusLabel} (${shot.notes})`;
    }

    const captionText = `${statusLabel} في ${dateLabel}`;

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

  // 4. Orientation Handler & Print CSS injection
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

  // 5. Action: Print / Save as PDF
  btnPrintPdf.addEventListener('click', () => {
    // Re-verify print page rule immediately before printing
    if (isRotated90) {
      setPrintPageRule('A4 portrait');
    } else {
      setPrintPageRule(currentOrientation === 'portrait' ? 'A4 portrait' : 'A4 landscape');
    }
    window.print();
  });

  // 6. Action: Download Polygon.csv
  btnDownloadCsv.addEventListener('click', () => {
    if (!currentParcel) return;
    try {
      const csvContent = window.GeoEngine ? window.GeoEngine.generatePolygonCsvContent(currentParcel, currentParcel.vertices) : '';
      const idNoSafe = (currentParcel.idNo || '62644774').replace(/[\\/:*?"<>|]/g, '_');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      saveAs(blob, `Polygon_${idNoSafe}.csv`);
    } catch (err) {
      alert('خطأ أثناء تصدير ملف CSV: ' + err.message);
    }
  });

  // 7. Action: Download Word DOCX (Bonus fallback)
  btnDownloadDocx.addEventListener('click', async () => {
    if (!currentParcel || !window.DocxBuilder) return;
    try {
      btnDownloadDocx.disabled = true;
      btnDownloadDocx.textContent = '⏳ جاري التحميل...';
      const docxBlob = await window.DocxBuilder.generateDocxReport(currentParcel, currentShots, currentCommittee);
      const citizenSafe = (currentParcel.applicantName || 'المواطن').replace(/[\\/:*?"<>|]/g, '_');
      saveAs(docxBlob, `بيان_تسلسل_زمني_${citizenSafe}.docx`);
    } catch (err) {
      alert('خطأ أثناء إنشاء ملف Word: ' + err.message);
    } finally {
      btnDownloadDocx.disabled = false;
      btnDownloadDocx.textContent = '📄 تنزيل Word';
    }
  });

  // --- Centroid Calculation Helper ---
  function calculateCentroid(parcel) {
    if (!parcel) return { lon: null, lat: null };

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
        let signedArea = 0;
        let cx = 0;
        let cy = 0;
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          const cross = (pts[i][0] * pts[j][1]) - (pts[j][0] * pts[i][1]);
          signedArea += cross;
          cx += (pts[i][0] + pts[j][0]) * cross;
          cy += (pts[i][1] + pts[j][1]) * cross;
        }
        signedArea = signedArea / 2.0;

        if (Math.abs(signedArea) > 1e-12) {
          cx = cx / (6.0 * signedArea);
          cy = cy / (6.0 * signedArea);
          if (!isNaN(cx) && !isNaN(cy)) {
            return { lon: cx, lat: cy };
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
});
