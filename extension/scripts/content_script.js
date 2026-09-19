/**
 * Content Script for Google Earth Web Survey Extension
 * Injected into https://earth.google.com/web/*
 * Displays accurate SVG parcel overlay on top of satellite imagery,
 * keeps polygon visible in screenshots, and enables instant captures.
 */

(function () {
  // Prevent duplicate execution
  if (window.__earthSurveyInjected) {
    if (typeof window.__earthSurveyRefresh === 'function') {
      window.__earthSurveyRefresh();
    }
    return;
  }
  window.__earthSurveyInjected = true;

  console.log('[EarthSurvey] Content Script initialized on Google Earth Web.');

  let currentParcel = null;
  let selectedYear = new Date().getFullYear();
  let root = null;
  let lastCameraKey = '';

  function ensureRoot() {
    let r = document.getElementById('earth-survey-hud-root');
    if (!r) {
      r = document.createElement('div');
      r.id = 'earth-survey-hud-root';
      if (document.body) {
        document.body.appendChild(r);
      }
    }
    if (r) {
      r.style.cssText = `
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        pointer-events: none !important;
        z-index: 9999999 !important;
        display: block !important;
      `;
    }
    root = r;
    return r;
  }

  // Load parcel from storage on startup
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['currentParcel', 'selectedYear'], (res) => {
      if (res.currentParcel) {
        currentParcel = res.currentParcel;
      }
      if (res.selectedYear) {
        selectedYear = res.selectedYear;
      }
      renderOverlay();
    });

    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local') {
        if (changes.currentParcel) {
          currentParcel = changes.currentParcel.newValue;
          renderOverlay();
        }
        if (changes.selectedYear) {
          selectedYear = changes.selectedYear.newValue;
        }
      }
    });
  }

  function getCameraFromUrl() {
    try {
      const href = window.location.href;
      const match = href.match(/@([0-9.-]+),([0-9.-]+),([0-9.-]+)a,([0-9.-]+)d/);
      if (match) {
        return {
          lat: parseFloat(match[1]),
          lon: parseFloat(match[2]),
          alt: parseFloat(match[3]),
          distance: parseFloat(match[4])
        };
      }
    } catch (e) {}
    return null;
  }

  function hideUiForCapture() {
    const hiddenEls = [];
    try {
      const selectors = [
        'header',
        'earth-header',
        'earth-historical-imagery',
        'earth-navigation',
        'earth-toolbar',
        'earth-search',
        '.widget-scene-canvas-overlay',
        '[role="toolbar"]',
        '[role="navigation"]',
        '[class*="historical"]',
        '[class*="timeline"]',
        '[class*="navigation"]',
        '[class*="minimap"]',
        '[class*="status"]'
      ];

      selectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
          if (el.id !== 'earth-survey-hud-root' && el.style.visibility !== 'hidden') {
            el.dataset.prevVis = el.style.visibility;
            el.style.setProperty('visibility', 'hidden', 'important');
            hiddenEls.push(el);
          }
        });
      });
    } catch (e) {
      console.warn('[EarthSurvey] hideUiForCapture error:', e);
    }

    return () => {
      hiddenEls.forEach(el => {
        if (el.dataset.prevVis) {
          el.style.visibility = el.dataset.prevVis;
          delete el.dataset.prevVis;
        } else {
          el.style.removeProperty('visibility');
        }
      });
    };
  }

  function getMapBounds() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;

    // Symmetrical vertical crop:
    // Top 140px removes: Google Earth top header, search bar, and Historical Imagery timeline bar
    // Bottom 140px removes: camera navigation controls (compass, 3D, street view, zoom), minimap, and status bar
    // Symmetrical top = bottom keeps the parcel centered at h / 2 perfectly in the middle of the frame!
    const cropMarginY = 140;
    let top = cropMarginY;
    let bottom = Math.max(top + 100, h - cropMarginY);
    let left = 0;
    let right = w;

    try {
      // Test if left drawer is open
      const elAtLeft = document.elementFromPoint(50, Math.round(h / 2));
      if (elAtLeft) {
        const tag = elAtLeft.tagName.toLowerCase();
        if (tag !== 'canvas' && elAtLeft.id !== 'earth-survey-hud-root') {
          let p = elAtLeft;
          while (p && p !== document.body) {
            const rect = p.getBoundingClientRect();
            if (rect.width >= 180 && rect.width <= 450 && rect.left <= 30) {
              left = Math.round(rect.right);
              break;
            }
            p = p.parentElement;
          }
        }
      }
    } catch (e) {
      console.warn('[EarthSurvey] Could not detect drawer width dynamically:', e);
    }

    return {
      x: Math.max(0, left),
      y: Math.max(0, top),
      width: Math.max(200, right - left),
      height: Math.max(200, bottom - top),
      dpr: dpr
    };
  }

  function renderOverlay() {
    ensureRoot();
    if (!root) return;

    if (!currentParcel || !currentParcel.vertices || currentParcel.vertices.length < 3) {
      const oldSvg = document.getElementById('earth-parcel-svg');
      if (oldSvg) oldSvg.remove();
      return;
    }

    const w = Math.max(window.innerWidth, 800);
    const h = Math.max(window.innerHeight, 600);

    // Remove existing SVG
    let oldSvg = document.getElementById('earth-parcel-svg');
    if (oldSvg) oldSvg.remove();

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'earth-parcel-svg';
    svg.setAttribute('class', 'earth-parcel-svg-overlay');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      display: block !important;
    `;

    // Camera parameter resolution
    const cam = getCameraFromUrl();
    const D = (cam && cam.distance > 10) ? cam.distance : (currentParcel.optimalDistance || 300);
    const centerLat = (cam && cam.lat) ? cam.lat : currentParcel.center.lat;
    const centerLon = (cam && cam.lon) ? cam.lon : currentParcel.center.lon;

    // FOV = 35 deg (Google Earth default 35y)
    const groundSpanHeight = 2.0 * D * Math.tan((35.0 / 2.0) * (Math.PI / 180.0));
    const metersPerPixel = groundSpanHeight / h;

    const meanLatRad = centerLat * (Math.PI / 180.0);
    const mPerDegLat = 111132.92 - 559.82 * Math.cos(2 * meanLatRad);
    const mPerDegLon = 111412.84 * Math.cos(meanLatRad);

    const cx = w / 2.0;
    const cy = h / 2.0;

    const points = currentParcel.vertices.map((v) => {
      const dLonM = (v.lon - centerLon) * mPerDegLon;
      const dLatM = (v.lat - centerLat) * mPerDegLat;

      const px = cx + (dLonM / metersPerPixel);
      const py = cy - (dLatM / metersPerPixel);
      return { x: px, y: py, id: v.id || v.index };
    });

    const ptsStr = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

    // SVG Defs (glow filter)
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <filter id="hud-glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    `;
    svg.appendChild(defs);

    // Polygon element: vibrant red outline, transparent inside for 100% clear satellite view
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', ptsStr);
    polygon.setAttribute('fill', 'none');
    polygon.setAttribute('stroke', '#ef4444');
    polygon.setAttribute('stroke-width', '3.5');
    polygon.setAttribute('stroke-linejoin', 'round');
    polygon.setAttribute('filter', 'url(#hud-glow)');
    svg.appendChild(polygon);

    // Vertex Markers & Numbers (1, 2, 3, 4)
    points.forEach((p) => {
      // Circle on vertex
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', p.x);
      circle.setAttribute('cy', p.y);
      circle.setAttribute('r', '7');
      circle.setAttribute('fill', '#22c55e');
      circle.setAttribute('stroke', '#ffffff');
      circle.setAttribute('stroke-width', '2');
      svg.appendChild(circle);

      // Number badge background
      const textBg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      textBg.setAttribute('cx', p.x + 14);
      textBg.setAttribute('cy', p.y - 12);
      textBg.setAttribute('r', '9');
      textBg.setAttribute('fill', '#0f172a');
      textBg.setAttribute('stroke', '#38bdf8');
      textBg.setAttribute('stroke-width', '1.5');
      svg.appendChild(textBg);

      // Text label
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', p.x + 14);
      text.setAttribute('y', p.y - 8);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', '#ffffff');
      text.setAttribute('font-size', '10');
      text.setAttribute('font-weight', 'bold');
      text.textContent = p.id;
      svg.appendChild(text);
    });

    root.appendChild(svg);
  }

  window.__earthSurveyRefresh = renderOverlay;

  // Runtime message listener
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'GET_MAP_BOUNDS') {
      // IMPORTANT: Keep root visible so SVG polygon appears inside the screenshot!
      ensureRoot();
      if (root) root.style.display = 'block';

      // Temporarily hide Google Earth UI toolbars for 650ms during capture
      const restoreUi = hideUiForCapture();
      setTimeout(restoreUi, 650);

      const bounds = getMapBounds();
      sendResponse(bounds);
      return true;
    }

    if (msg.action === 'UPDATE_PARCEL') {
      currentParcel = msg.parcel;
      renderOverlay();
      sendResponse({ success: true });
      return true;
    }

    if (msg.action === 'CLEAR_PARCEL') {
      currentParcel = null;
      const oldSvg = document.getElementById('earth-parcel-svg');
      if (oldSvg) oldSvg.remove();
      sendResponse({ success: true });
      return true;
    }

    if (msg.action === 'NAVIGATE_TO_PARCEL') {
      if (msg.url) {
        window.location.hash = '';
        window.location.href = msg.url;
        setTimeout(renderOverlay, 1500);
      }
      sendResponse({ success: true });
      return true;
    }

    if (msg.action === 'CENTER_CAMERA') {
      centerCamera();
      sendResponse({ success: true });
      return true;
    }

    if (msg.action === 'TOGGLE_POLYGON') {
      ensureRoot();
      const svg = document.getElementById('earth-parcel-svg');
      if (svg) {
        const isHidden = (svg.style.display === 'none');
        svg.style.display = isHidden ? 'block' : 'none';
        sendResponse({ success: true, visible: isHidden });
      } else {
        renderOverlay();
        sendResponse({ success: true, visible: true });
      }
      return true;
    }

    if (msg.action === 'SHOW_TOAST') {
      showToast(msg.message || '');
      sendResponse({ success: true });
      return true;
    }

    if (msg.action === 'PROCESS_AND_SAVE_CAPTURE') {
      processAndSaveCapture(msg.dataUrl, msg.bounds, (res) => {
        sendResponse(res);
      });
      return true;
    }
  });

  function centerCamera() {
    if (currentParcel && currentParcel.earthUrl) {
      window.location.hash = '';
      window.location.href = currentParcel.earthUrl;
      setTimeout(renderOverlay, 1200);
    }
  }

  function processAndSaveCapture(rawUrl, bounds, callback) {
    cropImage(rawUrl, bounds, (croppedUrl) => {
      chrome.storage.local.get(['capturedShots', 'selectedYear'], (store) => {
        const shots = store.capturedShots || [];
        const yr = store.selectedYear || selectedYear || new Date().getFullYear();
        const dateStr = new Date().toISOString().split('T')[0];

        const newShot = {
          id: Date.now(),
          year: yr,
          captureDate: dateStr,
          imageData: croppedUrl,
          status: 'أرض فضاء / لم يطرأ تغيير إنشائي',
          notes: 'تم الالتقاط وتوثيق الحدود والمضلع بدقة عالية عبر Google Earth Web'
        };

        const existingIdx = shots.findIndex(s => String(s.year) === String(yr));
        if (existingIdx >= 0) {
          shots[existingIdx] = newShot;
        } else {
          shots.push(newShot);
        }

        shots.sort((a, b) => parseInt(a.year) - parseInt(b.year));

        chrome.storage.local.set({ capturedShots: shots }, () => {
          showToast(`✅ تم حفظ لقطة خريطة سنة ${yr} وتوثيق المضلع بالمعرض بنجاح!`);
          if (callback) callback({ success: true });
        });
      });
    });
  }

  function cropImage(dataUrl, bounds, callback) {
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

      // Clamping
      if (cropX < 0) cropX = 0;
      if (cropY < 0) cropY = 0;
      if (cropX + cropW > rawW) cropW = rawW - cropX;
      if (cropY + cropH > rawH) cropH = rawH - cropY;

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(cropW, 10);
      canvas.height = Math.max(cropH, 10);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

      const cropped = canvas.toDataURL('image/jpeg', 0.95);
      callback(cropped);
    };
    img.onerror = () => {
      callback(dataUrl);
    };
    img.src = dataUrl;
  }

  function showToast(msg) {
    const existing = document.getElementById('earth-survey-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'earth-survey-toast';
    toast.style.cssText = `
      position: fixed;
      bottom: 28px;
      right: 28px;
      background: rgba(15, 23, 42, 0.95);
      backdrop-filter: blur(12px);
      color: #38bdf8;
      border: 1px solid rgba(56, 189, 248, 0.4);
      padding: 12px 22px;
      border-radius: 10px;
      font-weight: 700;
      font-size: 14px;
      box-shadow: 0 12px 30px rgba(0,0,0,0.6);
      z-index: 10000000;
      direction: rtl;
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      transition: opacity 0.3s ease;
      pointer-events: auto;
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 350);
    }, 4000);
  }

  // Monitor camera position in URL to update overlay when user pans/zooms
  setInterval(() => {
    if (!currentParcel) return;
    const cam = getCameraFromUrl();
    if (cam) {
      const key = `${cam.lat.toFixed(5)}_${cam.lon.toFixed(5)}_${Math.round(cam.distance)}`;
      if (key !== lastCameraKey) {
        lastCameraKey = key;
        renderOverlay();
      }
    }
  }, 700);

  // Resize listener
  window.addEventListener('resize', () => {
    if (currentParcel) {
      renderOverlay();
    }
  });

})();
