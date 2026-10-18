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
  let isPolygonVisible = true;
  let overlayMode = 'polygon'; // 'polygon' | 'point'
  let isOverlayLocked = true; // Lock/Unlock coordinate plotting
  let overlayOffset = { dLat: 0, dLon: 0 }; // Lat/Lon adjustment for tilt/angle
  let pinTextColor = '#fbbf24'; // Customizable text & marker color
  let pinTextSize = 12; // Customizable text size (px)
  let pinCustomText = '🎯 المركز'; // Customizable label text
  let pinTextPosition = 'below'; // 'above' | 'below' | 'right' | 'left'
  let pinShowBg = true; // boolean: show/hide dark background badge

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
        display: ${isPolygonVisible ? 'block' : 'none'} !important;
      `;
    }
    root = r;
    return r;
  }

  function saveOverlayOffset() {
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        overlayOffset: overlayOffset,
        isOverlayLocked: isOverlayLocked
      });
    }
  }

  // Load parcel, overlay mode, and lock/offset/pin styles from storage on startup
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get([
      'currentParcel',
      'selectedYear',
      'overlayMode',
      'isOverlayLocked',
      'overlayOffset',
      'pinTextColor',
      'pinTextSize',
      'pinCustomText',
      'pinTextPosition',
      'pinShowBg'
    ], (res) => {
      if (res.currentParcel) {
        currentParcel = res.currentParcel;
      }
      if (res.selectedYear) {
        selectedYear = res.selectedYear;
      }
      if (res.overlayMode) {
        overlayMode = res.overlayMode;
      }
      if (res.isOverlayLocked !== undefined) {
        isOverlayLocked = res.isOverlayLocked;
      }
      if (res.overlayOffset) {
        overlayOffset = res.overlayOffset;
      }
      if (res.pinTextColor) {
        pinTextColor = res.pinTextColor;
      }
      if (res.pinTextSize) {
        pinTextSize = Number(res.pinTextSize);
      }
      if (res.pinCustomText !== undefined) {
        pinCustomText = res.pinCustomText;
      }
      if (res.pinTextPosition) {
        pinTextPosition = res.pinTextPosition;
      }
      if (res.pinShowBg !== undefined) {
        pinShowBg = res.pinShowBg;
      }
      renderOverlay();
    });

    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local') {
        let needRerender = false;
        if (changes.currentParcel) {
          currentParcel = changes.currentParcel.newValue;
          needRerender = true;
        }
        if (changes.selectedYear) {
          selectedYear = changes.selectedYear.newValue;
        }
        if (changes.overlayMode) {
          overlayMode = changes.overlayMode.newValue || 'polygon';
          needRerender = true;
        }
        if (changes.isOverlayLocked !== undefined) {
          isOverlayLocked = changes.isOverlayLocked.newValue;
          needRerender = true;
        }
        if (changes.overlayOffset) {
          overlayOffset = changes.overlayOffset.newValue || { dLat: 0, dLon: 0 };
          needRerender = true;
        }
        if (changes.pinTextColor) {
          pinTextColor = changes.pinTextColor.newValue || '#fbbf24';
          needRerender = true;
        }
        if (changes.pinTextSize) {
          pinTextSize = Number(changes.pinTextSize.newValue) || 12;
          needRerender = true;
        }
        if (changes.pinCustomText !== undefined) {
          pinCustomText = changes.pinCustomText.newValue;
          needRerender = true;
        }
        if (changes.pinTextPosition) {
          pinTextPosition = changes.pinTextPosition.newValue || 'below';
          needRerender = true;
        }
        if (changes.pinShowBg !== undefined) {
          pinShowBg = changes.pinShowBg.newValue !== false;
          needRerender = true;
        }
        if (needRerender) {
          renderOverlay();
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
        '#earth-survey-nudge-hud',
        'header',
        'earth-header',
        'earth-historical-imagery',
        'earth-navigation',
        'earth-toolbar',
        'earth-search',
        'earth-drawer',
        '.widget-scene-canvas-overlay',
        '[role="toolbar"]',
        '[role="navigation"]',
        '[class*="historical"]',
        '[class*="timeline"]',
        '[class*="navigation"]',
        '[class*="minimap"]',
        '[class*="status"]',
        '[class*="drawer"]',
        '[class*="sidebar"]'
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
      display: ${isPolygonVisible ? 'block' : 'none'} !important;
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

    const offLat = (overlayOffset && overlayOffset.dLat) || 0;
    const offLon = (overlayOffset && overlayOffset.dLon) || 0;

    const points = currentParcel.vertices.map((v) => {
      const dLonM = (v.lon + offLon - centerLon) * mPerDegLon;
      const dLatM = (v.lat + offLat - centerLat) * mPerDegLat;

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

    if (overlayMode === 'point') {
      // MODE 2: Center Point with subtle applicant name badge
      let ptX, ptY;
      const cLon = (currentParcel.centroid && (currentParcel.centroid.lon !== undefined ? currentParcel.centroid.lon : currentParcel.centroid.lng)) ||
                   (currentParcel.center && (currentParcel.center.lon !== undefined ? currentParcel.center.lon : currentParcel.center.lng)) ||
                   currentParcel.centerLng;
      const cLat = (currentParcel.centroid && (currentParcel.centroid.lat !== undefined ? currentParcel.centroid.lat : currentParcel.centroid.latitude)) ||
                   (currentParcel.center && (currentParcel.center.lat !== undefined ? currentParcel.center.lat : currentParcel.center.latitude)) ||
                   currentParcel.centerLat;
      if (cLon && cLat && !isNaN(cLon) && !isNaN(cLat)) {
        const offsetLon = Number(cLon) + offLon;
        const offsetLat = Number(cLat) + offLat;
        const cDxM = (offsetLon - centerLon) * mPerDegLon;
        const cDyM = (offsetLat - centerLat) * mPerDegLat;
        ptX = cx + (cDxM / metersPerPixel);
        ptY = cy - (cDyM / metersPerPixel);
      } else {
        let distinct = points;
        if (points.length > 3) {
          const first = points[0];
          const last = points[points.length - 1];
          if (Math.abs(first.x - last.x) < 0.5 && Math.abs(first.y - last.y) < 0.5) {
            distinct = points.slice(0, points.length - 1);
          }
        }
        let sumX = 0, sumY = 0;
        distinct.forEach(p => { sumX += p.x; sumY += p.y; });
        ptX = sumX / distinct.length;
        ptY = sumY / distinct.length;
      }

      const centerGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      centerGroup.setAttribute('class', 'earth-center-point-marker');
      centerGroup.setAttribute('title', `📍 موقع المعاملة (اسحب بالفأرة لتعديل الموضع): ${Number(cLon).toFixed(6)}, ${Number(cLat).toFixed(6)}`);
      centerGroup.style.cursor = 'grab';

      // Hit area
      const cHitArea = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      cHitArea.setAttribute('cx', ptX);
      cHitArea.setAttribute('cy', ptY);
      cHitArea.setAttribute('r', '24');
      cHitArea.setAttribute('fill', 'transparent');
      centerGroup.appendChild(cHitArea);

      // 1. Radar Glowing Target Ring (Red / Rose for Location Pin)
      const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      ring.setAttribute('cx', ptX);
      ring.setAttribute('cy', ptY);
      ring.setAttribute('r', isOverlayLocked ? '12' : '15');
      ring.setAttribute('fill', 'rgba(239, 68, 68, 0.25)');
      ring.setAttribute('stroke', '#ef4444');
      ring.setAttribute('stroke-width', '2');
      if (!isOverlayLocked) {
        ring.setAttribute('stroke-dasharray', '4,3');
      }
      centerGroup.appendChild(ring);

      // 2. Teardrop Location Pin Path 📍
      const pinPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      pinPath.setAttribute('d', `M ${ptX},${ptY} C ${ptX-8},${ptY-12} ${ptX-10},${ptY-22} ${ptX},${ptY-22} C ${ptX+10},${ptY-22} ${ptX+8},${ptY-12} ${ptX},${ptY} Z`);
      pinPath.setAttribute('fill', '#ef4444');
      pinPath.setAttribute('stroke', '#ffffff');
      pinPath.setAttribute('stroke-width', '1.5');
      centerGroup.appendChild(pinPath);

      // 3. Inner White Dot inside pin head
      const pinHeadDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      pinHeadDot.setAttribute('cx', ptX);
      pinHeadDot.setAttribute('cy', ptY - 15);
      pinHeadDot.setAttribute('r', '3');
      pinHeadDot.setAttribute('fill', '#ffffff');
      centerGroup.appendChild(pinHeadDot);

      // 4. Subtle Crosshair Ticks
      [
        { x1: ptX - 18, y1: ptY, x2: ptX - 12, y2: ptY },
        { x1: ptX + 12, y1: ptY, x2: ptX + 18, y2: ptY },
        { x1: ptX, y1: ptY - 26, x2: ptX, y2: ptY - 20 },
        { x1: ptX, y1: ptY + 6, x2: ptX, y2: ptY + 12 }
      ].forEach(coord => {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', coord.x1);
        line.setAttribute('y1', coord.y1);
        line.setAttribute('x2', coord.x2);
        line.setAttribute('y2', coord.y2);
        line.setAttribute('stroke', '#ef4444');
        line.setAttribute('stroke-width', '1.5');
        centerGroup.appendChild(line);
      });

      // 5. Applicant Name Label
      const currentTextColor = pinTextColor || '#ffffff';
      const currentFontSize = pinTextSize || 12;
      const applicantName = (pinCustomText && pinCustomText !== '🎯 المركز' ? pinCustomText : (currentParcel.applicantName || currentParcel.name || 'موقع المعاملة')).trim();
      const currentPosition = pinTextPosition || 'below';
      const isShowBg = pinShowBg !== false;

      const approxCharWidth = currentFontSize * 0.72;
      const badgePadding = 12;
      const badgeWidth = Math.max(60, Math.round(applicantName.length * approxCharWidth + badgePadding * 2));
      const badgeHeight = Math.round(currentFontSize + 10);
      const gap = 16;

      let badgeX = 0, badgeY = 0, textX = 0, textY = 0;
      if (currentPosition === 'above') {
        badgeX = Math.round(ptX - badgeWidth / 2);
        badgeY = Math.round(ptY - 24 - badgeHeight);
        textX = ptX;
        textY = Math.round(ptY - 24 - badgeHeight / 2 + currentFontSize * 0.35);
      } else if (currentPosition === 'right') {
        badgeX = Math.round(ptX + gap);
        badgeY = Math.round(ptY - badgeHeight / 2);
        textX = Math.round(ptX + gap + badgeWidth / 2);
        textY = Math.round(ptY + currentFontSize * 0.35);
      } else if (currentPosition === 'left') {
        badgeX = Math.round(ptX - gap - badgeWidth);
        badgeY = Math.round(ptY - badgeHeight / 2);
        textX = Math.round(ptX - gap - badgeWidth / 2);
        textY = Math.round(ptY + currentFontSize * 0.35);
      } else {
        badgeX = Math.round(ptX - badgeWidth / 2);
        badgeY = Math.round(ptY + gap);
        textX = ptX;
        textY = Math.round(ptY + gap + badgeHeight / 2 + currentFontSize * 0.35);
      }

      if (isShowBg) {
        const badgeBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        badgeBg.setAttribute('x', badgeX);
        badgeBg.setAttribute('y', badgeY);
        badgeBg.setAttribute('width', badgeWidth);
        badgeBg.setAttribute('height', badgeHeight);
        badgeBg.setAttribute('rx', '6');
        badgeBg.setAttribute('fill', 'rgba(15, 23, 42, 0.88)');
        badgeBg.setAttribute('stroke', '#ef4444');
        badgeBg.setAttribute('stroke-width', '1');
        centerGroup.appendChild(badgeBg);
      }

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', textX);
      text.setAttribute('y', textY);
      text.setAttribute('fill', currentTextColor);
      text.setAttribute('font-size', `${currentFontSize}px`);
      text.setAttribute('font-weight', '700');
      text.setAttribute('font-family', 'Cairo, Tajawal, Segoe UI, sans-serif');
      text.setAttribute('text-anchor', 'middle');
      text.textContent = applicantName;
      centerGroup.appendChild(text);

      svg.appendChild(centerGroup);
      setupCentroidDraggable(centerGroup, metersPerPixel, mPerDegLat, mPerDegLon);
    } else {
      // MODE 1: Red Polygon outline + numbered vertex circles (inside draggable group)
      const polyGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      polyGroup.setAttribute('class', 'earth-parcel-draggable-poly');

      const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      polygon.setAttribute('points', ptsStr);
      polygon.setAttribute('fill', isOverlayLocked ? 'none' : 'rgba(239, 68, 68, 0.12)');
      polygon.setAttribute('stroke', '#ef4444');
      polygon.setAttribute('stroke-width', isOverlayLocked ? '3.5' : '4');
      if (!isOverlayLocked) {
        polygon.setAttribute('stroke-dasharray', '8,4');
      }
      polygon.setAttribute('stroke-linejoin', 'round');
      polygon.setAttribute('filter', 'url(#hud-glow)');
      polyGroup.appendChild(polygon);

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
        polyGroup.appendChild(circle);

        // Number badge background
        const textBg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        textBg.setAttribute('cx', p.x + 14);
        textBg.setAttribute('cy', p.y - 12);
        textBg.setAttribute('r', '9');
        textBg.setAttribute('fill', '#0f172a');
        textBg.setAttribute('stroke', '#38bdf8');
        textBg.setAttribute('stroke-width', '1.5');
        polyGroup.appendChild(textBg);

        // Text label
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', p.x + 14);
        text.setAttribute('y', p.y - 8);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', '#ffffff');
        text.setAttribute('font-size', '10');
        text.setAttribute('font-weight', 'bold');
        text.textContent = p.id;
        polyGroup.appendChild(text);
      });

      // Centroid Marker (Visible on map for surveyor alignment)
      const polyCLon = (currentParcel.centroid && (currentParcel.centroid.lon !== undefined ? currentParcel.centroid.lon : currentParcel.centroid.lng)) ||
                       (currentParcel.center && (currentParcel.center.lon !== undefined ? currentParcel.center.lon : currentParcel.center.lng)) ||
                       currentParcel.centerLng;
      const polyCLat = (currentParcel.centroid && (currentParcel.centroid.lat !== undefined ? currentParcel.centroid.lat : currentParcel.centroid.latitude)) ||
                       (currentParcel.center && (currentParcel.center.lat !== undefined ? currentParcel.center.lat : currentParcel.center.latitude)) ||
                       currentParcel.centerLat;
      if (polyCLon && polyCLat && !isNaN(polyCLon) && !isNaN(polyCLat)) {
        const offsetLon = Number(polyCLon) + offLon;
        const offsetLat = Number(polyCLat) + offLat;
        const cDxM = (offsetLon - centerLon) * mPerDegLon;
        const cDyM = (offsetLat - centerLat) * mPerDegLat;
        const cPx = cx + (cDxM / metersPerPixel);
        const cPy = cy - (cDyM / metersPerPixel);

        const centroidPin = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        centroidPin.setAttribute('id', 'earth-survey-centroid-pin');
        centroidPin.setAttribute('class', 'earth-survey-centroid-pin');
        centroidPin.setAttribute('title', `📐 سنترويد المضلع الهندسي (اسحب بالفأرة لتعديل الموضع): ${Number(polyCLon).toFixed(6)}, ${Number(polyCLat).toFixed(6)}`);
        centroidPin.style.pointerEvents = 'auto';
        centroidPin.style.cursor = 'grab';

        // Invisible generous circular hit area for effortless mouse grabbing
        const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        hitArea.setAttribute('cx', cPx);
        hitArea.setAttribute('cy', cPy);
        hitArea.setAttribute('r', '24');
        hitArea.setAttribute('fill', 'transparent');
        hitArea.style.cursor = 'grab';
        centroidPin.appendChild(hitArea);

        const currentTextColor = pinTextColor || '#38bdf8';
        const currentFontSize = pinTextSize || 12;
        const currentTextStr = (pinCustomText !== undefined && pinCustomText !== null && pinCustomText !== '' && pinCustomText !== '🎯 المركز') ? pinCustomText : '📐 سنترويد المضلع';

        // Distinctive Geometric Diamond Marker (معين هندسي كاداستري لسنترويد المضلع)
        // 1. Crosshair axes extending through diamond vertices
        [
          { x1: cPx - 20, y1: cPy, x2: cPx + 20, y2: cPy },
          { x1: cPx, y1: cPy - 20, x2: cPx, y2: cPy + 20 }
        ].forEach(coords => {
          const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          l.setAttribute('x1', coords.x1);
          l.setAttribute('y1', coords.y1);
          l.setAttribute('x2', coords.x2);
          l.setAttribute('y2', coords.y2);
          l.setAttribute('stroke', '#38bdf8');
          l.setAttribute('stroke-width', '1.6');
          l.setAttribute('stroke-dasharray', '4,3');
          centroidPin.appendChild(l);
        });

        // 2. Diamond Polygon (Rotated Square ◊)
        const dSize = 13;
        const diamond = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        diamond.setAttribute('points', `${cPx},${cPy - dSize} ${cPx + dSize},${cPy} ${cPx},${cPy + dSize} ${cPx - dSize},${cPy}`);
        diamond.setAttribute('fill', 'rgba(15, 23, 42, 0.65)');
        diamond.setAttribute('stroke', '#38bdf8');
        diamond.setAttribute('stroke-width', '2.5');
        diamond.setAttribute('filter', 'url(#hud-glow)');
        centroidPin.appendChild(diamond);

        // 3. Inner Focal Dot
        const cDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        cDot.setAttribute('cx', cPx);
        cDot.setAttribute('cy', cPy);
        cDot.setAttribute('r', '3.5');
        cDot.setAttribute('fill', '#ffffff');
        cDot.setAttribute('stroke', '#0284c7');
        cDot.setAttribute('stroke-width', '1.5');
        centroidPin.appendChild(cDot);

        // 4. Subtle Label
        if (currentTextStr) {
          const currentPosition = pinTextPosition || 'below';
          const isShowBg = pinShowBg !== false;

          const approxCharW = currentFontSize * 0.72;
          const bgW = Math.max(50, Math.round(currentTextStr.length * approxCharW + 16));
          const bgH = Math.round(currentFontSize + 8);
          const gap = 16;

          let bgX = 0, bgY = 0, textX = 0, textY = 0;
          if (currentPosition === 'above') {
            bgX = Math.round(cPx - bgW / 2);
            bgY = Math.round(cPy - gap - bgH);
            textX = cPx;
            textY = Math.round(cPy - gap - 5);
          } else if (currentPosition === 'right') {
            bgX = Math.round(cPx + gap);
            bgY = Math.round(cPy - bgH / 2);
            textX = Math.round(cPx + gap + bgW / 2);
            textY = Math.round(cPy + currentFontSize * 0.35);
          } else if (currentPosition === 'left') {
            bgX = Math.round(cPx - gap - bgW);
            bgY = Math.round(cPy - bgH / 2);
            textX = Math.round(cPx - gap - bgW / 2);
            textY = Math.round(cPy + currentFontSize * 0.35);
          } else {
            bgX = Math.round(cPx - bgW / 2);
            bgY = Math.round(cPy + gap);
            textX = cPx;
            textY = Math.round(cPy + gap + currentFontSize * 0.85 + 2);
          }

          if (isShowBg) {
            const textBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            textBg.setAttribute('x', bgX);
            textBg.setAttribute('y', bgY);
            textBg.setAttribute('width', bgW);
            textBg.setAttribute('height', bgH);
            textBg.setAttribute('rx', '4');
            textBg.setAttribute('fill', 'rgba(15, 23, 42, 0.85)');
            textBg.setAttribute('stroke', '#38bdf8');
            textBg.setAttribute('stroke-width', '1');
            centroidPin.appendChild(textBg);
          }

          const cText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          cText.setAttribute('x', textX);
          cText.setAttribute('y', textY);
          cText.setAttribute('fill', '#bae6fd');
          cText.setAttribute('font-size', `${currentFontSize}px`);
          cText.setAttribute('font-weight', '700');
          cText.setAttribute('font-family', 'Cairo, Tajawal, Segoe UI, sans-serif');
          cText.setAttribute('text-anchor', 'middle');
          cText.textContent = currentTextStr;
          centroidPin.appendChild(cText);
        }

        svg.appendChild(centroidPin);
        setupCentroidDraggable(centroidPin, metersPerPixel, mPerDegLat, mPerDegLon);
      }

      svg.appendChild(polyGroup);
      setupDraggable(polyGroup, metersPerPixel, mPerDegLat, mPerDegLon);
    }

    root.appendChild(svg);
    renderNudgeHud(metersPerPixel, mPerDegLat, mPerDegLon);
  }

  function setupCentroidDraggable(element, metersPerPixel, mPerDegLat, mPerDegLon) {
    if (!element || !currentParcel) return;
    element.style.pointerEvents = 'auto';
    element.style.cursor = 'grab';

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startLon = 0;
    let startLat = 0;

    const onMouseDown = (e) => {
      if (e.button !== 0) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;

      const curLon = (currentParcel.centroid && currentParcel.centroid.lon) || (currentParcel.center && currentParcel.center.lon) || 0;
      const curLat = (currentParcel.centroid && currentParcel.centroid.lat) || (currentParcel.center && currentParcel.center.lat) || 0;
      startLon = Number(curLon);
      startLat = Number(curLat);

      element.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
      e.stopPropagation();
      e.preventDefault();

      const onMouseMove = (moveEvent) => {
        if (!isDragging) return;
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;

        element.setAttribute('transform', `translate(${dx}, ${dy})`);

        const dMetersX = dx * metersPerPixel;
        const dMetersY = -dy * metersPerPixel;
        const liveLon = (startLon + (dMetersX / mPerDegLon)).toFixed(6);
        const liveLat = (startLat + (dMetersY / mPerDegLat)).toFixed(6);

        const labelText = element.querySelector('text');
        if (labelText) {
          const isPolyC = element.classList && element.classList.contains('earth-survey-centroid-pin');
        labelText.textContent = isPolyC ? `📐 سنترويد: ${liveLon}, ${liveLat}` : `📍 الموقع: ${liveLon}, ${liveLat}`;
        }
      };

      const onMouseUp = (upEvent) => {
        if (isDragging) {
          isDragging = false;
          element.style.cursor = 'grab';
          document.body.style.userSelect = '';
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);

          const dx = upEvent.clientX - startX;
          const dy = upEvent.clientY - startY;

          const dMetersX = dx * metersPerPixel;
          const dMetersY = -dy * metersPerPixel;
          const finalLon = parseFloat((startLon + (dMetersX / mPerDegLon)).toFixed(7));
          const finalLat = parseFloat((startLat + (dMetersY / mPerDegLat)).toFixed(7));

          currentParcel.centroid = { lon: finalLon, lat: finalLat };
          currentParcel.center = { lon: finalLon, lat: finalLat };
          currentParcel.centerLng = finalLon;
          currentParcel.centerLat = finalLat;
          currentParcel.isCentroidUserEdited = true;

          if (chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ currentParcel: currentParcel });
          }

          try {
            chrome.runtime.sendMessage({
              action: 'CENTROID_DRAGGED',
              centroid: currentParcel.centroid
            });
          } catch (err) {}

          renderOverlay();
        }
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    };

    element.addEventListener('mousedown', onMouseDown);
  }

  function setupDraggable(element, metersPerPixel, mPerDegLat, mPerDegLon) {
    if (!element) return;

    if (isOverlayLocked) {
      element.style.pointerEvents = 'none';
      element.style.cursor = 'default';
      return;
    }

    element.style.pointerEvents = 'auto';
    element.style.cursor = 'grab';

    let isDragging = false;
    let startX = 0;
    let startY = 0;

    const onMouseDown = (e) => {
      if (isOverlayLocked) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      element.style.cursor = 'grabbing';
      e.stopPropagation();
      e.preventDefault();

      const onMouseMove = (moveEvent) => {
        if (!isDragging || isOverlayLocked) return;
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        startX = moveEvent.clientX;
        startY = moveEvent.clientY;

        const dMetersX = dx * metersPerPixel;
        const dMetersY = -dy * metersPerPixel;

        overlayOffset.dLon += (dMetersX / mPerDegLon);
        overlayOffset.dLat += (dMetersY / mPerDegLat);

        renderOverlay();
      };

      const onMouseUp = () => {
        if (isDragging) {
          isDragging = false;
          element.style.cursor = 'grab';
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
          saveOverlayOffset();
        }
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    };

    element.addEventListener('mousedown', onMouseDown);
  }

  function renderNudgeHud(metersPerPixel, mPerDegLat, mPerDegLon) {
    let hud = document.getElementById('earth-survey-nudge-hud');
    if (!currentParcel || !isPolygonVisible) {
      if (hud) hud.remove();
      return;
    }

    if (!hud) {
      hud = document.createElement('div');
      hud.id = 'earth-survey-nudge-hud';
      document.body.appendChild(hud);
    }

    hud.style.cssText = `
      position: fixed !important;
      bottom: 24px !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      background: rgba(15, 23, 42, 0.95) !important;
      backdrop-filter: blur(14px) !important;
      border: 1px solid ${isOverlayLocked ? 'rgba(148, 163, 184, 0.35)' : '#38bdf8'} !important;
      border-radius: 12px !important;
      padding: 8px 18px !important;
      box-shadow: 0 10px 30px rgba(0,0,0,0.65), 0 0 16px ${isOverlayLocked ? 'transparent' : 'rgba(56, 189, 248, 0.35)'} !important;
      z-index: 10000000 !important;
      direction: rtl !important;
      display: flex !important;
      align-items: center !important;
      gap: 12px !important;
      font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif !important;
      font-size: 13px !important;
      color: #f8fafc !important;
      pointer-events: auto !important;
      user-select: none !important;
      transition: all 0.25s ease !important;
    `;

    if (isOverlayLocked) {
      hud.innerHTML = `
        <span style="display:flex; align-items:center; gap:6px; color:#94a3b8; font-weight:600;">
          <span style="font-size:16px;">🔒</span> موقع الرسم مثبت
        </span>
        <button id="btn-hud-unlock" style="
          background: rgba(56, 189, 248, 0.2);
          border: 1px solid rgba(56, 189, 248, 0.5);
          color: #38bdf8;
          padding: 6px 14px;
          border-radius: 6px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.15s ease;
        ">🔓 فك القفل لتحريك الرسم</button>
      `;
      const btnUnlock = hud.querySelector('#btn-hud-unlock');
      if (btnUnlock) {
        btnUnlock.onclick = () => {
          isOverlayLocked = false;
          saveOverlayOffset();
          renderOverlay();
          showToast('🔓 تم فك قفل الرسم: يمكنك الآن سحبه بالماوس أو استخدام أزرار الأسهم لضبطه مع زاوية التصوير');
        };
      }
    } else {
      hud.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:2px;">
          <span style="display:flex; align-items:center; gap:6px; color:#38bdf8; font-weight:700;">
            <span style="font-size:15px;">🔓</span> وضع ضبط الموقع (زاوية التصوير)
          </span>
          <span style="font-size:11px; color:#cbd5e1;">اسحب الرسم بالماوس أو انقر الأسهم للإزاحة الدقيقة</span>
        </div>
        <div style="display:flex; align-items:center; gap:4px; margin: 0 4px;">
          <button id="btn-nudge-up" title="تحريك لأعلى" style="width:30px; height:30px; background:#1e293b; border:1px solid #475569; color:#fff; border-radius:6px; cursor:pointer; font-size:14px;">⬆️</button>
          <button id="btn-nudge-down" title="تحريك لأسفل" style="width:30px; height:30px; background:#1e293b; border:1px solid #475569; color:#fff; border-radius:6px; cursor:pointer; font-size:14px;">⬇️</button>
          <button id="btn-nudge-right" title="تحريك يمين" style="width:30px; height:30px; background:#1e293b; border:1px solid #475569; color:#fff; border-radius:6px; cursor:pointer; font-size:14px;">➡️</button>
          <button id="btn-nudge-left" title="تحريك يسار" style="width:30px; height:30px; background:#1e293b; border:1px solid #475569; color:#fff; border-radius:6px; cursor:pointer; font-size:14px;">⬅️</button>
        </div>
        <button id="btn-hud-lock" style="
          background: linear-gradient(135deg, #0284c7, #0369a1);
          border: 1px solid #38bdf8;
          color: #fff;
          padding: 6px 14px;
          border-radius: 6px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
        ">🔒 قفل وتثبيت</button>
        <button id="btn-hud-reset" title="إعادة ضبط الموضع الأصلي" style="
          background: rgba(239, 68, 68, 0.2);
          border: 1px solid rgba(239, 68, 68, 0.4);
          color: #fca5a5;
          padding: 6px 10px;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
        ">↺ إعادة ضبط</button>
      `;

      const nudgeStepMeters = 1.5;
      const doNudge = (dxM, dyM) => {
        overlayOffset.dLon += (dxM / mPerDegLon);
        overlayOffset.dLat += (dyM / mPerDegLat);
        saveOverlayOffset();
        renderOverlay();
      };

      hud.querySelector('#btn-nudge-up').onclick = () => doNudge(0, nudgeStepMeters);
      hud.querySelector('#btn-nudge-down').onclick = () => doNudge(0, -nudgeStepMeters);
      hud.querySelector('#btn-nudge-right').onclick = () => doNudge(nudgeStepMeters, 0);
      hud.querySelector('#btn-nudge-left').onclick = () => doNudge(-nudgeStepMeters, 0);

      hud.querySelector('#btn-hud-lock').onclick = () => {
        isOverlayLocked = true;
        saveOverlayOffset();
        renderOverlay();
        showToast('🔒 تم تثبيت وقفل موضع الرسم بنجاح');
      };

      hud.querySelector('#btn-hud-reset').onclick = () => {
        overlayOffset = { dLat: 0, dLon: 0 };
        saveOverlayOffset();
        renderOverlay();
        showToast('↺ تم استعادة موضع الإحداثيات الأصلي');
      };
    }
  }

  window.__earthSurveyRefresh = renderOverlay;

  // Runtime message listener
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'GET_OVERLAY_STATE') {
      sendResponse({
        success: true,
        isLocked: isOverlayLocked,
        offset: overlayOffset,
        mode: overlayMode,
        visible: isPolygonVisible
      });
      return true;
    }

    if (msg.action === 'SET_OVERLAY_LOCK') {
      isOverlayLocked = (typeof msg.locked === 'boolean') ? msg.locked : true;
      saveOverlayOffset();
      renderOverlay();
      showToast(isOverlayLocked ? '🔒 تم قفل وتثبيت الرسم' : '🔓 تم فك قفل الرسم للتحريك');
      sendResponse({ success: true, isLocked: isOverlayLocked });
      return true;
    }

    if (msg.action === 'TOGGLE_OVERLAY_LOCK') {
      isOverlayLocked = !isOverlayLocked;
      saveOverlayOffset();
      renderOverlay();
      showToast(isOverlayLocked ? '🔒 تم قفل وتثبيت الرسم' : '🔓 تم فك قفل الرسم للتحريك');
      sendResponse({ success: true, isLocked: isOverlayLocked });
      return true;
    }

    if (msg.action === 'RESET_OVERLAY_OFFSET') {
      overlayOffset = { dLat: 0, dLon: 0 };
      saveOverlayOffset();
      renderOverlay();
      showToast('↺ تم إعادة ضبط موضع الرسم إلى الأصل');
      sendResponse({ success: true, offset: overlayOffset });
      return true;
    }

    if (msg.action === 'NUDGE_OVERLAY') {
      const dxM = msg.dxMeters || 0;
      const dyM = msg.dyMeters || 0;
      const cam = getCameraFromUrl();
      const centerLat = (cam && cam.lat) ? cam.lat : (currentParcel ? currentParcel.center.lat : 31.0);
      const meanLatRad = centerLat * (Math.PI / 180.0);
      const mPerDegLat = 111132.92 - 559.82 * Math.cos(2 * meanLatRad);
      const mPerDegLon = 111412.84 * Math.cos(meanLatRad);
      overlayOffset.dLon += (dxM / mPerDegLon);
      overlayOffset.dLat += (dyM / mPerDegLat);
      saveOverlayOffset();
      renderOverlay();
      sendResponse({ success: true, offset: overlayOffset });
      return true;
    }
    if (msg.action === 'GET_MAP_BOUNDS') {
      // Keep root visible so SVG overlay appears inside the screenshot if not hidden
      ensureRoot();
      if (root && isPolygonVisible) {
        root.style.setProperty('display', 'block', 'important');
      }

      // Temporarily hide Google Earth UI toolbars for 1600ms during capture
      const restoreUi = hideUiForCapture();
      setTimeout(restoreUi, 1600);

      const bounds = getMapBounds();
      sendResponse(bounds);
      return true;
    }

    if (msg.action === 'SET_OVERLAY_MODE') {
      overlayMode = (msg.mode === 'point') ? 'point' : 'polygon';
      renderOverlay();
      sendResponse({ success: true, mode: overlayMode });
      return true;
    }

    if (msg.action === 'UPDATE_CENTROID') {
      if (currentParcel) {
        currentParcel.centroid = msg.centroid;
        currentParcel.center = msg.centroid;
      }
      renderOverlay();
      sendResponse({ success: true });
      return true;
    }

    if (msg.action === 'UPDATE_PIN_STYLE') {
      if (msg.pinTextColor !== undefined) pinTextColor = msg.pinTextColor;
      if (msg.pinTextSize !== undefined) pinTextSize = Number(msg.pinTextSize);
      if (msg.pinCustomText !== undefined) pinCustomText = msg.pinCustomText;
      if (msg.pinTextPosition !== undefined) pinTextPosition = msg.pinTextPosition;
      if (msg.pinShowBg !== undefined) pinShowBg = msg.pinShowBg;

      if (!currentParcel && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['currentParcel'], (res) => {
          if (res && res.currentParcel) {
            currentParcel = res.currentParcel;
          }
          renderOverlay();
        });
      } else {
        renderOverlay();
      }
      sendResponse({ success: true });
      return true;
    }

    if (msg.action === 'LOAD_PARCEL' || msg.action === 'UPDATE_PARCEL') {
      currentParcel = msg.parcel;
      if (msg.action === 'LOAD_PARCEL') {
        overlayOffset = { dLat: 0, dLon: 0 };
        isOverlayLocked = false;
        saveOverlayOffset();
      }
      if (msg.overlayMode) {
        overlayMode = msg.overlayMode;
      }
      isPolygonVisible = true;
      renderOverlay();
      sendResponse({ success: true });
      return true;
    }

    if (msg.action === 'CLEAR_PARCEL') {
      currentParcel = null;
      overlayOffset = { dLat: 0, dLon: 0 };
      isOverlayLocked = false;
      saveOverlayOffset();
      const oldSvg = document.getElementById('earth-parcel-svg');
      if (oldSvg) oldSvg.remove();
      const hud = document.getElementById('earth-survey-nudge-hud');
      if (hud) hud.remove();
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

    if (msg.action === 'TOGGLE_POLYGON' || msg.action === 'TOGGLE_POLY') {
      ensureRoot();
      isPolygonVisible = (typeof msg.visible === 'boolean') ? msg.visible : !isPolygonVisible;

      const svg = document.getElementById('earth-parcel-svg');
      if (svg) {
        svg.style.setProperty('display', isPolygonVisible ? 'block' : 'none', 'important');
      } else if (isPolygonVisible) {
        renderOverlay();
      }

      if (root) {
        root.style.setProperty('display', isPolygonVisible ? 'block' : 'none', 'important');
      }

      showToast(isPolygonVisible ? '👁️ تم إظهار الرسم على الخريطة' : '🙈 تم إخفاء الرسم من الخريطة');
      sendResponse({ success: true, visible: isPolygonVisible });
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
      chrome.storage.local.get(['capturedShots', 'selectedYear', 'selectedMonth'], (store) => {
        const shots = store.capturedShots || [];
        const yr = store.selectedYear || selectedYear || new Date().getFullYear();
        const mo = store.selectedMonth || '';
        const dateStr = mo ? `${yr}/${mo}` : `${yr}`;

        const newShot = {
          id: Date.now(),
          year: yr,
          month: mo,
          captureDate: dateStr,
          imageData: croppedUrl,
          status: 'أرض فضاء / لم يطرأ تغيير إنشائي',
          notes: 'تم الالتقاط وتوثيق الحدود والمضلع بدقة عالية عبر Google Earth Web'
        };

        const existingIdx = shots.findIndex(s => String(s.year) === String(yr) && String(s.month || '') === String(mo || ''));
        if (existingIdx >= 0) {
          shots[existingIdx] = newShot;
        } else {
          shots.push(newShot);
        }

        shots.sort((a, b) => {
          const yA = parseInt(a.year) || 0;
          const yB = parseInt(b.year) || 0;
          if (yA !== yB) return yA - yB;
          return (parseInt(a.month) || 0) - (parseInt(b.month) || 0);
        });

        chrome.storage.local.set({ capturedShots: shots }, () => {
          showToast(`✅ تم حفظ لقطة خريطة ${dateStr} وتوثيق المضلع بالمعرض بنجاح!`);
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
