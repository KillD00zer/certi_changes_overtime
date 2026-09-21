/**
 * SidePanel Controller for Google Earth Survey Extension
 * Manages survey file ingestion, manual data entry, CSV builder/export,
 * parcel metrics, camera navigation, timeline shots capture (with month selector),
 * and official Word (.docx) & CSV package export.
 */

document.addEventListener('DOMContentLoaded', () => {
  let currentParcel = null;
  let capturedShots = [];

  // Default points seeded with sample coordinates (from Polygon_1.csv)
  let manualPoints = [
    { x: '31.302407', y: '30.985227' },
    { x: '31.302519', y: '30.985165' },
    { x: '31.302504', y: '30.985141' },
    { x: '31.302392', y: '30.985203' }
  ];

  // DOM Elements - Tabs
  const tabBtnUpload = document.getElementById('tab-btn-upload');
  const tabBtnManual = document.getElementById('tab-btn-manual');
  const tabViewUpload = document.getElementById('tab-view-upload');
  const tabViewManual = document.getElementById('tab-view-manual');

  // DOM Elements - Upload Tab
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const btnSampleGhazal = document.getElementById('btn-sample-ghazal');
  const btnSampleTanakh = document.getElementById('btn-sample-tanakh');
  const inpName = document.getElementById('inp-name');
  const inpNatId = document.getElementById('inp-natid');
  const inpCenter = document.getElementById('inp-center');
  const inpVillage = document.getElementById('inp-village');

  // DOM Elements - Manual Tab
  const inpManName = document.getElementById('inp-man-name');
  const inpManNatId = document.getElementById('inp-man-natid');
  const inpManIdNo = document.getElementById('inp-man-idno');
  const inpManCenter = document.getElementById('inp-man-center');
  const inpManSheikhah = document.getElementById('inp-man-sheikhah');
  const inpManPlace = document.getElementById('inp-man-place');
  const inpManActivity = document.getElementById('inp-man-activity');
  const inpManStatus = document.getElementById('inp-man-status');
  const inpManGov = document.getElementById('inp-man-gov');

  const pointsCountBadge = document.getElementById('points-count-badge');
  const btnAddPointRow = document.getElementById('btn-add-point-row');
  const btnTogglePaste = document.getElementById('btn-toggle-paste');
  const btnClearPoints = document.getElementById('btn-clear-points');
  const boxPasteCoords = document.getElementById('box-paste-coords');
  const txtPasteCoords = document.getElementById('txt-paste-coords');
  const btnApplyPaste = document.getElementById('btn-apply-paste');
  const tblManualPointsBody = document.getElementById('tbl-manual-points-body');
  const btnExportCsvManual = document.getElementById('btn-export-csv-manual');
  const btnConnectManual = document.getElementById('btn-connect-manual');

  // DOM Elements - Parcel Section
  const sectionParcel = document.getElementById('section-parcel');
  const metricArea = document.getElementById('metric-area');
  const metricPerimeter = document.getElementById('metric-perimeter');
  const metricVertices = document.getElementById('metric-vertices');
  const metricCrs = document.getElementById('metric-crs');
  const btnModePoly = document.getElementById('btn-mode-poly');
  const btnModePoint = document.getElementById('btn-mode-point');
  const btnFlyEarth = document.getElementById('btn-fly-earth');
  const btnCenterCamera = document.getElementById('btn-center-camera');
  const btnTogglePoly = document.getElementById('btn-toggle-poly');
  const btnExportKml = document.getElementById('btn-export-kml');
  let currentOverlayMode = 'polygon'; // 'polygon' | 'point'

  // DOM Elements - Capture Section
  const sectionCapture = document.getElementById('section-capture');
  const shotsLimitBadge = document.getElementById('shots-limit-badge');
  const selectCaptureYear = document.getElementById('select-capture-year');
  const selectCaptureMonth = document.getElementById('select-capture-month');
  const selectInspectStatus = document.getElementById('select-inspect-status');
  const groupCustomStatus = document.getElementById('group-custom-status');
  const inpInspectStatusCustom = document.getElementById('inp-inspect-status-custom');
  const inpInspectNotes = document.getElementById('inp-inspect-notes');
  const btnCaptureShot = document.getElementById('btn-capture-shot');

  // DOM Elements - Gallery Section
  const sectionGallery = document.getElementById('section-gallery');
  const galleryCount = document.getElementById('gallery-count');
  const shotsContainer = document.getElementById('shots-container');

  // DOM Elements - Export Section
  const sectionExport = document.getElementById('section-export');
  const inpSurveyor = document.getElementById('inp-surveyor');
  const inpReviewer = document.getElementById('inp-reviewer');
  const inpDirector = document.getElementById('inp-director');
  const btnPreviewPdf = document.getElementById('btn-preview-pdf');
  const btnGenerateDocx = document.getElementById('btn-generate-docx');
  const btnResetAll = document.getElementById('btn-reset-all');
  const toast = document.getElementById('toast');

  // --- 0. TABS SWITCHING ---
  tabBtnUpload.addEventListener('click', () => {
    tabBtnUpload.classList.add('active');
    tabBtnManual.classList.remove('active');
    tabViewUpload.style.display = 'block';
    tabViewManual.style.display = 'none';
  });

  tabBtnManual.addEventListener('click', () => {
    tabBtnManual.classList.add('active');
    tabBtnUpload.classList.remove('active');
    tabViewManual.style.display = 'block';
    tabViewUpload.style.display = 'none';
    renderManualPointsTable();
  });

  // --- 1. MANUAL POINTS TABLE MANAGEMENT ---
  function renderManualPointsTable() {
    if (!tblManualPointsBody) return;
    tblManualPointsBody.innerHTML = '';
    pointsCountBadge.textContent = `${manualPoints.length} نقاط`;

    manualPoints.forEach((pt, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight: 700; color: #94a3b8;">${idx + 1}</td>
        <td><input type="text" class="inp-pt-x" data-idx="${idx}" value="${pt.x || ''}" placeholder="خط الطول (X)"></td>
        <td><input type="text" class="inp-pt-y" data-idx="${idx}" value="${pt.y || ''}" placeholder="خط العرض (Y)"></td>
        <td><button class="btn-del-row" data-idx="${idx}" title="حذف هذا الركن" type="button">✖</button></td>
      `;

      tr.querySelector('.inp-pt-x').addEventListener('input', (e) => {
        const i = parseInt(e.target.getAttribute('data-idx'));
        manualPoints[i].x = e.target.value.trim();
      });

      tr.querySelector('.inp-pt-y').addEventListener('input', (e) => {
        const i = parseInt(e.target.getAttribute('data-idx'));
        manualPoints[i].y = e.target.value.trim();
      });

      tr.querySelector('.btn-del-row').addEventListener('click', (e) => {
        const i = parseInt(e.currentTarget.getAttribute('data-idx'));
        manualPoints.splice(i, 1);
        renderManualPointsTable();
      });

      tblManualPointsBody.appendChild(tr);
    });
  }

  // Add empty row
  btnAddPointRow.addEventListener('click', () => {
    manualPoints.push({ x: '', y: '' });
    renderManualPointsTable();
    // Focus new row
    setTimeout(() => {
      const inputs = tblManualPointsBody.querySelectorAll('.inp-pt-x');
      if (inputs.length > 0) inputs[inputs.length - 1].focus();
    }, 50);
  });

  // Toggle paste box
  btnTogglePaste.addEventListener('click', () => {
    const isShown = boxPasteCoords.style.display !== 'none';
    boxPasteCoords.style.display = isShown ? 'none' : 'block';
    if (!isShown) txtPasteCoords.focus();
  });

  // Clear all points
  btnClearPoints.addEventListener('click', () => {
    if (manualPoints.length > 0 && !confirm('هل تريد تفريغ قائمة أركان الموقع بالكامل؟')) return;
    manualPoints = [];
    renderManualPointsTable();
  });

  // Apply pasted coordinates
  btnApplyPaste.addEventListener('click', () => {
    const raw = txtPasteCoords.value.trim();
    if (!raw) {
      alert('يرجى لصق نص الإحداثيات داخل المربع أولاً.');
      return;
    }

    const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
    const parsed = [];

    lines.forEach((line) => {
      // Split by tab, comma, semicolon, or whitespace
      const parts = line.trim().split(/[\t,;\s]+/).map(p => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        // If 3 columns (e.g. ID, X, Y), take 2nd and 3rd
        if (parts.length >= 3 && !isNaN(parseFloat(parts[0])) && !isNaN(parseFloat(parts[1])) && !isNaN(parseFloat(parts[2]))) {
          parsed.push({ x: parts[1], y: parts[2] });
        } else {
          parsed.push({ x: parts[0], y: parts[1] });
        }
      }
    });

    if (parsed.length < 3) {
      alert('تم العثور على أقل من 3 نقاط صالحة. يرجى التحقق من صياغة الإحداثيات.');
      return;
    }

    manualPoints = parsed;
    renderManualPointsTable();
    boxPasteCoords.style.display = 'none';
    txtPasteCoords.value = '';
    showToast(`✅ تم استيراد ${manualPoints.length} نقطة بنجاح!`);
  });

  // Helper: Read Manual Meta
  function getManualMetadata() {
    return {
      name: inpManName.value.trim() || 'يحيى عوض محمد عوض',
      nationalId: inpManNatId.value.trim() || '26205251201152',
      idNo: inpManIdNo.value.trim() || '62644774',
      center: inpManCenter.value.trim() || 'أجا',
      sheikhah: inpManSheikhah.value.trim() || 'نوسا البحر',
      place: inpManPlace.value.trim() || 'نوسا البحر ــ أجا',
      activity: inpManActivity.value || 'سكني',
      status: inpManStatus.value.trim() || 'بعد المعاينة',
      governate: inpManGov.value.trim() || 'الدقهلية'
    };
  }

  // Export CSV from Manual Entry
  btnExportCsvManual.addEventListener('click', () => {
    try {
      const meta = getManualMetadata();
      const parcel = GeoEngine.createParcelFromManual(meta, manualPoints);
      const csvContent = GeoEngine.generatePolygonCsvContent(parcel, parcel.vertices);

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const filename = `Polygon_${parcel.idNo || '1'}.csv`;
      saveAs(blob, filename);

      showToast(`💾 تم تصدير ملف ${filename} بنجاح!`);
    } catch (err) {
      alert('خطأ أثناء تصدير CSV: ' + err.message);
    }
  });

  // Connect Manual Parcel to Project & Google Earth
  btnConnectManual.addEventListener('click', () => {
    try {
      const meta = getManualMetadata();
      const parcel = GeoEngine.createParcelFromManual(meta, manualPoints);

      currentParcel = parcel;

      // Sync with top upload fields
      if (inpName) inpName.value = parcel.applicantName;
      if (inpNatId) inpNatId.value = parcel.nationalId;
      if (inpCenter) inpCenter.value = parcel.centerCity;
      if (inpVillage) inpVillage.value = parcel.sheikhah;

      // Save to storage
      if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ currentParcel });
      }

      displayParcel(currentParcel);
      flyEarthTabToParcel(currentParcel);

      showToast('🔗 تم ربط القطعة بالمنظومة بنجاح والتحليق في Google Earth!');
    } catch (err) {
      alert('خطأ أثناء ربط البيانات: ' + err.message);
    }
  });

  // Initial render of manual points table
  renderManualPointsTable();

  // --- 2. RESET ALL DATA ---
  if (btnResetAll) {
    btnResetAll.addEventListener('click', () => {
      if (currentParcel || capturedShots.length > 0 || (inpName && inpName.value)) {
        if (!confirm('هل تريد مسح كافة البيانات وتفريغ النموذج لبدء معاملة جديدة؟')) {
          return;
        }
      }
      resetAllData();
    });
  }

  function resetAllData() {
    currentParcel = null;
    capturedShots = [];

    if (inpName) inpName.value = '';
    if (inpNatId) inpNatId.value = '';
    if (inpCenter) inpCenter.value = '';
    if (inpVillage) inpVillage.value = '';
    if (inpInspectNotes) inpInspectNotes.value = '';
    if (fileInput) fileInput.value = '';

    if (sectionParcel) sectionParcel.style.display = 'none';
    if (sectionCapture) sectionCapture.style.display = 'none';
    if (sectionGallery) sectionGallery.style.display = 'none';
    if (sectionExport) sectionExport.style.display = 'none';
    if (galleryCount) galleryCount.textContent = '0';
    if (shotsContainer) shotsContainer.innerHTML = '';

    updateShotsLimitUI();

    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.remove(['currentParcel', 'capturedShots', 'selectedYear', 'selectedMonth']);
    }

    chrome.tabs.query({ url: '*://earth.google.com/*' }, (tabs) => {
      if (tabs && tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'CLEAR_PARCEL' }).catch(() => {});
      }
    });

    showToast('🗑️ تم تفريغ النموذج ومسح البيانات بنجاح.');
  }

  // Load existing state from storage
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['currentParcel', 'capturedShots'], (res) => {
      if (res.currentParcel) {
        currentParcel = res.currentParcel;
        displayParcel(currentParcel);
      }
      if (res.capturedShots && Array.isArray(res.capturedShots)) {
        capturedShots = res.capturedShots;
        renderShotsGallery();
      }
    });

    // Listen for storage changes from Content Script
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.capturedShots) {
        capturedShots = changes.capturedShots.newValue || [];
        renderShotsGallery();
      }
    });
  }

  // --- 3. FILE UPLOAD & DROPZONE ---
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleSurveyFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleSurveyFile(e.target.files[0]);
    }
  });

  // Handle uploaded survey file (Excel or CSV)
  function handleSurveyFile(file) {
    const reader = new FileReader();
    const isCsv = file.name.endsWith('.csv');

    reader.onload = (e) => {
      try {
        let rows = [];
        if (isCsv) {
          // Strip BOM (UTF-8 BOM \uFEFF) that may prefix CSV files
          const text = e.target.result.replace(/^\uFEFF/, '');
          const workbook = XLSX.read(text, { type: 'string' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        } else {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        }

        const parsed = GeoEngine.parseSurveyRows(rows);
        currentParcel = parsed;

        // Auto-fill manual inputs as well
        if (inpManName) inpManName.value = parsed.applicantName;
        if (inpManNatId) inpManNatId.value = parsed.nationalId;
        if (inpManIdNo) inpManIdNo.value = parsed.idNo;
        if (inpManCenter) inpManCenter.value = parsed.centerCity;
        if (inpManSheikhah) inpManSheikhah.value = parsed.sheikhah;
        if (inpManPlace) inpManPlace.value = parsed.place;

        // Populate manual points list
        manualPoints = parsed.vertices.map(v => ({
          x: v.rawX !== undefined ? String(v.rawX) : String(v.lon),
          y: v.rawY !== undefined ? String(v.rawY) : String(v.lat)
        }));
        renderManualPointsTable();

        if (chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ currentParcel });
        }

        displayParcel(currentParcel);
        flyEarthTabToParcel(currentParcel);

        showToast(`✅ تم قراءة جدول الرفع بنجاح: ${parsed.applicantName}`);
      } catch (err) {
        console.error(err);
        alert('خطأ أثناء قراءة ملف الرفع المساحي: ' + err.message);
      }
    };

    if (isCsv) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  }

  // Samples
  btnSampleGhazal.addEventListener('click', () => {
    loadBuiltinSample('GHAZAL');
  });

  btnSampleTanakh.addEventListener('click', () => {
    loadBuiltinSample('TANAKH');
  });

  function loadBuiltinSample(type) {
    let rows = [];
    if (type === 'GHAZAL') {
      // Real data matching ----_1.csv format (WGS84 POINT_X/POINT_Y with Arabic column names)
      rows = [
        ['OBJECTID', 'اسم_مقدم_الطلب', 'الرقم_القومي', 'رقم_ايصال_السداد', 'المركز', 'القرية', 'وصف_التعامل', 'وصف_الموقع', 'المساحة_م2', 'Request_no', 'SHAPE_Length', 'SHAPE_Area', 'ORIG_FID', 'POINT_X', 'POINT_Y'],
        [1, 'جمال حسنين محمد عبده غزال', '26205251201152', '1234', 'المطرية', 'المطرية', 'سكني', 'أرض فضاء بناحية المطرية', 98.79, '', 39.76, 98.79, 10579, 31.404768124111165, 31.063118376949426],
        [2, 'جمال حسنين محمد عبده غزال', '26205251201152', '1234', 'المطرية', 'المطرية', 'سكني', 'أرض فضاء بناحية المطرية', 98.79, '', 39.76, 98.79, 10579, 31.404840673594716, 31.063056464948346],
        [3, 'جمال حسنين محمد عبده غزال', '26205251201152', '1234', 'المطرية', 'المطرية', 'سكني', 'أرض فضاء بناحية المطرية', 98.79, '', 39.76, 98.79, 10579, 31.40476570248485, 31.062991730384493],
        [4, 'جمال حسنين محمد عبده غزال', '26205251201152', '1234', 'المطرية', 'المطرية', 'سكني', 'أرض فضاء بناحية المطرية', 98.79, '', 39.76, 98.79, 10579, 31.404693157136634, 31.063053646003688],
        [5, 'جمال حسنين محمد عبده غزال', '26205251201152', '1234', 'المطرية', 'المطرية', 'سكني', 'أرض فضاء بناحية المطرية', 98.79, '', 39.76, 98.79, 10579, 31.404768124111165, 31.063118376949426]
      ];
    } else {
      // Real data matching Polygon_1.csv format (WGS84 with English column names + Arabic metadata)
      rows = [
        ['OBJECTID', 'id_no', 'name', 'activity', 'governate', 'unit', 'area', 'status', 'point', 'Anational', 'Commission', 'Sheikhah', 'Center', 'place', 'SHAPE_Length', 'SHAPE_Area', 'ORIG_FID', 'POINT_X', 'POINT_Y'],
        [1, '62644774', 'يحيى عوض محمد عوض', 'سكني', 'الدقهلية', 'م2', 38.72, 'بعد المعاينة', 4, '26205251201152', 'محافظة الدقهلية', 'نوسا البحر', 'أجا', 'نوسا البحر ــ أجا', 31.51, 38.73, 1, 31.30240739358493, 30.98522733061313],
        [2, '62644774', 'يحيى عوض محمد عوض', 'سكني', 'الدقهلية', 'م2', 38.72, 'بعد المعاينة', 4, '26205251201152', 'محافظة الدقهلية', 'نوسا البحر', 'أجا', 'نوسا البحر ــ أجا', 31.51, 38.73, 1, 31.30251880616395, 30.985164670309036],
        [3, '62644774', 'يحيى عوض محمد عوض', 'سكني', 'الدقهلية', 'م2', 38.72, 'بعد المعاينة', 4, '26205251201152', 'محافظة الدقهلية', 'نوسا البحر', 'أجا', 'نوسا البحر ــ أجا', 31.51, 38.73, 1, 31.30250386378923, 30.98514084512325],
        [4, '62644774', 'يحيى عوض محمد عوض', 'سكني', 'الدقهلية', 'م2', 38.72, 'بعد المعاينة', 4, '26205251201152', 'محافظة الدقهلية', 'نوسا البحر', 'أجا', 'نوسا البحر ــ أجا', 31.51, 38.73, 1, 31.30239200693872, 30.985202518049768],
        [5, '62644774', 'يحيى عوض محمد عوض', 'سكني', 'الدقهلية', 'م2', 38.72, 'بعد المعاينة', 4, '26205251201152', 'محافظة الدقهلية', 'نوسا البحر', 'أجا', 'نوسا البحر ــ أجا', 31.51, 38.73, 1, 31.30240739358493, 30.98522733061313]
      ];
    }

    const parsed = GeoEngine.parseSurveyRows(rows);
    currentParcel = parsed;

    manualPoints = parsed.vertices.map(v => ({
      x: v.rawX !== undefined ? String(v.rawX) : String(v.lon),
      y: v.rawY !== undefined ? String(v.rawY) : String(v.lat)
    }));
    renderManualPointsTable();

    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ currentParcel });
    }

    displayParcel(currentParcel);
    flyEarthTabToParcel(currentParcel);

    showToast(`⚡ تم تحميل العينة (${type}) بنجاح!`);
  }

  // --- 4. DISPLAY PARCEL & METRICS ---
  function displayParcel(parcel) {
    if (!parcel) return;

    if (inpName) inpName.value = parcel.applicantName || '';
    if (inpNatId) inpNatId.value = parcel.nationalId || '';
    if (inpCenter) inpCenter.value = parcel.centerCity || '';
    if (inpVillage) inpVillage.value = parcel.village || '';

    metricArea.textContent = `${parcel.calculatedAreaM2.toFixed(2)} م²`;
    metricPerimeter.textContent = `${parcel.perimeterM.toFixed(2)} م`;
    metricVertices.textContent = `${parcel.vertices.length} أركان`;
    metricCrs.textContent = parcel.crs;

    sectionParcel.style.display = 'block';
    sectionCapture.style.display = 'block';
    sectionExport.style.display = 'block';

    updateShotsLimitUI();
  }

  // Sync edited metadata
  [inpName, inpNatId, inpCenter, inpVillage].forEach(inp => {
    if (!inp) return;
    inp.addEventListener('input', () => {
      if (currentParcel) {
        currentParcel.applicantName = inpName.value.trim() || currentParcel.applicantName;
        currentParcel.nationalId = inpNatId.value.trim() || currentParcel.nationalId;
        currentParcel.centerCity = inpCenter.value.trim() || currentParcel.centerCity;
        currentParcel.village = inpVillage.value.trim() || currentParcel.village;
        if (chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ currentParcel });
        }
      }
    });
  });

  // --- 5. GOOGLE EARTH TAB CONTROLS ---
  function flyEarthTabToParcel(parcel) {
    chrome.tabs.query({ url: '*://earth.google.com/*' }, (tabs) => {
      if (tabs && tabs.length > 0) {
        const earthTab = tabs[0];
        chrome.tabs.update(earthTab.id, { active: true, url: parcel.earthUrl });
        setTimeout(() => {
          chrome.tabs.sendMessage(earthTab.id, {
            action: 'LOAD_PARCEL',
            parcel: parcel
          }).catch(() => {});
        }, 1500);
      } else {
        chrome.tabs.create({ url: parcel.earthUrl }, (newTab) => {
          setTimeout(() => {
            chrome.tabs.sendMessage(newTab.id, {
              action: 'LOAD_PARCEL',
              parcel: parcel
            }).catch(() => {});
          }, 4500);
        });
      }
    });
  }

  btnFlyEarth.addEventListener('click', () => {
    if (currentParcel) flyEarthTabToParcel(currentParcel);
  });

  // --- OVERLAY MODE (POLYGON vs POINT) ---
  function setOverlayMode(mode, broadcast = true) {
    currentOverlayMode = (mode === 'point') ? 'point' : 'polygon';
    if (btnModePoly && btnModePoint) {
      if (currentOverlayMode === 'point') {
        btnModePoint.classList.add('active');
        btnModePoly.classList.remove('active');
      } else {
        btnModePoly.classList.add('active');
        btnModePoint.classList.remove('active');
      }
    }
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ overlayMode: currentOverlayMode });
    }
    if (broadcast) {
      chrome.tabs.query({ url: '*://earth.google.com/*' }, (tabs) => {
        if (tabs && tabs.length > 0) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'SET_OVERLAY_MODE',
            mode: currentOverlayMode
          }).catch(() => {});
        }
      });
      showToast(currentOverlayMode === 'point' ? '📍 تم تفعيل نمط نقطة المركز والاسم' : '🟦 تم تفعيل نمط المضلع الكامل');
    }
  }

  if (btnModePoly) {
    btnModePoly.addEventListener('click', () => setOverlayMode('polygon'));
  }
  if (btnModePoint) {
    btnModePoint.addEventListener('click', () => setOverlayMode('point'));
  }

  // Load saved overlay mode on startup
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['overlayMode'], (res) => {
      if (res && res.overlayMode) {
        setOverlayMode(res.overlayMode, false);
      }
    });
  }

  btnCenterCamera.addEventListener('click', () => {
    if (!currentParcel) return;
    chrome.tabs.query({ url: '*://earth.google.com/*' }, (tabs) => {
      if (tabs && tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'CENTER_CAMERA',
          parcel: currentParcel
        }).catch(() => {});
        showToast('🎯 تم إعادة توجيه الكاميرا فوق القطعة.');
      }
    });
  });

  let isPolyVisible = true;

  function handleToggleResult(res) {
    if (res && typeof res.visible === 'boolean') {
      isPolyVisible = res.visible;
    } else {
      isPolyVisible = !isPolyVisible;
    }
    btnTogglePoly.innerHTML = isPolyVisible
      ? '<span>👁️ إخفاء المضلع</span>'
      : '<span>🙈 إظهار المضلع</span>';
    showToast(isPolyVisible ? '👁️ تم إظهار حدود المضلع على الخريطة' : '🙈 تم إخفاء حدود المضلع من الخريطة');
  }

  btnTogglePoly.addEventListener('click', () => {
    chrome.tabs.query({ url: '*://earth.google.com/*' }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        showToast('⚠️ تبويب Google Earth غير مفتوح حالياً');
        return;
      }
      const targetTab = tabs[0];
      chrome.tabs.sendMessage(targetTab.id, { action: 'TOGGLE_POLY' }, (res) => {
        if (chrome.runtime.lastError) {
          // If content script was not injected yet, inject and retry
          chrome.runtime.sendMessage({ action: 'ENSURE_INJECTED', tabId: targetTab.id }, () => {
            setTimeout(() => {
              chrome.tabs.sendMessage(targetTab.id, { action: 'TOGGLE_POLY' }, (retryRes) => {
                handleToggleResult(retryRes);
              });
            }, 350);
          });
          return;
        }
        handleToggleResult(res);
      });
    });
  });

  btnExportKml.addEventListener('click', () => {
    if (!currentParcel) return;
    const kmlStr = GeoEngine.generateKml(currentParcel);
    const blob = new Blob([kmlStr], { type: 'application/vnd.google-earth.kml+xml' });
    const filename = `موقع_${currentParcel.applicantName || 'القطعة'}.kml`;
    saveAs(blob, filename);
    showToast(`💾 تم تنزيل ملف ${filename}`);
  });

  // --- 6. SHOT CAPTURE & LIMITS (WITH MONTH) ---
  function updateShotsLimitUI() {
    const count = capturedShots.length;
    if (galleryCount) galleryCount.textContent = count;
    if (shotsLimitBadge) {
      shotsLimitBadge.textContent = `اللقطات الموثقة: ${count} من 6 (الحد الأقصى)`;
      if (count >= 6) {
        shotsLimitBadge.classList.add('limit-reached');
        btnCaptureShot.disabled = true;
        btnCaptureShot.innerHTML = '<span>⚠️ تم الوصول للحد الأقصى (6 صور مسموحة)</span>';
      } else {
        shotsLimitBadge.classList.remove('limit-reached');
        btnCaptureShot.disabled = false;
        btnCaptureShot.innerHTML = '<span>📸 التقاط لقطة القمر الصناعي الآن وتوثيقها</span>';
      }
    }
  }

  // Sync capture year and month
  selectCaptureYear.addEventListener('change', () => {
    chrome.storage.local.set({ selectedYear: selectCaptureYear.value });
  });

  selectCaptureMonth.addEventListener('change', () => {
    chrome.storage.local.set({ selectedMonth: selectCaptureMonth.value });
  });

  if (selectInspectStatus) {
    selectInspectStatus.addEventListener('change', () => {
      if (selectInspectStatus.value === '__custom__') {
        if (groupCustomStatus) groupCustomStatus.style.display = 'flex';
        if (inpInspectStatusCustom) inpInspectStatusCustom.focus();
      } else {
        if (groupCustomStatus) groupCustomStatus.style.display = 'none';
      }
    });
  }

  btnCaptureShot.addEventListener('click', () => {
    if (!currentParcel) {
      alert('يرجى تحميل أو إدخال بيانات الرفع المساحي أولاً.');
      return;
    }

    if (capturedShots.length >= 6) {
      alert('⚠️ الحد الأقصى للشهادة الرسمية هو 6 صور فقط وفقاً لنماذج وحدة المتغيرات المكانية.');
      return;
    }

    const year = selectCaptureYear.value;
    const month = selectCaptureMonth.value;

    let status = selectInspectStatus.value;
    if (status === '__custom__') {
      status = (inpInspectStatusCustom && inpInspectStatusCustom.value.trim()) ? inpInspectStatusCustom.value.trim() : 'معاينة الموقع';
    }
    const notes = inpInspectNotes.value.trim();
    const finalStatus = notes ? `${status} (${notes})` : status;

    chrome.storage.local.set({ selectedYear: year, selectedMonth: month });

    btnCaptureShot.disabled = true;
    btnCaptureShot.innerHTML = '<span>⏳ جارٍ التقاط الصورة بدقة كاملة...</span>';

    chrome.tabs.query({ url: '*://earth.google.com/*' }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        btnCaptureShot.disabled = false;
        btnCaptureShot.innerHTML = '<span>📸 التقاط لقطة القمر الصناعي الآن وتوثيقها</span>';
        alert('تبويب Google Earth Web غير مفتوح! اضغط على "فتح والانتقال في Google Earth".');
        return;
      }

      const earthTab = tabs[0];
      const winId = earthTab.windowId;

      const triggerCapture = () => {
        chrome.tabs.update(earthTab.id, { active: true }, () => {
          // 1. Ensure content script is injected and request map bounds (which hides UI toolbars)
          chrome.runtime.sendMessage({ action: 'ENSURE_INJECTED', tabId: earthTab.id }, () => {
            chrome.tabs.sendMessage(earthTab.id, { action: 'GET_MAP_BOUNDS' }, (bounds) => {
              const safeBounds = (!chrome.runtime.lastError && bounds) ? bounds : null;

              // Wait 250ms for Google Earth to focus, hide toolbars, and render pristine map
              setTimeout(() => {
                const doCapture = (cb) => {
                  // Method 1: Try direct capture from sidepanel if available
                  if (chrome.tabs && chrome.tabs.captureVisibleTab) {
                    chrome.tabs.captureVisibleTab(winId, { format: 'png' }, (dataUrl) => {
                      const err = chrome.runtime.lastError;
                      if (!err && dataUrl) {
                        cb({ success: true, dataUrl: dataUrl });
                      } else {
                        // Method 2: Fallback to background service worker
                        chrome.runtime.sendMessage({
                          action: 'CAPTURE_TAB',
                          windowId: winId,
                          tabId: earthTab.id
                        }, cb);
                      }
                    });
                  } else {
                    chrome.runtime.sendMessage({
                      action: 'CAPTURE_TAB',
                      windowId: winId,
                      tabId: earthTab.id
                    }, cb);
                  }
                };

                doCapture((response) => {
                  if (!response || !response.success || !response.dataUrl) {
                    btnCaptureShot.disabled = false;
                    btnCaptureShot.innerHTML = '<span>📸 التقاط لقطة القمر الصناعي الآن وتوثيقها</span>';
                    updateShotsLimitUI();
                    const rawErr = response && response.error ? String(response.error) : '';
                    alert(
                      'تعذر التقاط شاشة Google Earth:\n' +
                      (rawErr ? rawErr + '\n\n' : '') +
                      '💡 نصيحة سريعة:\n' +
                      '1. تأكد من أن تبويب Google Earth مفتوح ومرئي.\n' +
                      '2. يمكنك أيضاً الضغط داخل خريطة Google Earth ثم استخدام الاختصار: Ctrl + Shift + S\n' +
                      '3. أو كليك يمين على الخريطة واختيار "📸 التقاط خريطة Google Earth وتوثيقها".'
                    );
                    return;
                  }

                  // 2. Crop the image to bounds (removes headers, timeline, controls, side drawer)
                  cropImageToMap(response.dataUrl, safeBounds, (croppedUrl) => {
                    btnCaptureShot.disabled = false;
                    btnCaptureShot.innerHTML = '<span>📸 التقاط لقطة القمر الصناعي الآن وتوثيقها</span>';
                    updateShotsLimitUI();

                    const dateStr = month ? `${year}/${month}` : `${year}`;
                    const existingIdx = capturedShots.findIndex(s => String(s.year) === String(year) && String(s.month || '') === String(month || ''));

                    const shotRecord = {
                      id: Date.now(),
                      year: year,
                      month: month,
                      captureDate: dateStr,
                      status: finalStatus,
                      notes: notes,
                      imageData: croppedUrl
                    };

                    if (existingIdx !== -1) {
                      capturedShots[existingIdx] = shotRecord;
                    } else {
                      capturedShots.push(shotRecord);
                    }

                    // Sort chronologically
                    capturedShots.sort((a, b) => {
                      const yrA = parseInt(a.year) || 0;
                      const yrB = parseInt(b.year) || 0;
                      if (yrA !== yrB) return yrA - yrB;
                      return (parseInt(a.month) || 0) - (parseInt(b.month) || 0);
                    });

                    chrome.storage.local.set({ capturedShots: capturedShots });
                    renderShotsGallery();
                    showToast(`✅ تم توثيق لقطة مقتطعة بدقة في ${dateStr} بنجاح!`);
                  });
                });
              }, 250);
            });
          });
        });
      };

    if (chrome.windows && chrome.windows.update && winId) {
      chrome.windows.update(winId, { focused: true }, () => {
        triggerCapture();
      });
    } else {
      triggerCapture();
    }
  });
});

  // Helper: Crop captured screenshot to satellite map bounds
  function cropImageToMap(dataUrl, bounds, callback) {
    const img = new Image();
    img.onload = () => {
      const rawW = img.naturalWidth;
      const rawH = img.naturalHeight;
      const dpr = (bounds && bounds.dpr) ? bounds.dpr : (window.devicePixelRatio || 1);

      let cropX = 0;
      let cropY = 0;
      let cropW = rawW;
      let cropH = rawH;

      if (bounds && bounds.width > 100 && bounds.height > 100) {
        cropX = Math.round(bounds.x * dpr);
        cropY = Math.round(bounds.y * dpr);
        cropW = Math.round(bounds.width * dpr);
        cropH = Math.round(bounds.height * dpr);
      } else {
        // Safe symmetric fallback if bounds could not be computed:
        // Top 140px removes Google Earth top header, search bar, and historical imagery slider
        // Bottom 140px removes navigation controls (compass, 3D, streetview, zoom) and status bar
        const cropMargin = Math.round(140 * dpr);
        cropX = 0;
        cropY = cropMargin;
        cropW = rawW;
        cropH = Math.max(10, rawH - (cropMargin * 2));
      }

      // Safe clamping
      if (cropX < 0) cropX = 0;
      if (cropY < 0) cropY = 0;
      if (cropX + cropW > rawW) cropW = rawW - cropX;
      if (cropY + cropH > rawH) cropH = rawH - cropY;

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(cropW, 10);
      canvas.height = Math.max(cropH, 10);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

      const croppedUrl = canvas.toDataURL('image/jpeg', 0.95);
      callback(croppedUrl);
    };
    img.onerror = () => {
      callback(dataUrl);
    };
    img.src = dataUrl;
  }

  // --- 7. SHOTS GALLERY RENDERING ---
  function renderShotsGallery() {
    if (!shotsContainer) return;
    shotsContainer.innerHTML = '';
    updateShotsLimitUI();

    if (capturedShots.length === 0) {
      sectionGallery.style.display = 'none';
      return;
    }

    sectionGallery.style.display = 'block';

    capturedShots.forEach((shot) => {
      const card = document.createElement('div');
      card.className = 'shot-card';
      const dateLabel = shot.month ? `${shot.year}/${shot.month}` : `${shot.year}`;

      card.innerHTML = `
        <div class="shot-card-header">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="shot-year-badge">${dateLabel}</span>
            <span class="shot-date">📅 ${shot.captureDate}</span>
          </div>
          <button class="btn-delete-shot" title="حذف هذه اللقطة" data-id="${shot.id}" type="button">🗑️</button>
        </div>
        <div class="shot-card-body">
          <img src="${shot.imageData}" alt="Shot ${dateLabel}" class="shot-img-thumb">
          ${shot.status ? `<div><span class="shot-status-tag">🏗️ ${shot.status}</span></div>` : ''}
          ${shot.notes ? `<div class="shot-notes-text">📝 ${shot.notes}</div>` : ''}
        </div>
      `;

      card.querySelector('.btn-delete-shot').addEventListener('click', (e) => {
        const id = parseInt(e.currentTarget.getAttribute('data-id'));
        capturedShots = capturedShots.filter(s => s.id !== id);
        chrome.storage.local.set({ capturedShots: capturedShots });
        renderShotsGallery();
        showToast('🗑️ تم حذف اللقطة.');
      });

      shotsContainer.appendChild(card);
    });
  }

  // --- 8. PREVIEW & PRINT (PDF) PAGE ---
  if (btnPreviewPdf) {
    btnPreviewPdf.addEventListener('click', () => {
      if (!currentParcel) {
        alert('يرجى تحميل أو إدخال بيانات الرفع المساحي أولاً.');
        return;
      }

      if (capturedShots.length < 2) {
        alert('⚠️ النماذج الرسمية لبيان التسلسل الزمني تتطلب توثيق صورتين على الأقل (تدعم من 2 إلى 6 صور). يرجى التقاط صورتين لسنتين مختلفتين أولاً.');
        return;
      }

      const committee = {
        surveyor: inpSurveyor.value.trim() || 'مسؤول المتغيرات المكانية',
        reviewer: inpReviewer.value.trim() || 'د / عماد عبدالله احمد',
        director: inpDirector.value.trim() || 'مروة محمد رضوان'
      };

      // Save preview payload in storage
      chrome.storage.local.set({
        previewData: {
          parcel: currentParcel,
          shots: capturedShots,
          committee: committee
        }
      }, () => {
        // Open preview page in a dedicated full tab
        chrome.tabs.create({ url: chrome.runtime.getURL('preview/preview.html') });
        showToast('📄 تم فتح صفحة المعاينة والطباعة الرسمية.');
      });
    });
  }

  // --- 9. OFFICIAL DOCX & CSV BUNDLE EXPORT ---
  btnGenerateDocx.addEventListener('click', async () => {
    if (!currentParcel) {
      alert('يرجى تحميل أو إدخال بيانات الرفع المساحي أولاً.');
      return;
    }

    if (capturedShots.length < 2) {
      alert('⚠️ النماذج الرسمية لبيان التسلسل الزمني تتطلب توثيق صورتين على الأقل (القوالب تدعم من 2 إلى 6 صور). يرجى التقاط صورتين لسنتين مختلفتين أولاً.');
      return;
    }

    btnGenerateDocx.disabled = true;
    btnGenerateDocx.innerHTML = '<span>⏳ جارٍ إنشاء وتنسيق بيان التسلسل الزمني الرسمي...</span>';

    try {
      const committee = {
        surveyor: inpSurveyor.value.trim() || 'مسؤول المتغيرات المكانية',
        reviewer: inpReviewer.value.trim() || 'د / عماد عبدالله احمد',
        director: inpDirector.value.trim() || 'مروة محمد رضوان'
      };

      // 1. Generate DOCX Blob matching official template
      const docxBlob = await DocxBuilder.generateDocxReport(currentParcel, capturedShots, committee);

      // 2. Generate Polygon CSV Content
      const csvContent = GeoEngine.generatePolygonCsvContent(currentParcel, currentParcel.vertices);

      // 3. Prepare Folder and File Names
      const citizenSafe = (currentParcel.applicantName || 'المواطن').replace(/[\\/:*?"<>|]/g, '_');
      const idNoSafe = (currentParcel.idNo || '62644774').replace(/[\\/:*?"<>|]/g, '_');
      const folderName = `${citizenSafe} - ${idNoSafe}`;
      const docFilename = `بيان_تسلسل_زمني_${citizenSafe}.docx`;
      const csvFilename = `Polygon_${idNoSafe}.csv`;

      // 4. Download into folder via Chrome Downloads API if available
      if (chrome.downloads && chrome.downloads.download) {
        const docUrl = URL.createObjectURL(docxBlob);
        chrome.downloads.download({
          url: docUrl,
          filename: `${folderName}/${docFilename}`,
          saveAs: false
        });

        const csvBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const csvUrl = URL.createObjectURL(csvBlob);
        chrome.downloads.download({
          url: csvUrl,
          filename: `${folderName}/${csvFilename}`,
          saveAs: false
        });
      } else {
        // Fallback for browsers
        saveAs(docxBlob, docFilename);
        const csvBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        saveAs(csvBlob, csvFilename);
      }

      showToast(`📄 تم إصدار البيان وملف الرفع في مجلد: ${folderName}`);
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء إصدار الشهادة: ' + err.message);
    } finally {
      btnGenerateDocx.disabled = false;
      btnGenerateDocx.innerHTML = '<span>📄 إصدار بيان التسلسل الزمني وتنزيل المجلد (.docx + .csv)</span>';
    }
  });

  // Toast Helper
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3500);
  }
});
