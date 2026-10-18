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
  const inpPlace = document.getElementById('inp-place');

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
  const btnSwapCoords = document.getElementById('btn-swap-coords');
  const btnLoadDraft = document.getElementById('btn-load-draft');
  const btnImportProject = document.getElementById('btn-import-project') || document.getElementById('btn-import-pdf');
  const inputCertProject = document.getElementById('input-cert-project') || document.getElementById('input-cert-pdf');
  const tblManualPointsBody = document.getElementById('tbl-manual-points-body');
  const btnExportCsvManual = document.getElementById('btn-export-csv-manual');
  const btnConnectManual = document.getElementById('btn-connect-manual');

  // DOM Elements - Parcel Section
  const sectionParcel = document.getElementById('section-parcel');
  const metricArea = document.getElementById('metric-area');
  const metricPerimeter = document.getElementById('metric-perimeter');
  const metricVertices = document.getElementById('metric-vertices');
  const metricCrs = document.getElementById('metric-crs');
  const inpCentroidLng = document.getElementById('inp-centroid-lng');
  const inpCentroidLat = document.getElementById('inp-centroid-lat');
  const centroidStatusBadge = document.getElementById('centroid-status-badge');
  const btnRecalcCentroid = document.getElementById('btn-recalc-centroid');
  const btnModePoly = document.getElementById('btn-mode-poly');
  const btnModePoint = document.getElementById('btn-mode-point');
  const btnFlyEarth = document.getElementById('btn-fly-earth');
  const btnCenterCamera = document.getElementById('btn-center-camera');
  const btnTogglePoly = document.getElementById('btn-toggle-poly');
  const btnExportKml = document.getElementById('btn-export-kml');
  const btnToggleLock = document.getElementById('btn-toggle-lock');
  const lockBtnIcon = document.getElementById('lock-btn-icon');
  const lockBtnLabel = document.getElementById('lock-btn-label');
  let currentOverlayMode = 'polygon'; // 'polygon' | 'point'
  let isOverlayLocked = true;

  // DOM Elements - Pin Style Controls (Color & Size)
  const inpPinText = document.getElementById('inp-pin-text');
  const inpPinColor = document.getElementById('inp-pin-color');
  const rngPinSize = document.getElementById('rng-pin-size');
  const lblPinSizeVal = document.getElementById('lbl-pin-size-val');
  const pinStylePreview = document.getElementById('pin-style-preview');
  let currentPinColor = '#fbbf24';
  let currentPinSize = 12;
  let currentPinText = '🎯 المركز';
  let currentPinPosition = 'below';
  let currentPinShowBg = true;
  const colorChips = document.querySelectorAll('.color-chip');
  const btnPosChips = document.querySelectorAll('.btn-pos-chip');
  const chkPinBg = document.getElementById('chk-pin-bg');

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
  const btnUploadLocalImage = document.getElementById('btn-upload-local-image');
  const inputLocalImage = document.getElementById('input-local-image');

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

  // --- 1. MANUAL POINTS TABLE MANAGEMENT WITH REORDERING & DRAG-AND-DROP ---
  let draggedPointIdx = null;

  function syncManualPointsToActiveParcel() {
    if (!currentParcel || manualPoints.length < 3) return;
    try {
      const meta = getManualMetadata();
      const validPoints = manualPoints.filter(p => p.x !== '' && p.y !== '');
      if (validPoints.length >= 3) {
        const parcel = GeoEngine.createParcelFromManual(meta, manualPoints);
        currentParcel = parcel;
        displayParcel(currentParcel);
        if (chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ currentParcel });
        }
        chrome.tabs.query({ url: '*://earth.google.com/*' }, (tabs) => {
          if (tabs && tabs.length > 0) {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: 'UPDATE_PARCEL',
              parcel: currentParcel
            });
          }
        });
      }
    } catch (e) {
      console.warn('Could not auto-sync parcel:', e);
    }
  }

  function renderManualPointsTable() {
    if (!tblManualPointsBody) return;
    tblManualPointsBody.innerHTML = '';
    pointsCountBadge.textContent = `${manualPoints.length} نقاط`;

    manualPoints.forEach((pt, idx) => {
      const tr = document.createElement('tr');
      tr.className = 'point-drag-row';
      tr.setAttribute('draggable', 'true');
      tr.setAttribute('data-idx', String(idx));

      tr.innerHTML = `
        <td class="col-reorder">
          <div class="row-order-btns">
            <button type="button" class="btn-order-move btn-move-up" data-idx="${idx}" title="تحريك النقطة لأعلى" ${idx === 0 ? 'disabled' : ''}>▲</button>
            <span class="drag-handle" title="اسحب بالماوس لترتيب النقطة">⋮⋮</span>
            <button type="button" class="btn-order-move btn-move-down" data-idx="${idx}" title="تحريك النقطة لأسفل" ${idx === manualPoints.length - 1 ? 'disabled' : ''}>▼</button>
          </div>
        </td>
        <td style="font-weight: 700; color: #94a3b8;">${idx + 1}</td>
        <td><input type="text" class="inp-pt-x inp-mono" data-idx="${idx}" value="${pt.x || ''}" placeholder="خط الطول (X)"></td>
        <td><input type="text" class="inp-pt-y inp-mono" data-idx="${idx}" value="${pt.y || ''}" placeholder="خط العرض (Y)"></td>
        <td><button class="btn-del-row" data-idx="${idx}" title="حذف هذا الركن" type="button">✖</button></td>
      `;

      // Up / Down Button Listeners
      const btnUp = tr.querySelector('.btn-move-up');
      if (btnUp) {
        btnUp.addEventListener('click', (e) => {
          e.stopPropagation();
          if (idx > 0) {
            const temp = manualPoints[idx];
            manualPoints[idx] = manualPoints[idx - 1];
            manualPoints[idx - 1] = temp;
            renderManualPointsTable();
            syncManualPointsToActiveParcel();
          }
        });
      }

      const btnDown = tr.querySelector('.btn-move-down');
      if (btnDown) {
        btnDown.addEventListener('click', (e) => {
          e.stopPropagation();
          if (idx < manualPoints.length - 1) {
            const temp = manualPoints[idx];
            manualPoints[idx] = manualPoints[idx + 1];
            manualPoints[idx + 1] = temp;
            renderManualPointsTable();
            syncManualPointsToActiveParcel();
          }
        });
      }

      // Drag & Drop Listeners
      tr.addEventListener('dragstart', (e) => {
        draggedPointIdx = idx;
        tr.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(idx));
      });

      tr.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        tr.classList.add('drag-over');
      });

      tr.addEventListener('dragleave', () => {
        tr.classList.remove('drag-over');
      });

      tr.addEventListener('drop', (e) => {
        e.preventDefault();
        tr.classList.remove('drag-over');
        if (draggedPointIdx !== null && draggedPointIdx !== idx) {
          const item = manualPoints.splice(draggedPointIdx, 1)[0];
          manualPoints.splice(idx, 0, item);
          renderManualPointsTable();
          syncManualPointsToActiveParcel();
          showToast(`🔄 تم تغيير ترتيب الركن ${draggedPointIdx + 1} إلى الموضع ${idx + 1}`);
        }
      });

      tr.addEventListener('dragend', () => {
        tr.classList.remove('dragging');
        document.querySelectorAll('.point-drag-row').forEach(r => r.classList.remove('drag-over'));
        draggedPointIdx = null;
      });

      // Inputs
      tr.querySelector('.inp-pt-x').addEventListener('input', (e) => {
        const i = parseInt(e.target.getAttribute('data-idx'));
        manualPoints[i].x = e.target.value.trim();
        syncManualPointsToActiveParcel();
      });

      tr.querySelector('.inp-pt-y').addEventListener('input', (e) => {
        const i = parseInt(e.target.getAttribute('data-idx'));
        manualPoints[i].y = e.target.value.trim();
        syncManualPointsToActiveParcel();
      });

      tr.querySelector('.btn-del-row').addEventListener('click', (e) => {
        const i = parseInt(e.currentTarget.getAttribute('data-idx'));
        manualPoints.splice(i, 1);
        renderManualPointsTable();
        syncManualPointsToActiveParcel();
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

  // Clear all points & reset points memory
  btnClearPoints.addEventListener('click', () => {
    if (manualPoints.length > 0 && !confirm('هل تريد تفريغ قائمة أركان الموقع بالكامل وتصفير الذاكرة؟')) return;
    manualPoints = [];
    renderManualPointsTable();
    currentParcel = null;
    if (sectionParcel) sectionParcel.style.display = 'none';
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.remove(['currentParcel', 'overlayOffset', 'isOverlayLocked']);
    }
    chrome.tabs.query({ url: '*://earth.google.com/*' }, (tabs) => {
      if (tabs && tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'CLEAR_PARCEL' }).catch(() => {});
      }
    });
    showToast('🗑️ تم تفريغ أركان الموقع وتصفير ذاكرة الخريطة بنجاح.');
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
      // Auto-detect DMS in pasted line
      if (parts.length === 6) {
        const xVal = parseDmsToDd(`${parts[0]} ${parts[1]} ${parts[2]}`);
        const yVal = parseDmsToDd(`${parts[3]} ${parts[4]} ${parts[5]}`);
        if (xVal !== null && yVal !== null) {
          parsed.push({ x: xVal.toFixed(6), y: yVal.toFixed(6) });
          return;
        }
      } else if (parts.length === 8) {
        const xVal = parseDmsToDd(`${parts[0]} ${parts[1]} ${parts[2]} ${parts[3]}`);
        const yVal = parseDmsToDd(`${parts[4]} ${parts[5]} ${parts[6]} ${parts[7]}`);
        if (xVal !== null && yVal !== null) {
          parsed.push({ x: xVal.toFixed(6), y: yVal.toFixed(6) });
          return;
        }
      }

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

  // Swap X ⇄ Y Button
  if (btnSwapCoords) {
    btnSwapCoords.addEventListener('click', () => {
      if (manualPoints.length === 0) {
        showToast('⚠️ لا توجد نقاط لتبديلها.');
        return;
      }
      manualPoints.forEach((p) => {
        const tmp = p.x;
        p.x = p.y;
        p.y = tmp;
      });
      renderManualPointsTable();
      syncManualPointsToActiveParcel();
      showToast('🔄 تم تبديل خط الطول والعرض (Swap X ⇄ Y) بنجاح!');
    });
  }

  // --- DMS (Degrees, Minutes, Seconds) to DD Converter Tool ---
  function parseDmsToDd(input) {
    if (!input) return null;
    let str = String(input).trim();
    const eastern = '٠١٢٣٤٥٦٧٨٩';
    for (let i = 0; i < eastern.length; i++) {
      str = str.replaceAll(eastern[i], String(i));
    }
    str = str.replace(/٫/g, '.').replace(/،/g, ',');

    const tokens = str.match(/[-+]?\d*\.?\d+/g);
    if (!tokens || tokens.length === 0) return null;
    const nums = tokens.map(Number);

    if (nums.length === 1) {
      return isNaN(nums[0]) ? null : nums[0];
    }

    if (nums.length === 4 && nums[2] < 60) {
      const d = nums[0];
      const m = nums[1];
      const sInt = nums[2];
      const sFrac = nums[3];
      const fracLen = String(Math.floor(sFrac)).length;
      const s = sInt + (sFrac / Math.pow(10, fracLen));
      const sign = d < 0 ? -1 : 1;
      return sign * (Math.abs(d) + (m / 60.0) + (s / 3600.0));
    }

    if (nums.length >= 3) {
      const d = nums[0];
      const m = nums[1];
      const s = nums[2];
      const sign = d < 0 ? -1 : 1;
      return sign * (Math.abs(d) + (m / 60.0) + (s / 3600.0));
    }

    if (nums.length === 2) {
      const d = nums[0];
      const m = nums[1];
      const sign = d < 0 ? -1 : 1;
      return sign * (Math.abs(d) + (m / 60.0));
    }

    return null;
  }

  const btnToggleDms = document.getElementById('btn-toggle-dms');
  const boxDmsConverter = document.getElementById('box-dms-converter');
  const btnCloseDms = document.getElementById('btn-close-dms');
  const inpDmsLng = document.getElementById('inp-dms-lng');
  const inpDmsLat = document.getElementById('inp-dms-lat');
  const outDdLng = document.getElementById('out-dd-lng');
  const outDdLat = document.getElementById('out-dd-lat');
  const btnDmsAddPoint = document.getElementById('btn-dms-add-point');
  const btnDmsSetCentroid = document.getElementById('btn-dms-set-centroid');
  const btnDmsCopy = document.getElementById('btn-dms-copy');

  if (btnToggleDms && boxDmsConverter) {
    btnToggleDms.addEventListener('click', () => {
      const isShown = boxDmsConverter.style.display !== 'none';
      boxDmsConverter.style.display = isShown ? 'none' : 'block';
      if (!isShown && inpDmsLng) inpDmsLng.focus();
    });
  }

  if (btnCloseDms && boxDmsConverter) {
    btnCloseDms.addEventListener('click', () => {
      boxDmsConverter.style.display = 'none';
    });
  }

  function updateDmsOutputs() {
    if (inpDmsLng && outDdLng) {
      const val = parseDmsToDd(inpDmsLng.value);
      outDdLng.value = (val !== null && !isNaN(val)) ? val.toFixed(6) : '';
    }
    if (inpDmsLat && outDdLat) {
      const val = parseDmsToDd(inpDmsLat.value);
      outDdLat.value = (val !== null && !isNaN(val)) ? val.toFixed(6) : '';
    }
  }

  if (inpDmsLng) inpDmsLng.addEventListener('input', updateDmsOutputs);
  if (inpDmsLat) inpDmsLat.addEventListener('input', updateDmsOutputs);

  if (btnDmsAddPoint) {
    btnDmsAddPoint.addEventListener('click', () => {
      const lng = outDdLng ? outDdLng.value.trim() : '';
      const lat = outDdLat ? outDdLat.value.trim() : '';
      if (!lng || !lat) {
        alert('يرجى كتابة قيم درجات ودقائق وثوانٍ صالحة لخط الطول والعرض أولاً.');
        return;
      }
      manualPoints.push({ x: lng, y: lat });
      renderManualPointsTable();
      syncManualPointsToActiveParcel();
      showToast(`➕ تم إضافة النقطة (${lng}, ${lat}) بنجاح إلى جدول الأركان!`);
    });
  }

  if (btnDmsSetCentroid) {
    btnDmsSetCentroid.addEventListener('click', () => {
      const lng = outDdLng ? outDdLng.value.trim() : '';
      const lat = outDdLat ? outDdLat.value.trim() : '';
      if (!lng || !lat) {
        alert('يرجى كتابة قيم درجات ودقائق وثوانٍ صالحة أولاً.');
        return;
      }
      if (inpCentroidLng) inpCentroidLng.value = lng;
      if (inpCentroidLat) inpCentroidLat.value = lat;
      if (currentParcel) {
        currentParcel.centroid = { lon: parseFloat(lng), lat: parseFloat(lat) };
        currentParcel.center = currentParcel.centroid;
        currentParcel.isCentroidUserEdited = true;
        if (centroidStatusBadge) {
          centroidStatusBadge.textContent = 'معدل يدوياً ✍️';
          centroidStatusBadge.classList.add('edited');
        }
        chrome.tabs.query({ url: '*://earth.google.com/*' }, (tabs) => {
          if (tabs && tabs.length > 0) {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: 'SET_CENTROID',
              centroid: currentParcel.centroid
            }).catch(() => {});
          }
        });
      }
      showToast(`🎯 تم ضبط المركز إلى (${lng}, ${lat}) بنجاح!`);
    });
  }

  if (btnDmsCopy) {
    btnDmsCopy.addEventListener('click', () => {
      const lng = outDdLng ? outDdLng.value.trim() : '';
      const lat = outDdLat ? outDdLat.value.trim() : '';
      if (!lng || !lat) {
        alert('لا توجد قيم محولة لنسخها.');
        return;
      }
      const text = `${lng}, ${lat}`;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          showToast(`📋 تم نسخ الإحداثيات: ${text}`);
        }).catch(() => {
          prompt('انسخ الإحداثيات المحولة (DD):', text);
        });
      } else {
        prompt('انسخ الإحداثيات المحولة (DD):', text);
      }
    });
  }

  // Load Previous Draft Button
  if (btnLoadDraft) {
    btnLoadDraft.addEventListener('click', () => {
      if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['currentParcel', 'capturedShots', 'previewData'], (res) => {
          const parcel = res.currentParcel || (res.previewData && res.previewData.parcel);
          if (!parcel) {
            alert('لا توجد مسودة سابقة محفوظة في ذاكرة المتصفح.\nيمكنك استخدام زر [📂 استيراد مشروع (JSON)] لاستيراد أي مشروع سابق مباشرة!');
            return;
          }
          currentParcel = parcel;
          displayParcel(currentParcel);

          // Populate inputs across both tabs
          if (inpManName) inpManName.value = parcel.applicantName || '';
          if (inpManNatId) inpManNatId.value = parcel.nationalId || '';
          if (inpManIdNo) inpManIdNo.value = parcel.idNo || '';
          if (inpManCenter) inpManCenter.value = parcel.centerCity || parcel.markaz || '';
          if (inpManSheikhah) inpManSheikhah.value = parcel.sheikhah || parcel.village || '';
          if (inpManPlace) inpManPlace.value = parcel.place || parcel.basin || parcel.address || '';

          if (inpName) inpName.value = parcel.applicantName || '';
          if (inpNatId) inpNatId.value = parcel.nationalId || '';
          if (inpCenter) inpCenter.value = parcel.centerCity || parcel.markaz || '';
          if (inpVillage) inpVillage.value = parcel.village || parcel.sheikhah || '';
          if (inpPlace) inpPlace.value = parcel.place || parcel.basin || parcel.address || '';

          if (parcel.vertices && Array.isArray(parcel.vertices)) {
            manualPoints = parcel.vertices.map(v => ({
              x: v.rawX !== undefined ? String(v.rawX) : String(v.lon),
              y: v.rawY !== undefined ? String(v.rawY) : String(v.lat)
            }));
            renderManualPointsTable();
          }

          if (res.capturedShots && Array.isArray(res.capturedShots)) {
            capturedShots = res.capturedShots;
            renderShotsGallery();
          }

          flyEarthTabToParcel(currentParcel);
          showToast(`📂 تم استرجاع مسودة: ${currentParcel.applicantName || 'المواطن'} وتفعيل كافة الحقول بنجاح!`);
        });
      }
    });
  }

  // --- 1.2 JSON PROJECT IMPORTER FOR RESTORING & EDITING PREVIOUS PROJECTS ---
  if (btnImportProject && inputCertProject) {
    btnImportProject.addEventListener('click', () => {
      inputCertProject.value = '';
      inputCertProject.click();
    });

    inputCertProject.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      handleSurveyFile(file);
    });
  }

  async function handlePdfCertificateImport(file) {
    alert(`💡 تم تخفيف حجم الإضافة وحذف محرك تفريغ الـ PDF القديم.\nيرجى استيراد ملف الرفع المساحي المباشر (Excel / CSV) أو ملف المشروع السابق (JSON).`);
    return;
  }

  function parsePdfCertificateText(rawText, items) {
    let cleaned = rawText || '';

    // If text items with positions are provided, also build spatially-sorted text
    if (items && Array.isArray(items) && items.length > 0) {
      try {
        const sortedItems = [...items].sort((a, b) => {
          const yA = (a.transform && a.transform[5]) || 0;
          const yB = (b.transform && b.transform[5]) || 0;
          if (Math.abs(yB - yA) > 4) return yB - yA; // Top to bottom
          const xA = (a.transform && a.transform[4]) || 0;
          const xB = (b.transform && b.transform[4]) || 0;
          return xA - xB; // Left to right
        });
        const spatialText = sortedItems.map(it => it.str).join(' ');
        cleaned += '\n' + spatialText;
      } catch (sErr) {
        console.warn('Spatial text sorting warning:', sErr);
      }
    }

    const easternDigits = '٠١٢٣٤٥٦٧٨٩';
    for (let i = 0; i < easternDigits.length; i++) {
      cleaned = cleaned.split(easternDigits[i]).join(String(i));
    }
    // Convert Arabic decimal comma and european comma decimals (e.g. 31,404767)
    cleaned = cleaned.replace(/٫/g, '.');
    cleaned = cleaned.replace(/(\d+),(\d+)/g, '$1.$2');
    cleaned = cleaned.replace(/،/g, ',');

    const data = {
      name: '',
      nationalId: '',
      idNo: '',
      center: '',
      village: '',
      address: '',
      centroidLon: null,
      centroidLat: null,
      points: [],
      surveyor: '',
      director: '',
      reviewer: ''
    };

    // 1. National ID (14 digits starting with 2 or 3)
    const natIdMatch = cleaned.match(/\b([23]\d{13})\b/);
    if (natIdMatch) {
      data.nationalId = natIdMatch[1];
    }

    // 2. Known Dakahlia Centers
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

    // 3. Coordinates / Centroid (30.x - 32.x in Egypt)
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

    // 4. Citizen Name
    const namePatterns = [
      /(?:اسم\s*المواطن|المواطن|صاحب\s*الشأن|السيد|الاسم)\s*[:/=\-]?\s*([^\n\r,\t|]+)/,
      /(?:المواطن\s*\/)\s*([^\n\r,\t|]+)/
    ];
    for (const pat of namePatterns) {
      const m = cleaned.match(pat);
      if (m && m[1]) {
        let val = m[1].trim();
        val = val.replace(/(?:الرقم|بطاقة|مركز|الوحدة|تاريخ|طلب|شهادة).*$/, '').trim();
        if (val.length >= 4) {
          data.name = val;
          break;
        }
      }
    }

    // 5. Village / Local Unit
    const villageMatch = cleaned.match(/(?:الوحدة\s*المحلية|قرية|القرية)\s*[:/=\-]?\s*([^\n\r,\t|]+)/);
    if (villageMatch && villageMatch[1]) {
      let val = villageMatch[1].trim();
      val = val.replace(/(?:المركز|العنوان|حوض|شارع|محافظة).*$/, '').trim();
      data.village = val;
    }

    // 6. Address / Basin
    const addrMatch = cleaned.match(/(?:العنوان\s*\/\s*الحوض|العنوان|الموقع|الحوض|حوض)\s*[:/=\-]?\s*([^\n\r,\t|]+)/);
    if (addrMatch && addrMatch[1]) {
      let val = addrMatch[1].trim();
      val = val.replace(/(?:الوحدة|المركز|تاريخ|المواطن).*$/, '').trim();
      data.address = val;
    }

    // 7. Signatures / Committee
    const survMatch = cleaned.match(/(?:مسؤول\s*المتغيرات|المساح|القائم\s*بالمعاينة)\s*[:/=\-]?\s*([^\n\r,\t|]+)/);
    if (survMatch && survMatch[1]) data.surveyor = survMatch[1].trim().replace(/(?:الاسم|مهندس).*[:/]/, '').trim();

    const dirMatch = cleaned.match(/(?:مدير\s*الإدارة|مديرة\s*الإدارة|مدير\s*إدارة)\s*[:/=\-]?\s*([^\n\r,\t|]+)/);
    if (dirMatch && dirMatch[1]) data.director = dirMatch[1].trim().replace(/(?:الاسم|مهندسة).*[:/]/, '').trim();

    const revMatch = cleaned.match(/(?:المراجع|رئيس\s*اللجنة)\s*[:/=\-]?\s*([^\n\r,\t|]+)/);
    if (revMatch && revMatch[1]) data.reviewer = revMatch[1].trim();

    return data;
  }

  // Helper: Read Manual Meta
  function getManualMetadata() {
    const center = inpManCenter.value.trim() || 'أجا';
    const sheikhah = inpManSheikhah.value.trim() || 'نوسا البحر';
    const place = inpManPlace.value.trim() || `${sheikhah} ــ ${center}`;
    return {
      name: inpManName.value.trim() || 'يحيى عوض محمد عوض',
      nationalId: inpManNatId.value.trim() || '26205251201152',
      idNo: inpManIdNo.value.trim() || '62644774',
      center: center,
      sheikhah: sheikhah,
      place: place,
      basin: place,
      address: place,
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
      if (inpPlace) inpPlace.value = parcel.place;

      // Save to storage with fresh zero offset
      if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({
          currentParcel,
          overlayOffset: { dLat: 0, dLon: 0 },
          isOverlayLocked: false
        });
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
    manualPoints = [];

    // Clear Upload tab inputs
    if (inpName) inpName.value = '';
    if (inpNatId) inpNatId.value = '';
    if (inpCenter) inpCenter.value = '';
    if (inpVillage) inpVillage.value = '';
    if (inpPlace) inpPlace.value = '';
    if (inpInspectNotes) inpInspectNotes.value = '';
    if (fileInput) fileInput.value = '';

    // Clear Manual tab inputs
    if (inpManName) inpManName.value = '';
    if (inpManNatId) inpManNatId.value = '';
    if (inpManIdNo) inpManIdNo.value = '';
    if (inpManCenter) inpManCenter.value = '';
    if (inpManSheikhah) inpManSheikhah.value = '';
    if (inpManPlace) inpManPlace.value = '';
    if (inpCentroidLng) inpCentroidLng.value = '';
    if (inpCentroidLat) inpCentroidLat.value = '';
    if (txtPasteCoords) txtPasteCoords.value = '';
    if (boxPasteCoords) boxPasteCoords.style.display = 'none';

    // Reset points table
    renderManualPointsTable();

    // Hide UI sections
    if (sectionParcel) sectionParcel.style.display = 'none';
    if (sectionCapture) sectionCapture.style.display = 'none';
    if (sectionGallery) sectionGallery.style.display = 'none';
    if (sectionExport) sectionExport.style.display = 'none';
    if (galleryCount) galleryCount.textContent = '0';
    if (shotsContainer) shotsContainer.innerHTML = '';

    updateShotsLimitUI();

    // Clear storage memory completely so nothing is cached
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.remove([
        'currentParcel',
        'capturedShots',
        'previewData',
        'overlayOffset',
        'isOverlayLocked',
        'selectedYear',
        'selectedMonth'
      ]);
    }

    // Tell Google Earth to remove SVG, HUD, and reset offset
    chrome.tabs.query({ url: '*://earth.google.com/*' }, (tabs) => {
      if (tabs && tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'CLEAR_PARCEL' }).catch(() => {});
      }
    });

    showToast('🧹 تم مسح كافة البيانات وتصفير الذاكرة بالكامل لمعاملة جديدة.');
  }

  // Fresh Start: Forget previous project and do not cache in RAM/Storage
  // Clear any leftover session state on startup so each session starts fresh
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.remove(['currentParcel', 'capturedShots', 'overlayOffset', 'isOverlayLocked']);

    // Clear session on panel close / unload
    window.addEventListener('beforeunload', () => {
      chrome.storage.local.remove(['currentParcel', 'capturedShots', 'overlayOffset', 'isOverlayLocked']);
    });

    // Listen for storage changes from Content Script
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.capturedShots) {
        capturedShots = changes.capturedShots.newValue || [];
        renderShotsGallery();
      }
      if (area === 'local' && changes.currentParcel && changes.currentParcel.newValue) {
        const p = changes.currentParcel.newValue;
        if (p) {
          currentParcel = p;
          if (p.centroid) {
            if (inpCentroidLng && document.activeElement !== inpCentroidLng && p.centroid.lon !== undefined) {
              inpCentroidLng.value = Number(p.centroid.lon).toFixed(6);
            }
            if (inpCentroidLat && document.activeElement !== inpCentroidLat && p.centroid.lat !== undefined) {
              inpCentroidLat.value = Number(p.centroid.lat).toFixed(6);
            }
            if (centroidStatusBadge && p.isCentroidUserEdited) {
              centroidStatusBadge.textContent = 'معدل بالسحب ✍️';
              centroidStatusBadge.classList.add('edited');
            }
          }
        }
      }
    });

    // Listen to real-time centroid dragging messages from Google Earth tab
    if (chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg.action === 'CENTROID_DRAGGED' && msg.centroid) {
          const lat = parseFloat(Number(msg.centroid.lat).toFixed(7));
          const lon = parseFloat(Number(msg.centroid.lon).toFixed(7));

          if (currentParcel) {
            currentParcel.centroid = { lon: lon, lat: lat };
            currentParcel.center = { lon: lon, lat: lat };
            currentParcel.centerLng = lon;
            currentParcel.centerLat = lat;
            currentParcel.isCentroidUserEdited = true;

            // Sync to chrome storage immediately so Preview tab and export inherit dragged coordinates
            if (chrome.storage && chrome.storage.local) {
              chrome.storage.local.set({ currentParcel: currentParcel });
            }
          }

          if (inpCentroidLng) inpCentroidLng.value = lon.toFixed(6);
          if (inpCentroidLat) inpCentroidLat.value = lat.toFixed(6);

          if (centroidStatusBadge) {
            centroidStatusBadge.textContent = 'معدل بالسحب ✍️';
            centroidStatusBadge.classList.add('edited');
          }

          showToast(`🎯 تم تحديث إحداثيات المركز: ${lon.toFixed(5)}, ${lat.toFixed(5)}`);
        }
      });
    }
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

  // Handle uploaded survey file (Excel, CSV, or JSON Project)
  function handleSurveyFile(file) {
    if (file.name.endsWith('.json') || file.name.endsWith('.certi')) {
      const textReader = new FileReader();
      textReader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          const parcel = data.parcel || data;
          if (parcel) {
            currentParcel = parcel;
            if (Array.isArray(data.shots)) {
              capturedShots = data.shots;
              renderShotsGallery();
            }
            if (parcel.vertices && Array.isArray(parcel.vertices)) {
              manualPoints = parcel.vertices.map(v => ({
                x: v.rawX !== undefined ? String(v.rawX) : String(v.lon),
                y: v.rawY !== undefined ? String(v.rawY) : String(v.lat)
              }));
              renderManualPointsTable();
            }
            if (inpName) inpName.value = parcel.applicantName || '';
            if (inpNatId) inpNatId.value = parcel.nationalId || '';
            if (inpCenter) inpCenter.value = parcel.centerCity || '';
            if (inpVillage) inpVillage.value = parcel.sheikhah || parcel.village || '';
            if (inpPlace) inpPlace.value = parcel.place || '';

            if (inpManName) inpManName.value = parcel.applicantName || '';
            if (inpManNatId) inpManNatId.value = parcel.nationalId || '';
            if (inpManIdNo) inpManIdNo.value = parcel.idNo || '';
            if (inpManCenter) inpManCenter.value = parcel.centerCity || '';
            if (inpManSheikhah) inpManSheikhah.value = parcel.sheikhah || parcel.village || '';
            if (inpManPlace) inpManPlace.value = parcel.place || '';

            if (data.committee) {
              if (inpSurveyor && data.committee.surveyor) inpSurveyor.value = data.committee.surveyor;
              if (inpDirector && data.committee.director) inpDirector.value = data.committee.director;
              if (inpReviewer && data.committee.reviewer) inpReviewer.value = data.committee.reviewer;
            }

            if (chrome.storage && chrome.storage.local) {
              chrome.storage.local.set({
                currentParcel,
                capturedShots,
                previewData: {
                  parcel: currentParcel,
                  shots: capturedShots,
                  committee: data.committee || {
                    surveyor: inpSurveyor?.value || 'مسؤول المتغيرات المكانية',
                    director: inpDirector?.value || 'مروة محمد رضوان',
                    reviewer: inpReviewer?.value || 'د / عماد عبدالله احمد'
                  }
                },
                overlayOffset: { dLat: 0, dLon: 0 },
                isOverlayLocked: false
              });
            }

            if (data.pinStyle) {
              if (data.pinStyle.color) currentPinColor = data.pinStyle.color;
              if (data.pinStyle.size) currentPinSize = Number(data.pinStyle.size);
              if (data.pinStyle.text !== undefined) currentPinText = data.pinStyle.text;
              if (data.pinStyle.position) currentPinPosition = data.pinStyle.position;
              if (data.pinStyle.showBg !== undefined) currentPinShowBg = data.pinStyle.showBg;

              if (inpPinColor) inpPinColor.value = currentPinColor;
              if (rngPinSize) rngPinSize.value = currentPinSize;
              if (lblPinSizeVal) lblPinSizeVal.textContent = `${currentPinSize}px`;
              if (inpPinText) inpPinText.value = currentPinText;
              if (chkPinBg) chkPinBg.checked = currentPinShowBg;

              btnPosChips.forEach(c => c.classList.toggle('active', c.getAttribute('data-pos') === currentPinPosition));
              updateActiveColorChip(currentPinColor);
              updatePinPreview(currentPinText, currentPinColor, currentPinSize, currentPinShowBg);
              syncPinStyleToEarth(currentPinColor, currentPinSize, currentPinText, currentPinPosition, currentPinShowBg);
            }

            displayParcel(currentParcel);
            flyEarthTabToParcel(currentParcel);
            showToast(`📂 تم استيراد ملف المشروع (${parcel.applicantName || 'المواطن'}) بنجاح!`);
          }
        } catch (err) {
          alert('خطأ أثناء قراءة ملف المشروع JSON: ' + err.message);
        }
      };
      textReader.readAsText(file);
      return;
    }

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
        if (inpPlace) inpPlace.value = parsed.place || ((parsed.village && parsed.centerCity) ? `${parsed.village} ــ ${parsed.centerCity}` : '');

        // Populate manual points list
        manualPoints = parsed.vertices.map(v => ({
          x: v.rawX !== undefined ? String(v.rawX) : String(v.lon),
          y: v.rawY !== undefined ? String(v.rawY) : String(v.lat)
        }));
        renderManualPointsTable();

        if (chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({
            currentParcel,
            overlayOffset: { dLat: 0, dLon: 0 },
            isOverlayLocked: false
          });
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
      chrome.storage.local.set({
        currentParcel,
        overlayOffset: { dLat: 0, dLon: 0 },
        isOverlayLocked: false
      });
    }

    if (inpPlace) {
      inpPlace.value = parsed.place || ((parsed.village && parsed.centerCity) ? `${parsed.village} ــ ${parsed.centerCity}` : '');
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
    if (inpPlace) {
      inpPlace.value = parcel.place || parcel.basin || parcel.address || parcel.placeName || 
        ((parcel.village && parcel.centerCity) ? `${parcel.village} ــ ${parcel.centerCity}` : (parcel.village || parcel.centerCity || ''));
    }

    const areaVal = (parcel.calculatedAreaM2 !== undefined ? parcel.calculatedAreaM2 : (parcel.area !== undefined ? parcel.area : (parcel.statedAreaM2 || 0)));
    const perimVal = (parcel.perimeterM !== undefined ? parcel.perimeterM : (parcel.perimeter !== undefined ? parcel.perimeter : 0));
    metricArea.textContent = `${Number(areaVal || 0).toFixed(2)} م²`;
    metricPerimeter.textContent = `${Number(perimVal || 0).toFixed(2)} م`;
    metricVertices.textContent = `${(parcel.vertices || []).length} أركان`;
    metricCrs.textContent = parcel.crs || 'WGS84 (EPSG:4326)';

    // Centroid Display & Edit
    const centroid = parcel.centroid || (window.GeoEngine && GeoEngine.calculatePolygonCentroid(parcel)) || { lon: parcel.center ? parcel.center.lon : null, lat: parcel.center ? parcel.center.lat : null };
    parcel.centroid = centroid;
    if (inpCentroidLng && centroid.lon !== null && !isNaN(centroid.lon)) {
      inpCentroidLng.value = Number(centroid.lon).toFixed(6);
    }
    if (inpCentroidLat && centroid.lat !== null && !isNaN(centroid.lat)) {
      inpCentroidLat.value = Number(centroid.lat).toFixed(6);
    }
    if (centroidStatusBadge) {
      if (parcel.isCentroidUserEdited) {
        centroidStatusBadge.textContent = 'معدل يدوياً ✏️';
        centroidStatusBadge.classList.add('edited');
      } else {
        centroidStatusBadge.textContent = 'محسوب تلقائياً';
        centroidStatusBadge.classList.remove('edited');
      }
    }

    sectionParcel.style.display = 'block';
    sectionCapture.style.display = 'block';
    sectionExport.style.display = 'block';

    updateShotsLimitUI();
  }

  // Handle Centroid Manual Editing
  function syncEditedCentroid() {
    if (!currentParcel || !inpCentroidLng || !inpCentroidLat) return;
    const lngVal = parseFloat(inpCentroidLng.value.trim());
    const latVal = parseFloat(inpCentroidLat.value.trim());
    if (!isNaN(lngVal) && !isNaN(latVal)) {
      currentParcel.centroid = { lon: lngVal, lat: latVal };
      currentParcel.center = { lon: lngVal, lat: latVal };
      currentParcel.centerLng = lngVal;
      currentParcel.centerLat = latVal;
      currentParcel.isCentroidUserEdited = true;

      if (centroidStatusBadge) {
        centroidStatusBadge.textContent = 'معدل يدوياً ✏️';
        centroidStatusBadge.classList.add('edited');
      }

      if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ currentParcel });
      }

      // Notify Content Script on Google Earth
      chrome.tabs.query({ url: '*://earth.google.com/*' }, (tabs) => {
        if (tabs && tabs.length > 0) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'UPDATE_CENTROID',
            centroid: currentParcel.centroid
          });
        }
      });
    }
  }

  if (inpCentroidLng) {
    inpCentroidLng.addEventListener('input', syncEditedCentroid);
  }
  if (inpCentroidLat) {
    inpCentroidLat.addEventListener('input', syncEditedCentroid);
  }

  // Recalculate Centroid Button
  if (btnRecalcCentroid) {
    btnRecalcCentroid.addEventListener('click', () => {
      if (!currentParcel) return;
      delete currentParcel.centroid;
      delete currentParcel.isCentroidUserEdited;
      const freshCentroid = (window.GeoEngine && GeoEngine.calculatePolygonCentroid(currentParcel)) || (currentParcel.center || { lon: 31.0, lat: 31.0 });
      currentParcel.centroid = freshCentroid;
      currentParcel.center = freshCentroid;
      currentParcel.centerLng = freshCentroid.lon;
      currentParcel.centerLat = freshCentroid.lat;

      if (inpCentroidLng && freshCentroid.lon !== null) {
        inpCentroidLng.value = Number(freshCentroid.lon).toFixed(6);
      }
      if (inpCentroidLat && freshCentroid.lat !== null) {
        inpCentroidLat.value = Number(freshCentroid.lat).toFixed(6);
      }
      if (centroidStatusBadge) {
        centroidStatusBadge.textContent = 'محسوب تلقائياً';
        centroidStatusBadge.classList.remove('edited');
      }

      if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ currentParcel });
      }

      chrome.tabs.query({ url: '*://earth.google.com/*' }, (tabs) => {
        if (tabs && tabs.length > 0) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'UPDATE_CENTROID',
            centroid: currentParcel.centroid
          });
        }
      });

      showToast('🎯 تم إعادة حساب مركز الثقل تلقائياً من الأركان.');
    });
  }

  // Auto-inherit address in Tab 1 (Center + Village => Place)
  function updateTab1AddressInheritance() {
    if (!inpPlace) return;
    const center = (inpCenter && inpCenter.value.trim()) || '';
    const village = (inpVillage && inpVillage.value.trim()) || '';
    if (village && center) {
      if (!inpPlace.dataset.userEdited || inpPlace.value.trim() === '') {
        inpPlace.value = `${village} ــ ${center}`;
        if (currentParcel) {
          currentParcel.place = inpPlace.value;
          currentParcel.basin = inpPlace.value;
          currentParcel.address = inpPlace.value;
        }
      }
    }
  }

  if (inpPlace) {
    inpPlace.addEventListener('input', () => {
      inpPlace.dataset.userEdited = 'true';
      if (currentParcel) {
        currentParcel.place = inpPlace.value.trim();
        currentParcel.basin = inpPlace.value.trim();
        currentParcel.address = inpPlace.value.trim();
        if (chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ currentParcel });
        }
      }
    });
  }

  // Auto-inherit address in Tab 2 Manual Entry
  function updateTab2AddressInheritance() {
    if (!inpManPlace) return;
    const center = (inpManCenter && inpManCenter.value.trim()) || '';
    const sheikhah = (inpManSheikhah && inpManSheikhah.value.trim()) || '';
    if (sheikhah && center) {
      if (!inpManPlace.dataset.userEdited || inpManPlace.value.trim() === '') {
        inpManPlace.value = `${sheikhah} ــ ${center}`;
      }
    }
  }

  if (inpManPlace) {
    inpManPlace.addEventListener('input', () => {
      inpManPlace.dataset.userEdited = 'true';
    });
  }

  [inpManCenter, inpManSheikhah].forEach(inp => {
    if (!inp) return;
    inp.addEventListener('input', () => {
      updateTab2AddressInheritance();
    });
  });

  // Sync edited metadata
  [inpName, inpNatId, inpCenter, inpVillage].forEach(inp => {
    if (!inp) return;
    inp.addEventListener('input', () => {
      if (inp === inpCenter || inp === inpVillage) {
        updateTab1AddressInheritance();
      }
      if (currentParcel) {
        currentParcel.applicantName = inpName.value.trim() || currentParcel.applicantName;
        currentParcel.nationalId = inpNatId.value.trim() || currentParcel.nationalId;
        currentParcel.centerCity = inpCenter.value.trim() || currentParcel.centerCity;
        currentParcel.village = inpVillage.value.trim() || currentParcel.village;
        if (inpPlace && inpPlace.value.trim()) {
          currentParcel.place = inpPlace.value.trim();
          currentParcel.basin = inpPlace.value.trim();
          currentParcel.address = inpPlace.value.trim();
        }
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

  // --- LOCK / UNLOCK OVERLAY POSITION ---
  function updateLockUi(locked) {
    isOverlayLocked = locked;
    if (!btnToggleLock) return;
    if (locked) {
      if (lockBtnIcon) lockBtnIcon.textContent = '🔒';
      if (lockBtnLabel) lockBtnLabel.textContent = 'وضع الرسم: مُثبَّت';
      btnToggleLock.style.borderColor = 'rgba(255, 255, 255, 0.15)';
      btnToggleLock.style.background = 'rgba(15, 23, 42, 0.6)';
      btnToggleLock.title = 'الرسم مُثبَّت حالياً (محمي ضد تحريك المضلع أو الدبوس) - انقر لجعله قابلاً للتعديل';
    } else {
      if (lockBtnIcon) lockBtnIcon.textContent = '🔓';
      if (lockBtnLabel) lockBtnLabel.textContent = 'وضع الرسم: قابل للتعديل';
      btnToggleLock.style.borderColor = '#38bdf8';
      btnToggleLock.style.background = 'rgba(2, 132, 199, 0.25)';
      btnToggleLock.title = 'الرسم قابل للتعديل حالياً (يمكنك سحب المضلع أو الدبوس بالفأرة) - انقر للتثبيت';
    }
  }

  if (btnToggleLock) {
    btnToggleLock.addEventListener('click', () => {
      isOverlayLocked = !isOverlayLocked;
      updateLockUi(isOverlayLocked);
      if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ isOverlayLocked });
      }
      chrome.tabs.query({ url: '*://earth.google.com/*' }, (tabs) => {
        if (tabs && tabs.length > 0) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'SET_OVERLAY_LOCK',
            locked: isOverlayLocked
          }).catch(() => {});
        }
      });
      showToast(isOverlayLocked ? '🔒 وضع الرسم: مُثبَّت (تم تأمين المضلع والدبوس)' : '🔓 وضع الرسم: قابل للتعديل (يمكنك سحب المضلع أو الدبوس بالفأرة)');
    });
  }

  // Load saved overlay mode & lock state on startup
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['overlayMode', 'isOverlayLocked'], (res) => {
      if (res) {
        if (res.overlayMode) {
          setOverlayMode(res.overlayMode, false);
        }
        if (res.isOverlayLocked !== undefined) {
          updateLockUi(res.isOverlayLocked);
        }
      }
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.isOverlayLocked !== undefined) {
        updateLockUi(changes.isOverlayLocked.newValue);
      }
    });
  }

  // --- PIN STYLE CONTROLS (COLOR, SIZE, TEXT, POSITION, BACKGROUND) ---
  function updatePinPreview(text, color, size, showBg) {
    if (!pinStylePreview) return;
    pinStylePreview.textContent = text || '🎯 المركز';
    pinStylePreview.style.color = color;
    pinStylePreview.style.fontSize = `${Math.min(15, Math.max(10, Number(size)))}px`;
    const isBg = (showBg !== undefined) ? showBg : currentPinShowBg;
    if (isBg) {
      pinStylePreview.style.background = 'rgba(15, 23, 42, 0.9)';
      pinStylePreview.style.borderColor = color;
      pinStylePreview.style.textShadow = 'none';
    } else {
      pinStylePreview.style.background = 'transparent';
      pinStylePreview.style.borderColor = 'transparent';
      pinStylePreview.style.textShadow = '0 0 3px #0f172a, 0 0 5px #0f172a';
    }
  }

  function updateActiveColorChip(color) {
    const lower = (color || '').toLowerCase();
    colorChips.forEach(c => {
      if (c.getAttribute('data-color').toLowerCase() === lower) {
        c.classList.add('active');
      } else {
        c.classList.remove('active');
      }
    });
  }

  function syncPinStyleToEarth(color, size, text, position, showBg) {
    currentPinColor = color;
    currentPinSize = Number(size);
    currentPinText = text;
    currentPinPosition = position || currentPinPosition;
    currentPinShowBg = (showBg !== undefined) ? showBg : currentPinShowBg;

    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        pinTextColor: currentPinColor,
        pinTextSize: currentPinSize,
        pinCustomText: currentPinText,
        pinTextPosition: currentPinPosition,
        pinShowBg: currentPinShowBg
      });
    }

    const payload = {
      action: 'UPDATE_PIN_STYLE',
      pinTextColor: currentPinColor,
      pinTextSize: currentPinSize,
      pinCustomText: currentPinText,
      pinTextPosition: currentPinPosition,
      pinShowBg: currentPinShowBg
    };

    chrome.tabs.query({ url: '*://earth.google.com/*' }, (tabs) => {
      if (tabs && tabs.length > 0) {
        tabs.forEach(t => chrome.tabs.sendMessage(t.id, payload).catch(() => {}));
      } else {
        // Fallback: search all tabs for earth.google.com
        chrome.tabs.query({}, (allTabs) => {
          const earthTabs = (allTabs || []).filter(t => t.url && t.url.includes('earth.google.com'));
          earthTabs.forEach(t => chrome.tabs.sendMessage(t.id, payload).catch(() => {}));
        });
      }
    });
  }

  if (inpPinText) {
    inpPinText.addEventListener('input', () => {
      const text = inpPinText.value;
      const color = inpPinColor ? inpPinColor.value : currentPinColor;
      const size = rngPinSize ? rngPinSize.value : currentPinSize;
      updatePinPreview(text, color, size, currentPinShowBg);
      syncPinStyleToEarth(color, size, text, currentPinPosition, currentPinShowBg);
    });
  }

  if (inpPinColor) {
    inpPinColor.addEventListener('input', () => {
      const color = inpPinColor.value;
      const text = inpPinText ? inpPinText.value : currentPinText;
      const size = rngPinSize ? rngPinSize.value : currentPinSize;
      updateActiveColorChip(color);
      updatePinPreview(text, color, size, currentPinShowBg);
      syncPinStyleToEarth(color, size, text, currentPinPosition, currentPinShowBg);
    });
  }

  colorChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const color = chip.getAttribute('data-color');
      if (inpPinColor) inpPinColor.value = color;
      const text = inpPinText ? inpPinText.value : currentPinText;
      const size = rngPinSize ? rngPinSize.value : currentPinSize;
      updateActiveColorChip(color);
      updatePinPreview(text, color, size, currentPinShowBg);
      syncPinStyleToEarth(color, size, text, currentPinPosition, currentPinShowBg);
    });
  });

  if (rngPinSize) {
    rngPinSize.addEventListener('input', () => {
      const size = rngPinSize.value;
      const color = inpPinColor ? inpPinColor.value : currentPinColor;
      const text = inpPinText ? inpPinText.value : currentPinText;
      if (lblPinSizeVal) lblPinSizeVal.textContent = `${size}px`;
      updatePinPreview(text, color, size, currentPinShowBg);
      syncPinStyleToEarth(color, size, text, currentPinPosition, currentPinShowBg);
    });
  }

  btnPosChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const pos = chip.getAttribute('data-pos');
      currentPinPosition = pos;
      btnPosChips.forEach(c => c.classList.toggle('active', c.getAttribute('data-pos') === pos));
      updatePinPreview(currentPinText, currentPinColor, currentPinSize, currentPinShowBg);
      syncPinStyleToEarth(currentPinColor, currentPinSize, currentPinText, currentPinPosition, currentPinShowBg);
    });
  });

  if (chkPinBg) {
    chkPinBg.addEventListener('change', () => {
      currentPinShowBg = chkPinBg.checked;
      updatePinPreview(currentPinText, currentPinColor, currentPinSize, currentPinShowBg);
      syncPinStyleToEarth(currentPinColor, currentPinSize, currentPinText, currentPinPosition, currentPinShowBg);
    });
  }

  // Load initial pin style on startup
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['pinTextColor', 'pinTextSize', 'pinCustomText', 'pinTextPosition', 'pinShowBg'], (res) => {
      if (res) {
        if (res.pinTextColor) currentPinColor = res.pinTextColor;
        if (res.pinTextSize) currentPinSize = Number(res.pinTextSize);
        if (res.pinCustomText !== undefined) currentPinText = res.pinCustomText;
        if (res.pinTextPosition) currentPinPosition = res.pinTextPosition;
        if (res.pinShowBg !== undefined) currentPinShowBg = res.pinShowBg;

        if (inpPinColor) inpPinColor.value = currentPinColor;
        if (rngPinSize) rngPinSize.value = currentPinSize;
        if (lblPinSizeVal) lblPinSizeVal.textContent = `${currentPinSize}px`;
        if (inpPinText) inpPinText.value = currentPinText;
        if (chkPinBg) chkPinBg.checked = currentPinShowBg;

        btnPosChips.forEach(c => c.classList.toggle('active', c.getAttribute('data-pos') === currentPinPosition));
        updateActiveColorChip(currentPinColor);
        updatePinPreview(currentPinText, currentPinColor, currentPinSize, currentPinShowBg);
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

  // --- UPLOAD LOCAL IMAGE FROM PC ---
  if (btnUploadLocalImage && inputLocalImage) {
    btnUploadLocalImage.addEventListener('click', () => {
      if (capturedShots.length >= 6) {
        alert('⚠️ الحد الأقصى للشهادة الرسمية هو 6 صور فقط وفقاً لنماذج وحدة المتغيرات المكانية.');
        return;
      }
      inputLocalImage.click();
    });

    inputLocalImage.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        alert('يرجى اختيار ملف صورة صالح (PNG أو JPG أو WebP).');
        return;
      }

      if (capturedShots.length >= 6) {
        alert('⚠️ الحد الأقصى للشهادة الرسمية هو 6 صور فقط.');
        return;
      }

      const reader = new FileReader();
      reader.onload = (readEvt) => {
        const dataUrl = readEvt.target.result;
        const year = selectCaptureYear.value;
        const month = selectCaptureMonth.value;

        let status = selectInspectStatus.value;
        if (status === '__custom__') {
          status = (inpInspectStatusCustom && inpInspectStatusCustom.value.trim()) ? inpInspectStatusCustom.value.trim() : 'معاينة الموقع';
        }
        const notes = inpInspectNotes.value.trim();
        const finalStatus = notes ? `${status} (${notes})` : status;
        const dateStr = month ? `${year}/${month}` : `${year}`;

        const existingIdx = capturedShots.findIndex(s => String(s.year) === String(year) && String(s.month || '') === String(month || ''));
        const shotRecord = {
          id: Date.now(),
          year: year,
          month: month,
          captureDate: dateStr,
          status: finalStatus,
          notes: notes,
          imageData: dataUrl
        };

        if (existingIdx !== -1) {
          capturedShots[existingIdx] = shotRecord;
        } else {
          capturedShots.push(shotRecord);
        }

        capturedShots.sort((a, b) => {
          const yrA = parseInt(a.year) || 0;
          const yrB = parseInt(b.year) || 0;
          if (yrA !== yrB) return yrA - yrB;
          return (parseInt(a.month) || 0) - (parseInt(b.month) || 0);
        });

        chrome.storage.local.set({ capturedShots: capturedShots }, () => {
          renderShotsGallery();
          updateShotsLimitUI();
          showToast(`✅ تم إضافة صورة ${dateStr} من الجهاز وتوثيقها بالمعرض!`);
        });

        inputLocalImage.value = '';
      };
      reader.readAsDataURL(file);
    });
  }

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

    // --- 9. OFFICIAL CITIZEN PACKAGE EXPORT (JSON + CSV + IMAGES) ---
  const btnExportPkg = document.getElementById('btn-export-citizen-package') || document.getElementById('btn-generate-docx');
  if (btnExportPkg) {
    btnExportPkg.addEventListener('click', async () => {
      if (!currentParcel) {
        alert('يرجى تحميل أو إدخال بيانات الرفع المساحي أولاً.');
        return;
      }

      if (capturedShots.length < 2) {
        alert('⚠️ بيان التسلسل الزمني يتطلب توثيق صورتين على الأقل (تدعم من 2 إلى 6 صور). يرجى التقاط صورتين لسنتين مختلفتين أولاً.');
        return;
      }

      btnExportPkg.disabled = true;
      btnExportPkg.innerHTML = '<span>⏳ جارٍ تجميع حزمة المواطن وضغط الصور...</span>';

      try {
        const committee = {
          surveyor: (document.getElementById('inp-surveyor') ? document.getElementById('inp-surveyor').value : '').trim() || 'مسؤول المتغيرات المكانية',
          reviewer: (document.getElementById('inp-reviewer') ? document.getElementById('inp-reviewer').value : '').trim() || 'د / عماد عبدالله احمد',
          director: (document.getElementById('inp-director') ? document.getElementById('inp-director').value : '').trim() || 'مروة محمد رضوان'
        };

        const citizenSafe = (currentParcel.applicantName || 'المواطن').replace(/[\/:*?"<>|]/g, '_').trim();
        const centerSafe = (currentParcel.centerCity || currentParcel.markaz || 'المركز').replace(/[\/:*?"<>|]/g, '_').trim();
        const baseName = `${citizenSafe}-${centerSafe}`;

        const zip = new JSZip();

        // 1. Session JSON for full 1-click restore
        const sessionPayload = {
          version: '3.0.0',
          exportedAt: new Date().toISOString(),
          parcel: currentParcel,
          committee: committee,
          capturedShots: capturedShots.map(s => ({
            id: s.id,
            year: s.year,
            month: s.month,
            label: s.label,
            status: s.status,
            notes: s.notes,
            dataUrl: s.dataUrl
          }))
        };
        zip.file(`${baseName}_بيانات_المشروع.json`, JSON.stringify(sessionPayload, null, 2));

        // 2. Polygon CSV
        const csvContent = GeoEngine.generatePolygonCsvContent(currentParcel, currentParcel.vertices);
        zip.file(`${baseName}_رفع_مساحي.csv`, "﻿" + csvContent);

        // 3. High-Res Satellite Photos folder
        const imgFolder = zip.folder("الصور_الفضائية_الموثقة");
        capturedShots.forEach((shot, idx) => {
          if (shot.dataUrl && shot.dataUrl.includes(',')) {
            const b64Data = shot.dataUrl.split(',')[1];
            const safeYear = shot.year || (idx + 1);
            const safeStatus = (shot.status || `صورة_${idx+1}`).replace(/[\/:*?"<>|]/g, '_');
            imgFolder.file(`${idx+1}_تصوير_${safeYear}_${safeStatus}.png`, b64Data, { base64: true });
          }
        });

        // 4. Generate Zip Blob
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        saveAs(zipBlob, `${baseName}_حزمة_المواطن.zip`);

        showToast(`📦 تم تنزيل حزمة المواطن المتكاملة: ${baseName}`);
      } catch (err) {
        console.error(err);
        alert('حدث خطأ أثناء تصدير الحزمة: ' + err.message);
      } finally {
        btnExportPkg.disabled = false;
        btnExportPkg.innerHTML = '<span>📦 تصدير حزمة المواطن المتكاملة (JSON + CSV + الصور الأصلية)</span>';
      }
    });
  }



  // --- GITHUB AUTO-UPDATE & EXTENSION RELOAD MANAGER ---
  const btnCheckUpdate = document.getElementById('btn-check-update');
  const modalUpdateDialog = document.getElementById('modal-update-dialog');
  const btnCloseUpdateModal = document.getElementById('btn-close-update-modal');
  const btnDismissUpdateModal = document.getElementById('btn-dismiss-update-modal');
  const btnRecheckUpdate = document.getElementById('btn-recheck-update');
  const lblCurrVersion = document.getElementById('lbl-curr-version');
  const lblRemoteVersion = document.getElementById('lbl-remote-version');
  const updateReleaseMeta = document.getElementById('update-release-meta');
  const lblReleaseTag = document.getElementById('lbl-release-tag');
  const lblReleaseDate = document.getElementById('lbl-release-date');
  const updateStatusMsg = document.getElementById('update-status-msg');
  const btnReloadExtension = document.getElementById('btn-reload-extension');
  const appVersionBadge = document.getElementById('app-version-badge');

  const currentLocalVersion = (chrome.runtime && chrome.runtime.getManifest) ? chrome.runtime.getManifest().version : '3.0.0';
  let currentLocalCommit = '2584f01';

  async function getLocalBuildInfo() {
    try {
      const res = await fetch(chrome.runtime.getURL('build_info.json'), { cache: 'no-store' });
      if (res.ok) {
        const info = await res.json();
        if (info.commit) currentLocalCommit = info.commit.substring(0, 7);
      }
    } catch (e) {
      if (chrome.storage && chrome.storage.local) {
        const s = await new Promise(r => chrome.storage.local.get(['installedCommit'], r));
        if (s && s.installedCommit) currentLocalCommit = s.installedCommit.substring(0, 7);
      }
    }
    if (lblCurrVersion) lblCurrVersion.textContent = `v${currentLocalVersion} (${currentLocalCommit})`;
    if (appVersionBadge) appVersionBadge.textContent = `v${currentLocalVersion}`;
    return currentLocalCommit;
  }

  // Load build info immediately
  getLocalBuildInfo();

  function compareVersions(v1, v2) {
    const p1 = String(v1).replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
    const p2 = String(v2).replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
    const len = Math.max(p1.length, p2.length);
    for (let i = 0; i < len; i++) {
      const a = p1[i] || 0;
      const b = p2[i] || 0;
      if (a > b) return 1;
      if (a < b) return -1;
    }
    return 0;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async function checkGithubUpdate(silent = false) {
    const updateModalBadge = document.getElementById('update-modal-badge');
    const updateCommitsContainer = document.getElementById('update-commits-container');

    await getLocalBuildInfo();

    if (!silent) {
      if (lblRemoteVersion) lblRemoteVersion.textContent = 'جارٍ الفحص...';
      if (updateReleaseMeta) updateReleaseMeta.style.display = 'none';
      if (updateModalBadge) {
        updateModalBadge.textContent = 'جارٍ الفحص...';
        updateModalBadge.style.color = '#38bdf8';
        updateModalBadge.style.borderColor = '#38bdf8';
        updateModalBadge.style.background = 'rgba(56, 189, 248, 0.2)';
      }
      if (updateStatusMsg) {
        updateStatusMsg.className = 'update-status-alert info';
        updateStatusMsg.innerHTML = '<span>🔍 جارٍ الاتصال بمستودع GitHub وجلب سجل التحديثات...</span>';
      }
      if (updateCommitsContainer) updateCommitsContainer.style.display = 'none';
    }

    try {
      let remoteVersion = null;
      let releaseTitle = null;
      let releaseDateStr = null;
      let incomingCommits = [];

      // 1. Fetch recent commits from GitHub main branch
      try {
        const cRes = await fetch('https://api.github.com/repos/KillD00zer/certi_changes_overtime/commits?per_page=5', { cache: 'no-store' });
        if (cRes.ok) {
          const cData = await cRes.json();
          if (Array.isArray(cData)) {
            incomingCommits = cData;
            if (incomingCommits.length > 0 && incomingCommits[0].commit) {
              const cDate = new Date(incomingCommits[0].commit.committer.date);
              const dateStr = cDate.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
              const sha = incomingCommits[0].sha ? incomingCommits[0].sha.substring(0, 7) : '';
              releaseDateStr = `آخر تحديث: ${dateStr} (${sha})`;
            }
          }
        }
      } catch (cErr) {
        console.warn('[Update] Commits API warning:', cErr);
      }

      // 2. Fetch manifest.json from main branch
      try {
        const manifestUrl = `https://raw.githubusercontent.com/KillD00zer/certi_changes_overtime/main/extension/manifest.json?t=${Date.now()}`;
        const mRes = await fetch(manifestUrl, { cache: 'no-store' });
        if (mRes.ok) {
          const mData = await mRes.json();
          const manifestVer = (mData.version || '').trim();
          if (manifestVer) {
            remoteVersion = manifestVer;
            releaseTitle = `v${manifestVer}`;
          }
        }
      } catch (mErr) {
        console.warn('[Update] Raw manifest warning:', mErr);
      }

      const remoteCommitSha = (incomingCommits.length > 0 && incomingCommits[0].sha) ? incomingCommits[0].sha.substring(0, 7) : null;
      const cleanRemoteVer = remoteVersion ? (remoteVersion.startsWith('v') ? remoteVersion : `v${remoteVersion}`) : `v${currentLocalVersion}`;
      const cleanLocalVer = currentLocalVersion.startsWith('v') ? currentLocalVersion : `v${currentLocalVersion}`;

      if (lblRemoteVersion) lblRemoteVersion.textContent = remoteCommitSha ? `${cleanRemoteVer} (${remoteCommitSha})` : cleanRemoteVer;
      if (lblCurrVersion) lblCurrVersion.textContent = `${cleanLocalVer} (${currentLocalCommit})`;

      if (updateReleaseMeta) {
        updateReleaseMeta.style.display = 'flex';
        if (lblReleaseTag) lblReleaseTag.textContent = releaseTitle || cleanRemoteVer;
        if (lblReleaseDate) lblReleaseDate.textContent = releaseDateStr || '';
      }

      // Check update by Version OR by Commit Hash
      const hasVersionBump = remoteVersion && compareVersions(remoteVersion, currentLocalVersion) > 0;
      const hasNewCommit = remoteCommitSha && remoteCommitSha !== currentLocalCommit;
      const isUpdateAvailable = hasVersionBump || hasNewCommit;

      if (isUpdateAvailable) {
        // Newer version/commit available!
        if (btnCheckUpdate) {
          btnCheckUpdate.classList.add('has-update');
          btnCheckUpdate.title = `🚀 يتوفر تحديث جديد (${remoteCommitSha || cleanRemoteVer})!`;
        }
        if (lblRemoteVersion) lblRemoteVersion.style.color = '#38bdf8';
        if (updateModalBadge) {
          updateModalBadge.textContent = 'يتوفر تحديث جديد 🚀';
          updateModalBadge.style.color = '#38bdf8';
          updateModalBadge.style.borderColor = '#38bdf8';
          updateModalBadge.style.background = 'rgba(56, 189, 248, 0.2)';
        }
        if (updateStatusMsg) {
          updateStatusMsg.className = 'update-status-alert warning';
          updateStatusMsg.innerHTML = `<span>🚀 <strong>يتوفر كود جديد منشور على GitHub بانتظار السحب والتطبيق!</strong><br>الكوميت المثبت محلياً: <code>${currentLocalCommit}</code> ⬅️ أحدث كوميت على GitHub: <code>${remoteCommitSha || cleanRemoteVer}</code>.<br>انقر على زر <strong>سحب وتطبيق التحديث</strong> بالأسفل لتحديث المنظومة فوراً.</span>`;
        }
      } else {
        // Up to date!
        if (btnCheckUpdate) btnCheckUpdate.classList.remove('has-update');
        if (lblRemoteVersion) lblRemoteVersion.style.color = '#34d399';
        if (updateModalBadge) {
          updateModalBadge.textContent = 'محدث بالكامل ✔';
          updateModalBadge.style.color = '#34d399';
          updateModalBadge.style.borderColor = '#34d399';
          updateModalBadge.style.background = 'rgba(16, 185, 129, 0.2)';
        }
        if (updateStatusMsg) {
          updateStatusMsg.className = 'update-status-alert success';
          updateStatusMsg.innerHTML = `<span>✅ <strong>المنظومة محدثة بالكامل لأحدث إصدار وكود منشور!</strong><br>أنت تعمل على أحدث كوميت رسمي (<code>${currentLocalCommit}</code>) ولا توجد أي تعديلات جديدة حالياً.</span>`;
        }
      }

      // Render incoming commits list
      if (updateCommitsContainer && incomingCommits.length > 0) {
        updateCommitsContainer.style.display = 'flex';
        updateCommitsContainer.style.flexDirection = 'column';
        updateCommitsContainer.style.gap = '6px';
        updateCommitsContainer.innerHTML = '<div style="font-weight: 700; color: #bae6fd; margin-bottom: 2px;">📝 سجل أحدث التعديلات المنشورة على GitHub:</div>';

        incomingCommits.slice(0, 4).forEach((item) => {
          const c = item.commit;
          if (!c) return;
          const fullMsg = c.message || '';
          const parts = fullMsg.split('\n');
          const subject = parts[0] || 'تحديث برمجي';
          const body = parts.slice(1).join('\n').trim();
          const sha = item.sha ? item.sha.substring(0, 7) : '';
          const isCurrent = sha === currentLocalCommit;
          const dateStr = c.author && c.author.date ? new Date(c.author.date).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

          const card = document.createElement('div');
          card.style.cssText = `background: rgba(15, 23, 42, 0.6); border: 1px solid ${isCurrent ? '#34d399' : 'rgba(56, 189, 248, 0.25)'}; border-radius: 6px; padding: 6px 10px; font-size: 11px;`;
          card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px;">
              <span style="font-weight: 700; color: #f8fafc;">⚡ ${escapeHtml(subject)}</span>
              <span style="font-family: monospace; font-size: 10px; background: ${isCurrent ? 'rgba(52, 211, 153, 0.2)' : 'rgba(56, 189, 248, 0.15)'}; color: ${isCurrent ? '#34d399' : '#38bdf8'}; padding: 1px 5px; border-radius: 3px;">${escapeHtml(sha)}${isCurrent ? ' (الحالي)' : ''}</span>
            </div>
            <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">
              <span>🕒 ${escapeHtml(dateStr)}</span>
            </div>
            ${body ? `<div style="font-size: 10.5px; color: #cbd5e1; background: rgba(0,0,0,0.25); border-right: 2px solid #38bdf8; padding: 4px 6px; margin-top: 4px; border-radius: 3px; white-space: pre-wrap;">${escapeHtml(body)}</div>` : ''}
          `;
          updateCommitsContainer.appendChild(card);
        });
      }
    } catch (e) {
      console.warn('[Update] Error checking update:', e);
      if (!silent) {
        if (lblRemoteVersion) lblRemoteVersion.textContent = 'غير متصل';
        if (updateModalBadge) {
          updateModalBadge.textContent = 'تعذر الاتصال';
          updateModalBadge.style.color = '#f87171';
          updateModalBadge.style.borderColor = '#f87171';
          updateModalBadge.style.background = 'rgba(239, 68, 68, 0.2)';
        }
        if (updateStatusMsg) {
          updateStatusMsg.className = 'update-status-alert info';
          updateStatusMsg.innerHTML = `<span>💡 تعذر الاتصال بـ GitHub. يرجى التأكد من اتصال الإنترنت ثم النقر على [إعادة الفحص].</span>`;
        }
      }
    }
  }

  if (btnReloadExtension) {
    btnReloadExtension.addEventListener('click', async () => {
      btnReloadExtension.disabled = true;
      btnReloadExtension.innerHTML = '⏳ جارٍ الاتصال بمحرك التحديث وسحب الكود...';
      showToast('🔄 جارٍ سحب التحديثات وتطبيقها...');

      let pullSuccess = false;
      let newSha = null;

      try {
        const ctrl = new AbortController();
        const timeoutId = setTimeout(() => ctrl.abort(), 12000);

        const res = await fetch('http://127.0.0.1:8766/update', {
          method: 'POST',
          signal: ctrl.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (data && data.success) {
            pullSuccess = true;
            newSha = data.commit;
            if (newSha) {
              currentLocalCommit = newSha;
              if (chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({ installedCommit: newSha });
              }
            }
          }
        }
      } catch (netErr) {
        console.warn('[Updater] Local service not reachable or timed out:', netErr);
      }

      if (pullSuccess) {
        btnReloadExtension.innerHTML = `✅ تم التحديث بنجاح (${newSha})! جارٍ التنشيط...`;
        btnReloadExtension.style.background = 'linear-gradient(135deg, #10b981, #059669)';
        showToast(`🎉 تم سحب وتطبيق التحديث (${newSha}) بنجاح! جارٍ تنشيط الإضافة...`);

        setTimeout(() => {
          if (chrome.runtime && chrome.runtime.reload) {
            chrome.runtime.reload();
          }
          setTimeout(() => {
            window.location.reload();
          }, 600);
        }, 1000);
      } else {
        // Fallback: Local updater service wasn't running
        btnReloadExtension.disabled = false;
        btnReloadExtension.innerHTML = '🔄 إعادة تحميل وتنشيط الإضافة';
        btnReloadExtension.style.background = 'linear-gradient(135deg, #0284c7, #0369a1)';

        if (updateStatusMsg) {
          updateStatusMsg.className = 'update-status-alert warning';
          updateStatusMsg.innerHTML = `
            <span>💡 <strong>لتطبيق التحديث على ملفات النظام تلقائياً:</strong><br>
            شغّل ملف <code style="color:#38bdf8; font-weight: bold;">تحديث_المنظومة.bat</code> الموجود بمجلد البرنامج لسحب أحدث ملفات،<br>
            ثم انقر على زر <strong>إعادة تحميل وتنشيط الإضافة</strong> بالأسفل.</span>
          `;
        }

        showToast('💡 لسحب التحديث: شغّل تحديث_المنظومة.bat ثم اضغط إعادة التحميل');

        btnReloadExtension.onclick = () => {
          btnReloadExtension.disabled = true;
          btnReloadExtension.innerHTML = '⏳ جارٍ إعادة التحميل...';
          showToast('🔄 جارٍ إعادة تشغيل الإضافة وتفريغ الذاكرة...');
          setTimeout(() => {
            if (chrome.runtime && chrome.runtime.reload) {
              chrome.runtime.reload();
            }
            setTimeout(() => {
              window.location.reload();
            }, 600);
          }, 400);
        };
      }
    });
  }

  // --- Open & Close Update Modal Listeners ---
  if (btnCheckUpdate && modalUpdateDialog) {
    btnCheckUpdate.addEventListener('click', (e) => {
      e.preventDefault();
      modalUpdateDialog.style.display = 'flex';
      checkGithubUpdate(false);
    });
  }

  if (btnCloseUpdateModal && modalUpdateDialog) {
    btnCloseUpdateModal.addEventListener('click', () => {
      modalUpdateDialog.style.display = 'none';
    });
  }

  if (btnDismissUpdateModal && modalUpdateDialog) {
    btnDismissUpdateModal.addEventListener('click', () => {
      modalUpdateDialog.style.display = 'none';
    });
  }

  if (btnRecheckUpdate) {
    btnRecheckUpdate.addEventListener('click', () => {
      checkGithubUpdate(false);
    });
  }

  if (modalUpdateDialog) {
    modalUpdateDialog.addEventListener('click', (e) => {
      if (e.target === modalUpdateDialog) {
        modalUpdateDialog.style.display = 'none';
      }
    });
  }

  // Auto-save listeners on text inputs
  ['inp-name', 'inp-nat-id', 'inp-center', 'inp-village', 'inp-place',
   'inp-man-name', 'inp-man-nat-id', 'inp-man-id-no', 'inp-man-center', 'inp-man-sheikhah', 'inp-man-place',
   'inp-surveyor', 'inp-director', 'inp-reviewer'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => {
        if (currentParcel) {
          if (id === 'inp-name' || id === 'inp-man-name') currentParcel.applicantName = el.value.trim();
          if (id === 'inp-nat-id' || id === 'inp-man-nat-id') currentParcel.nationalId = el.value.trim();
          if (id === 'inp-center' || id === 'inp-man-center') currentParcel.centerCity = el.value.trim();
          if (id === 'inp-village' || id === 'inp-man-sheikhah') currentParcel.village = el.value.trim();
          if (id === 'inp-place' || id === 'inp-man-place') currentParcel.place = el.value.trim();
        }
        scheduleAutoSave();
      });
    }
  });

  // Auto-restore check on startup
  setTimeout(() => {
    if (!currentParcel && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['currentParcel', 'capturedShots', 'lastAutoSaveTime'], (res) => {
        if (res.currentParcel && res.currentParcel.vertices && res.currentParcel.vertices.length > 0) {
          const cName = res.currentParcel.applicantName || 'المواطن';
          const time = res.lastAutoSaveTime || 'سابقاً';
          const restore = confirm(`📂 تم العثور على مسودة عمل سابقة محفوظة تلقائياً لـ (${cName} - ${time}).\nهل تريد استعادتها ومتابعة العمل عليها؟`);
          if (restore) {
            currentParcel = res.currentParcel;
            displayParcel(currentParcel);
            if (res.capturedShots && Array.isArray(res.capturedShots)) {
              capturedShots = res.capturedShots;
              renderShotsGallery();
            }
            flyEarthTabToParcel(currentParcel);
            showToast(`📂 تم استرجاع جلسة العمل بنجاح: ${cName}`);
          }
        }
      });
    }
  }, 1000);

});