/**
 * Geo Engine for Google Earth Survey Extension
 * Handles cadastral survey parsing, CRS detection (WGS84, Egyptian Red Belt EPSG:22992, UTM 36N),
 * polygon geodesic measurements, deduplication, and Google Earth camera positioning.
 */

(function (global) {
  // Initialize Proj4 definitions if proj4 is loaded
  if (typeof proj4 !== 'undefined') {
    // Egyptian Red Belt (Egypt 1907 / Red Belt EPSG:22992)
    proj4.defs(
      'EPSG:22992',
      '+proj=tmerc +lat_0=30 +lon_0=31 +k=1 +x_0=615000 +y_0=810000 +a=6378200 +b=6356818.16723225 +towgs84=-130.68,-110.31,-41.18,0,0,0,0 +units=m +no_defs'
    );
    // UTM Zone 36N (WGS84 EPSG:32636)
    proj4.defs(
      'EPSG:32636',
      '+proj=utm +zone=36 +datum=WGS84 +units=m +no_defs'
    );
  }

  const ARABIC_DIGITS_MAP = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
    '،': '.'
  };

  function normalizeDigits(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[٠-٩،]/g, d => ARABIC_DIGITS_MAP[d] || d).trim();
  }

  function parseNumber(val) {
    if (val === null || val === undefined) return null;
    const s = normalizeDigits(val).replace(/,/g, '.').replace(/[^\d.-]/g, '');
    const num = parseFloat(s);
    return isNaN(num) ? null : num;
  }

  /**
   * Detects Coordinate Reference System and transforms to WGS84 [lon, lat]
   */
  function detectCrsAndTransform(coordsRaw) {
    if (!coordsRaw || coordsRaw.length === 0) {
      return { coords: [], crs: 'UNKNOWN' };
    }

    const sample = coordsRaw[0];
    const sampleX = sample[0];
    const sampleY = sample[1];

    // Case 1: Already WGS84 Geographic Degrees (Egypt: Lat 20-33, Lon 24-38)
    if (sampleX >= 20 && sampleX <= 38 && sampleY >= 20 && sampleY <= 38) {
      let isXLong = true;
      // In Egypt: Longitude is typically 25 to 37; Latitude is 22 to 32.
      // If sampleX <= 32 and sampleY > 32, coordinates might be [Lat, Lon]
      if (sampleX <= 32 && sampleY > 32) {
        isXLong = false;
      }
      const coords = coordsRaw.map(([x, y]) => isXLong ? [x, y] : [y, x]);
      return { coords, crs: 'WGS84 (EPSG:4326)' };
    }

    // Case 2: Egyptian Red Belt (EPSG:22992)
    // X ~ 200,000 to 500,000 ; Y ~ 700,000 to 1,100,000
    if (sampleX >= 180000 && sampleX <= 550000 && sampleY >= 650000 && sampleY <= 1150000) {
      if (typeof proj4 !== 'undefined') {
        const coords = coordsRaw.map(([x, y]) => {
          const res = proj4('EPSG:22992', 'EPSG:4326', [x, y]);
          return [res[0], res[1]];
        });
        return { coords, crs: 'Egyptian Red Belt (EPSG:22992)' };
      }
    }

    // Case 3: UTM Zone 36N (EPSG:32636)
    // X ~ 150,000 to 850,000 ; Y ~ 3,000,000 to 3,600,000
    if (sampleX >= 150000 && sampleX <= 850000 && sampleY >= 2900000 && sampleY <= 3700000) {
      if (typeof proj4 !== 'undefined') {
        const coords = coordsRaw.map(([x, y]) => {
          const res = proj4('EPSG:32636', 'EPSG:4326', [x, y]);
          return [res[0], res[1]];
        });
        return { coords, crs: 'UTM Zone 36N (EPSG:32636)' };
      }
    }

    // Fallback
    return { coords: coordsRaw.map(([x, y]) => [x, y]), crs: 'WGS84 (Assumed)' };
  }

  /**
   * Distance between two points in meters using Haversine formula
   */
  function haversineMeters(lon1, lat1, lon2, lat2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Calculates geodesic polygon area & perimeter in square meters
   */
  function calculatePolygonMetrics(coords) {
    if (!coords || coords.length < 3) {
      return { areaM2: 0, perimeterM: 0 };
    }

    let perimeterM = 0;
    const n = coords.length;
    for (let i = 0; i < n; i++) {
      const nextIdx = (i + 1) % n;
      perimeterM += haversineMeters(coords[i][0], coords[i][1], coords[nextIdx][0], coords[nextIdx][1]);
    }

    // Centroid latitude for projection scale
    let sumLat = 0;
    for (let i = 0; i < n; i++) sumLat += coords[i][1];
    const meanLatRad = (sumLat / n) * Math.PI / 180;

    // Meters per degree approximation on WGS84
    const mPerDegLat = 111132.92 - 559.82 * Math.cos(2 * meanLatRad) + 1.175 * Math.cos(4 * meanLatRad);
    const mPerDegLon = 111412.84 * Math.cos(meanLatRad) - 93.5 * Math.cos(3 * meanLatRad);

    // Projected coordinates in local meters relative to coords[0]
    const x0 = coords[0][0];
    const y0 = coords[0][1];
    const ptsM = coords.map(([lon, lat]) => [
      (lon - x0) * mPerDegLon,
      (lat - y0) * mPerDegLat
    ]);

    // Shoelace formula in local meter space
    let area = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += ptsM[i][0] * ptsM[j][1] - ptsM[j][0] * ptsM[i][1];
    }
    const areaM2 = Math.abs(area) / 2.0;

    return { areaM2, perimeterM };
  }

  /**
   * Parses Survey Rows into structured Parcel object
   */
  function parseSurveyRows(rows) {
    if (!rows || rows.length === 0) {
      throw new Error('الملف فارغ أو لا يحتوي على صفوف بيانات.');
    }

    const headers = Object.keys(rows[0]);

    // Find column matching regex patterns
    function findColumn(patterns) {
      for (const p of patterns) {
        for (const h of headers) {
          const normH = h.trim().toLowerCase().replace(/[\s_-]+/g, '');
          if (p.test(normH)) return h;
        }
      }
      return null;
    }

    const colX = findColumn([
      /^pointx$/, /^ptx$/, /^x$/, /^lon$/, /^long$/, /^longitude$/,
      /^easting$/, /^east$/, /^شرق$/, /^خطالطول$/
    ]);

    const colY = findColumn([
      /^pointy$/, /^pty$/, /^y$/, /^lat$/, /^latitude$/,
      /^northing$/, /^north$/, /^شمال$/, /^دائرةالعرض$/
    ]);

    const colId = findColumn([
      /^objectid$/, /^origfid$/, /^fid$/, /^pt$/, /^point$/, /^id$/, /^نقطة$/, /^م$/
    ]);

    const colName = findColumn([/^اسممقدما?لطلب$/, /^اسممقدما?لطلب$/, /^الاسم$/, /^اسمالمواطن$/, /^المواطن$/]);
    const colNatId = findColumn([/^الرقما?لقومي$/, /^رقمقومي$/, /^القومي$/]);
    const colCenter = findColumn([/^المركز$/, /^مركز$/]);
    const colVillage = findColumn([/^القرية$/, /^قرية$/, /^المدينة$/, /^مدينة$/, /^الحي$/]);
    const colStatedArea = findColumn([/^المساحةم2$/, /^المساحة$/, /^المساحةبالمتر$/, /^shapearea$/]);
    const colDesc = findColumn([/^وصفالموقع$/, /^الوصف$/, /^وصفالتعامل$/]);

    if (!colX || !colY) {
      throw new Error('لم يتم العثور على أعمدة الإحداثيات (POINT_X / POINT_Y أو الشرق / الشمال) داخل الجدول.');
    }

    const rawCoords = [];
    const rawVertices = [];
    let applicantName = '';
    let nationalId = '';
    let centerCity = '';
    let village = '';
    let statedArea = null;
    let locationDesc = '';

    rows.forEach((row, idx) => {
      const valX = parseNumber(row[colX]);
      const valY = parseNumber(row[colY]);

      if (valX !== null && valY !== null) {
        const ptId = colId && row[colId] ? normalizeDigits(row[colId]) : (idx + 1);
        rawCoords.push([valX, valY]);
        rawVertices.push({
          id: ptId,
          rawX: valX,
          rawY: valY
        });

        // Capture metadata from first available row
        if (!applicantName && colName && row[colName]) applicantName = String(row[colName]).trim();
        if (!nationalId && colNatId && row[colNatId]) nationalId = normalizeDigits(row[colNatId]);
        if (!centerCity && colCenter && row[colCenter]) centerCity = String(row[colCenter]).trim();
        if (!village && colVillage && row[colVillage]) village = String(row[colVillage]).trim();
        if (statedArea === null && colStatedArea && row[colStatedArea]) statedArea = parseNumber(row[colStatedArea]);
        if (!locationDesc && colDesc && row[colDesc]) locationDesc = String(row[colDesc]).trim();
      }
    });

    if (rawCoords.length < 3) {
      throw new Error('يجب توفر 3 نقاط مساحية على الأقل لتمثيل مضلع قطعة الأرض.');
    }

    // Detect CRS & Transform
    const { coords: wgsCoords, crs } = detectCrsAndTransform(rawCoords);

    // Closed Ring Deduplication (e.g. 5th point is identical to 1st point)
    let finalWgs = [...wgsCoords];
    let finalVertices = [...rawVertices];

    if (finalWgs.length > 3) {
      const first = finalWgs[0];
      const last = finalWgs[finalWgs.length - 1];
      const distClosing = haversineMeters(first[0], first[1], last[0], last[1]);
      if (distClosing < 0.2) {
        // Discard duplicated closing point
        finalWgs.pop();
        finalVertices.pop();
      }
    }

    // Attach WGS coordinates to vertices
    finalVertices.forEach((v, i) => {
      v.lon = finalWgs[i][0];
      v.lat = finalWgs[i][1];
      v.index = i + 1;
    });

    // Calculate metrics
    const { areaM2, perimeterM } = calculatePolygonMetrics(finalWgs);

    // Bounds & Centroid
    let minLon = 180, maxLon = -180, minLat = 90, maxLat = -90;
    finalWgs.forEach(([lon, lat]) => {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    });

    const centerLon = (minLon + maxLon) / 2.0;
    const centerLat = (minLat + maxLat) / 2.0;
    const diagonalMeters = haversineMeters(minLon, minLat, maxLon, maxLat);

    // Optimal Google Earth camera distance:
    // Ensures polygon occupies approx 30% - 35% of the frame with balanced surrounding context
    const optimalDistance = Math.round(Math.max(diagonalMeters * 2.8, 120));

    // Construct Google Earth Web URL
    // Format: https://earth.google.com/web/@{lat},{lon},{altitude}a,{distance}d,35y,0h,0t,0r
    const earthUrl = `https://earth.google.com/web/@${centerLat.toFixed(7)},${centerLon.toFixed(7)},12a,${optimalDistance}d,35y,0h,0t,0r`;

    return {
      applicantName: applicantName || 'غير محدد',
      nationalId: nationalId || '',
      centerCity: centerCity || 'المنصورة',
      village: village || '',
      locationDesc: locationDesc || '',
      statedAreaM2: statedArea || areaM2,
      calculatedAreaM2: areaM2,
      perimeterM: perimeterM,
      crs: crs,
      vertices: finalVertices,
      bounds: { minLon, maxLon, minLat, maxLat },
      center: { lon: centerLon, lat: centerLat },
      diagonalMeters: diagonalMeters,
      optimalDistance: optimalDistance,
      earthUrl: earthUrl
    };
  }

  /**
   * Generates official KML String
   */
  function generateKml(parcel) {
    const coordsStr = parcel.vertices
      .concat([parcel.vertices[0]]) // close loop
      .map(v => `${v.lon.toFixed(8)},${v.lat.toFixed(8)},0`)
      .join(' ');

    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${parcel.applicantName}</name>
    <description>رفع مساحي ورصد تغيرات مكانية - المساحة: ${parcel.calculatedAreaM2.toFixed(2)} م²</description>
    <Style id="parcelStyle">
      <LineStyle>
        <color>ff0000ff</color>
        <width>4</width>
      </LineStyle>
      <PolyStyle>
        <color>440000ff</color>
      </PolyStyle>
    </Style>
    <Placemark>
      <name>${parcel.applicantName}</name>
      <description>المساحة المحسوبة: ${parcel.calculatedAreaM2.toFixed(2)} م² - المحيط: ${parcel.perimeterM.toFixed(2)} م</description>
      <styleUrl>#parcelStyle</styleUrl>
      <Polygon>
        <extrude>1</extrude>
        <altitudeMode>clampToGround</altitudeMode>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${coordsStr}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
    <LookAt>
      <longitude>${parcel.center.lon.toFixed(8)}</longitude>
      <latitude>${parcel.center.lat.toFixed(8)}</latitude>
      <altitude>0</altitude>
      <heading>0</heading>
      <tilt>0</tilt>
      <range>${parcel.optimalDistance}</range>
    </LookAt>
  </Document>
</kml>`;
  }

  // Export module to global scope
  global.GeoEngine = {
    detectCrsAndTransform,
    haversineMeters,
    calculatePolygonMetrics,
    parseSurveyRows,
    generateKml
  };

})(typeof window !== 'undefined' ? window : this);
