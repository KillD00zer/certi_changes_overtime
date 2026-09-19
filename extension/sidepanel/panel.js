/**
 * SidePanel Controller for Google Earth Survey Extension
 * Manages survey file ingestion, parcel metrics, camera navigation,
 * timeline shots capture, and official Word (.docx) export.
 */

document.addEventListener('DOMContentLoaded', () => {
  let currentParcel = null;
  let capturedShots = [];

  // DOM Elements
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const btnSampleGhazal = document.getElementById('btn-sample-ghazal');
  const btnSampleTanakh = document.getElementById('btn-sample-tanakh');

  const inpName = document.getElementById('inp-name');
  const inpNatId = document.getElementById('inp-natid');
  const inpCenter = document.getElementById('inp-center');
  const inpVillage = document.getElementById('inp-village');

  const sectionParcel = document.getElementById('section-parcel');
  const metricArea = document.getElementById('metric-area');
  const metricPerimeter = document.getElementById('metric-perimeter');
  const metricVertices = document.getElementById('metric-vertices');
  const metricCrs = document.getElementById('metric-crs');

  const btnFlyEarth = document.getElementById('btn-fly-earth');
  const btnCenterCamera = document.getElementById('btn-center-camera');
  const btnTogglePoly = document.getElementById('btn-toggle-poly');
  const btnExportKml = document.getElementById('btn-export-kml');

  const sectionCapture = document.getElementById('section-capture');
  const selectCaptureYear = document.getElementById('select-capture-year');
  const selectInspectStatus = document.getElementById('select-inspect-status');
  const inpInspectNotes = document.getElementById('inp-inspect-notes');
  const btnCaptureShot = document.getElementById('btn-capture-shot');

  const sectionGallery = document.getElementById('section-gallery');
  const galleryCount = document.getElementById('gallery-count');
  const shotsContainer = document.getElementById('shots-container');

  const sectionExport = document.getElementById('section-export');
  const inpSurveyor = document.getElementById('inp-surveyor');
  const inpReviewer = document.getElementById('inp-reviewer');
  const inpDirector = document.getElementById('inp-director');
  const btnGenerateDocx = document.getElementById('btn-generate-docx');
  const btnResetAll = document.getElementById('btn-reset-all');

  const toast = document.getElementById('toast');

  // --- 0. RESET ALL DATA ---
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

    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.remove(['currentParcel', 'capturedShots', 'selectedYear']);
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
        renderParcelUI();
      }
      if (res.capturedShots && Array.isArray(res.capturedShots)) {
        capturedShots = res.capturedShots;
        renderShotsGallery();
      }
    });

    // Listen for storage changes from Content Script (e.g. quick captures)
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.capturedShots) {
        capturedShots = changes.capturedShots.newValue || [];
        renderShotsGallery();
      }
    });
  }

  // --- 1. FILE UPLOAD & DROPZONE ---
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
      handleFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  });

  function handleFile(file) {
    const name = file.name.toLowerCase();
    showToast(`⏳ جارٍ قراءة وتحليل ملف: ${file.name}...`);

    if (name.endsWith('.csv')) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const text = evt.target.result;
          const rows = parseCsvText(text);
          processSurveyRows(rows);
        } catch (err) {
          alert('خطأ في قراءة ملف CSV: ' + err.message);
        }
      };
      reader.readAsText(file, 'utf-8');
    } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = new Uint8Array(evt.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[firstSheetName];
          const rows = XLSX.utils.sheet_to_json(sheet);
          processSurveyRows(rows);
        } catch (err) {
          alert('خطأ في قراءة ملف Excel: ' + err.message);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      alert('صيغة الملف غير مدعومة. يرجى اختيار ملف .csv أو .xlsx أو .xls');
    }
  }

  function parseCsvText(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) throw new Error('الملف فارغ أو يحتوي على صف واحد فقط.');

    // Split headers
    const delimiter = lines[0].includes(';') ? ';' : (lines[0].includes('\t') ? '\t' : ',');
    const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ''));

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(delimiter);
      if (parts.length >= 2) {
        const row = {};
        headers.forEach((h, idx) => {
          row[h] = parts[idx] ? parts[idx].trim().replace(/^["']|["']$/g, '') : '';
        });
        rows.push(row);
      }
    }
    return rows;
  }

  function processSurveyRows(rows) {
    try {
      const parcel = GeoEngine.parseSurveyRows(rows);
      currentParcel = parcel;

      // Persist in local storage
      chrome.storage.local.set({ currentParcel: currentParcel });

      // Notify Content Script on Google Earth Tab
      syncParcelToEarthTab(currentParcel);

      // Automatically fly Google Earth camera directly over the parcel if tab is open
      flyEarthTabToParcel(currentParcel);

      renderParcelUI();
      showToast('✅ تم استيراد وتحليل جدول الرفع المساحي وتوجيه الكاميرا للموقع!');
    } catch (e) {
      alert('خطأ في معالجة البيانات المساحية: ' + e.message);
    }
  }

  function flyEarthTabToParcel(parcel) {
    if (!parcel || !parcel.earthUrl) return;
    chrome.tabs.query({ url: '*://earth.google.com/*' }, (tabs) => {
      if (tabs && tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'NAVIGATE_TO_PARCEL',
          url: parcel.earthUrl
        }).catch(() => {
          chrome.tabs.update(tabs[0].id, { url: parcel.earthUrl });
        });
      }
    });
  }

  // --- 2. SAMPLE BUTTONS ---
  btnSampleGhazal.addEventListener('click', () => {
    const sampleRows = [
      { OBJECTID: '1', POINT_X: '31.92628856', POINT_Y: '31.16198617', اسم_مقدم_الطلب: 'جمال حسنين محمد عبده غزال', الرقم_القومي: '27503121200345', المركز: 'المطرية', القرية: 'العصافرة', المساحة_م2: '124.79' },
      { OBJECTID: '2', POINT_X: '31.92641854', POINT_Y: '31.16198220', اسم_مقدم_الطلب: 'جمال حسنين محمد عبده غزال', الرقم_القومي: '27503121200345', المركز: 'المطرية', القرية: 'العصافرة', المساحة_م2: '124.79' },
      { OBJECTID: '3', POINT_X: '31.92641420', POINT_Y: '31.16189151', اسم_مقدم_الطلب: 'جمال حسنين محمد عبده غزال', الرقم_القومي: '27503121200345', المركز: 'المطرية', القرية: 'العصافرة', المساحة_م2: '124.79' },
      { OBJECTID: '4', POINT_X: '31.92628419', POINT_Y: '31.16189549', اسم_مقدم_الطلب: 'جمال حسنين محمد عبده غزال', الرقم_القومي: '27503121200345', المركز: 'المطرية', القرية: 'العصافرة', المساحة_م2: '124.79' },
      { OBJECTID: '5', POINT_X: '31.92628856', POINT_Y: '31.16198617', اسم_مقدم_الطلب: 'جمال حسنين محمد عبده غزال', الرقم_القومي: '27503121200345', المركز: 'المطرية', القرية: 'العصافرة', المساحة_م2: '124.79' }
    ];
    processSurveyRows(sampleRows);
  });

  btnSampleTanakh.addEventListener('click', () => {
    const sampleRows = [
      { OBJECTID: '1', POINT_X: '362450.12', POINT_Y: '915230.45', اسم_مقدم_الطلب: 'محمود عبد الرحمن السيد حسن', الرقم_القومي: '28005141201589', المركز: 'المنصورة', القرية: 'طناح', المساحة_م2: '185.50' },
      { OBJECTID: '2', POINT_X: '362465.80', POINT_Y: '915228.10', اسم_مقدم_الطلب: 'محمود عبد الرحمن السيد حسن', الرقم_القومي: '28005141201589', المركز: 'المنصورة', القرية: 'طناح', المساحة_م2: '185.50' },
      { OBJECTID: '3', POINT_X: '362462.40', POINT_Y: '915212.75', اسم_مقدم_الطلب: 'محمود عبد الرحمن السيد حسن', الرقم_القومي: '28005141201589', المركز: 'المنصورة', القرية: 'طناح', المساحة_م2: '185.50' },
      { OBJECTID: '4', POINT_X: '362446.90', POINT_Y: '915215.20', اسم_مقدم_الطلب: 'محمود عبد الرحمن السيد حسن', الرقم_القومي: '28005141201589', المركز: 'المنصورة', القرية: 'طناح', المساحة_م2: '185.50' },
      { OBJECTID: '5', POINT_X: '362450.12', POINT_Y: '915230.45', اسم_مقدم_الطلب: 'محمود عبد الرحمن السيد حسن', الرقم_القومي: '28005141201589', المركز: 'المنصورة', القرية: 'طناح', المساحة_م2: '185.50' }
    ];
    processSurveyRows(sampleRows);
  });

  // Metadata input listeners
  [inpName, inpNatId, inpCenter, inpVillage].forEach(inp => {
    inp.addEventListener('input', () => {
      if (currentParcel) {
        currentParcel.applicantName = inpName.value;
        currentParcel.nationalId = inpNatId.value;
        currentParcel.centerCity = inpCenter.value;
        currentParcel.village = inpVillage.value;
        chrome.storage.local.set({ currentParcel: currentParcel });
        syncParcelToEarthTab(currentParcel);
      }
    });
  });

  // --- 3. UI RENDERING ---
  function renderParcelUI() {
    if (!currentParcel) return;

    // Fill metadata inputs
    inpName.value = currentParcel.applicantName || '';
    inpNatId.value = currentParcel.nationalId || '';
    inpCenter.value = currentParcel.centerCity || '';
    inpVillage.value = currentParcel.village || '';

    // Metrics
    metricArea.textContent = `${currentParcel.calculatedAreaM2.toFixed(2)} م²`;
    metricPerimeter.textContent = `${currentParcel.perimeterM.toFixed(1)} م`;
    metricVertices.textContent = currentParcel.vertices ? currentParcel.vertices.length : '0';
    metricCrs.textContent = currentParcel.crs || 'WGS84';

    // Show sections
    sectionParcel.style.display = 'block';
    sectionCapture.style.display = 'block';
    sectionGallery.style.display = 'block';
    sectionExport.style.display = 'block';
  }

  // --- 4. GOOGLE EARTH TAB NAVIGATION ---
  // --- 4. GOOGLE EARTH TAB NAVIGATION & CONTROLS ---
  btnFlyEarth.addEventListener('click', () => {
    if (!currentParcel || !currentParcel.earthUrl) return;

    showToast('🚀 جارٍ فتح وتوجيه Google Earth فوق القطعة...');
    chrome.runtime.sendMessage({
      action: 'OPEN_EARTH_TAB',
      url: currentParcel.earthUrl
    }, (res) => {
      if (res && res.success && res.tabId) {
        // Automatically ensure script is injected without manual reload
        chrome.runtime.sendMessage({ action: 'ENSURE_INJECTED', tabId: res.tabId }, () => {
          setTimeout(() => syncParcelToEarthTab(currentParcel), 1200);
        });
      }
    });
  });

  btnCenterCamera.addEventListener('click', () => {
    chrome.tabs.query({ url: '*://earth.google.com/*' }, (tabs) => {
      if (tabs && tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'CENTER_CAMERA' }).catch(() => {
          if (currentParcel && currentParcel.earthUrl) {
            chrome.tabs.update(tabs[0].id, { url: currentParcel.earthUrl });
          }
        });
        showToast('🎯 تم توسيط الكاميرا فوق القطعة.');
      } else {
        alert('تبويب Google Earth غير مفتوح.');
      }
    });
  });

  btnTogglePoly.addEventListener('click', () => {
    chrome.tabs.query({ url: '*://earth.google.com/*' }, (tabs) => {
      if (tabs && tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'TOGGLE_POLYGON' }, (res) => {
          if (res && res.visible !== undefined) {
            showToast(res.visible ? '👁️ تم إظهار مضلع القطعة' : '🙈 تم إخفاء مضلع القطعة');
          }
        });
      } else {
        alert('تبويب Google Earth غير مفتوح.');
      }
    });
  });

  btnExportKml.addEventListener('click', () => {
    if (!currentParcel) return;
    const kmlStr = GeoEngine.generateKml(currentParcel);
    const blob = new Blob([kmlStr], { type: 'application/vnd.google-earth.kml+xml;charset=utf-8' });
    const filename = `موقع_${currentParcel.applicantName || 'القطعة'}.kml`;
    saveAs(blob, filename);
    showToast(`✅ تم تصدير ملف KML: ${filename}`);
  });

  function syncParcelToEarthTab(parcel) {
    chrome.tabs.query({ url: '*://earth.google.com/*' }, (tabs) => {
      if (tabs && tabs.length > 0) {
        const tabId = tabs[0].id;
        // Ensure script is injected first
        chrome.runtime.sendMessage({ action: 'ENSURE_INJECTED', tabId: tabId }, () => {
          chrome.tabs.sendMessage(tabId, {
            action: 'UPDATE_PARCEL',
            parcel: parcel
          }).catch(() => {});
        });
      }
    });
  }

  function cropToMapArea(dataUrl, bounds, callback) {
    const img = new Image();
    img.onload = () => {
      const dpr = (bounds && bounds.dpr) || window.devicePixelRatio || 1;
      const rawW = img.naturalWidth;
      const rawH = img.naturalHeight;

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
        // Safe symmetric fallback: remove top 140px and bottom 140px
        const cropMargin = Math.round(140 * dpr);
        cropX = 0;
        cropY = cropMargin;
        cropW = rawW;
        cropH = Math.max(10, rawH - (cropMargin * 2));
      }

      // Boundary clamp
      if (cropX < 0) cropX = 0;
      if (cropY < 0) cropY = 0;
      if (cropX + cropW > rawW) cropW = rawW - cropX;
      if (cropY + cropH > rawH) cropH = rawH - cropY;

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(cropW, 10);
      canvas.height = Math.max(cropH, 10);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

      const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.95);
      callback(croppedDataUrl);
    };
    img.onerror = () => {
      callback(dataUrl);
    };
    img.src = dataUrl;
  }

  // Sync capture year to storage
  selectCaptureYear.addEventListener('change', () => {
    chrome.storage.local.set({ selectedYear: selectCaptureYear.value });
  });

  // --- 5. TIMELINE CAPTURE ---
  btnCaptureShot.addEventListener('click', async () => {
    const year = selectCaptureYear.value;
    const status = selectInspectStatus.value;
    const notes = inpInspectNotes.value.trim() || 'تمت المطابقة والتدقيق عبر الأقمار الصناعية التاريخية.';

    // Store selectedYear so any shortcut captures use this year
    chrome.storage.local.set({ selectedYear: year });

    btnCaptureShot.disabled = true;
    btnCaptureShot.innerHTML = '<span>⏳ جارٍ التقاط الخريطة...</span>';

    // Find Google Earth tab
    chrome.tabs.query({ url: '*://earth.google.com/*' }, async (earthTabs) => {
      const targetTab = (earthTabs && earthTabs.length > 0) ? earthTabs[0] : null;
      if (!targetTab) {
        btnCaptureShot.disabled = false;
        btnCaptureShot.innerHTML = '<span>📸 التقاط لقطة القمر الصناعي الآن وتوثيقها</span>';
        alert('يرجى فتح تبويب Google Earth أولاً بالضغط على زر "فتح والانتقال في Google Earth".');
        return;
      }

      // Activate target tab
      try {
        await chrome.tabs.update(targetTab.id, { active: true });
      } catch (e) {}

      // Prompt for origin permission if needed
      if (chrome.permissions && chrome.permissions.request) {
        try {
          await chrome.permissions.request({ origins: ['https://earth.google.com/*'] });
        } catch (e) {}
      }

      const fetchBounds = new Promise((resolve) => {
        chrome.tabs.sendMessage(targetTab.id, { action: 'GET_MAP_BOUNDS' }, (bounds) => {
          if (chrome.runtime.lastError || !bounds) {
            resolve(null);
          } else {
            resolve(bounds);
          }
        });
      });

      fetchBounds.then((bounds) => {
        chrome.runtime.sendMessage({
          action: 'CAPTURE_VISIBLE_TAB',
          windowId: targetTab.windowId
        }, (res) => {
          btnCaptureShot.disabled = false;
          btnCaptureShot.innerHTML = '<span>📸 التقاط لقطة القمر الصناعي الآن وتوثيقها</span>';

          if (res && res.success && res.dataUrl) {
            cropToMapArea(res.dataUrl, bounds, (croppedDataUrl) => {
              const now = new Date();
              const dateStr = now.toISOString().split('T')[0];

              const existingIdx = capturedShots.findIndex(s => String(s.year) === String(year));
              const newShot = {
                id: Date.now(),
                year: year,
                captureDate: dateStr,
                imageData: croppedDataUrl,
                status: status,
                notes: notes
              };

              if (existingIdx >= 0) {
                capturedShots[existingIdx] = newShot;
              } else {
                capturedShots.push(newShot);
              }

              capturedShots.sort((a, b) => parseInt(a.year) - parseInt(b.year));

              chrome.storage.local.set({ capturedShots: capturedShots });
              renderShotsGallery();
              showToast(`✅ تم التقاط خريطة سنة ${year} بنجاح!`);
            });
          } else {
            const rawErr = (res && res.error) ? res.error : '';
            if (rawErr.includes('activeTab') || rawErr.includes('all_urls')) {
              alert(
                '⚠️ تنبيه أمان المتصفح (Chrome/Edge):\n\n' +
                '⚡ للالتقاط المباشر بدون إعدادات:\n' +
                '1. انقر بزر الفأرة الأيمن على خريطة Google Earth واختر: "📸 التقاط خريطة Google Earth وتوثيقها"\n' +
                '2. أو اضغط فوق الخريطة ثم استخدم الاختصار: Ctrl + Shift + S\n\n' +
                '💡 ولتفعيل زر اللوحة الجانبية مباشرة:\n' +
                'انقر كليك يمين على أيقونة الإضافة في شريط المتصفح العلوي -> "يمكن لهذا الامتداد قراءة وتغيير بيانات الموقع" -> "على جميع المواقع".'
              );
            } else {
              alert('تعذر التقاط شاشة Google Earth: ' + (rawErr || 'يرجى التأكد من أن تبويب Google Earth نشط.'));
            }
          }
        });
      });
    });
  });

  function renderShotsGallery() {
    galleryCount.textContent = capturedShots.length;
    shotsContainer.innerHTML = '';

    if (capturedShots.length === 0) {
      shotsContainer.innerHTML = `
        <div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 11.5px;">
          لا توجد لقطات محفوظة حتى الآن.<br>
          انتقل لتبويب Google Earth واضغط زر "التقاط" لتوثيق كل سنة.
        </div>
      `;
      return;
    }

    capturedShots.forEach((shot) => {
      const card = document.createElement('div');
      card.className = 'shot-card';
      card.innerHTML = `
        <div class="shot-card-header">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="shot-year-badge">${shot.year}</span>
            <span class="shot-date">📅 ${shot.captureDate}</span>
          </div>
          <button class="btn-delete-shot" title="حذف هذه اللقطة" data-id="${shot.id}">🗑️</button>
        </div>
        <div class="shot-card-body">
          <img src="${shot.imageData}" alt="Shot ${shot.year}" class="shot-img-thumb">
          ${shot.status ? `<div><span class="shot-status-tag">🏗️ ${shot.status}</span></div>` : ''}
          <div class="shot-notes-text">📝 ${shot.notes}</div>
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

  // --- 6. OFFICIAL DOCX GENERATION ---
  btnGenerateDocx.addEventListener('click', async () => {
    if (!currentParcel) {
      alert('يرجى تحميل بيانات الرفع المساحي أولاً.');
      return;
    }

    btnGenerateDocx.disabled = true;
    btnGenerateDocx.innerHTML = '<span>⏳ جارٍ بناء وتنسيق تقرير Word الرسمي...</span>';

    try {
      const committee = {
        surveyor: inpSurveyor.value.trim() || 'م / فني الرفع المساحي',
        reviewer: inpReviewer.value.trim() || 'م / مراجع المتغيرات المكانية',
        director: inpDirector.value.trim() || 'م / مدير عام المركز'
      };

      const blob = await DocxBuilder.generateDocxReport(currentParcel, capturedShots, committee);
      const filename = `تقرير_تغيرات_مكانية_${currentParcel.applicantName || 'المواطن'}.docx`;

      saveAs(blob, filename);
      showToast(`📄 تم إصدار تقرير Word بنجاح: ${filename}`);
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء بناء التقرير: ' + err.message);
    } finally {
      btnGenerateDocx.disabled = false;
      btnGenerateDocx.innerHTML = '<span>📄 إنشاء وتحميل تقرير Word المعتمد (.docx)</span>';
    }
  });

  // Toast Helper
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3500);
  }
});
