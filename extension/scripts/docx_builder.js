/**
 * Pure Docx Builder for Dakahlia Spatial Variables Certificate ("بيان تسلسل زمني")
 * Generates 100% clean OpenXML from scratch using docx.umd.js (window.docx)
 * Strictly single-page A4 layout:
 *   - 2 to 5 images: Landscape A4 (Width: 16838 twips, Height: 11906 twips)
 *   - 6 images: Portrait A4 (Width: 11906 twips, Height: 16838 twips in 2x3 grid)
 * Precision DXA (twip) cell measurements & Geometric Centroid Calculation:
 *   - Accurate centroid calculation (مركز الثقل للشكل الهندسي) for longitude & latitude
 *   - Balanced, enlarged image dimensions filling the page elegantly with no empty void
 *   - Right-aligned legal disclaimer clauses using Eastern Arabic numerals (١- إلى ٥-)
 *   - Right-to-Left Arabic alignment across all tables, headers, and signatures
 */

(function (global) {
  'use strict';

  // Helper: Convert Base64 / DataURL to Uint8Array safely
  function base64ToUint8Array(base64) {
    if (!base64) return null;
    try {
      if (base64 instanceof Uint8Array) return base64;
      if (base64 instanceof ArrayBuffer) return new Uint8Array(base64);
      if (typeof base64 !== 'string') return null;
      const commaIdx = base64.indexOf(',');
      const raw = commaIdx !== -1 ? base64.slice(commaIdx + 1) : base64;
      const clean = raw.replace(/\s/g, '');
      const binary = atob(clean);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    } catch (e) {
      console.error('Error converting image data to Uint8Array:', e);
      return null;
    }
  }

  // Parse date string (e.g. "2017/11" or "2017-11" or "2017") into numeric value for sorting
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

  /**
   * Calculates the exact geometric centroid (مركز الثقل الهندسي) of a parcel polygon
   * Uses Shoelace Polygon Centroid formula with fallback to arithmetic mean of vertices.
   */
  function calculatePolygonCentroid(parcel) {
    if (!parcel) return { lon: null, lat: null };

    // 1. Try polygon vertices first
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

      // Deduplicate closing point if repeated
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

        // Fallback to arithmetic mean of unique vertices
        let sumX = 0, sumY = 0;
        for (let i = 0; i < n; i++) {
          sumX += pts[i][0];
          sumY += pts[i][1];
        }
        return { lon: sumX / n, lat: sumY / n };
      }
    }

    // 2. Fallback to parcel.center if present
    if (parcel.center) {
      const lat = (parcel.center.lat !== undefined) ? Number(parcel.center.lat) : null;
      const lon = (parcel.center.lon !== undefined) ? Number(parcel.center.lon) : ((parcel.center.lng !== undefined) ? Number(parcel.center.lng) : null);
      if (lat !== null && lon !== null && !isNaN(lat) && !isNaN(lon)) {
        return { lon, lat };
      }
    }

    // 3. Fallback to top-level center properties
    const lat = (parcel.centerLat !== undefined) ? Number(parcel.centerLat) : null;
    const lon = (parcel.centerLng !== undefined) ? Number(parcel.centerLng) : ((parcel.centerLon !== undefined) ? Number(parcel.centerLon) : null);
    if (lat !== null && lon !== null && !isNaN(lat) && !isNaN(lon)) {
      return { lon, lat };
    }

    return { lon: null, lat: null };
  }

  /**
   * Main Generator Function
   * @param {Object} parcel - Citizen and cadastral parcel metadata
   * @param {Array} shots - List of captured Google Earth map shots { imageData/dataUrl, captureDate, status }
   * @param {Object} committee - { surveyor, director, reviewer }
   * @returns {Promise<Blob>} DOCX Blob ready for download
   */
  async function generateDocxReport(parcel, shots, committee) {
    if (!global.docx) {
      throw new Error('مكتبة docx.umd.js غير محملة في النظام.');
    }

    const {
      Document,
      Packer,
      Paragraph,
      TextRun,
      Table,
      TableRow,
      TableCell,
      ImageRun,
      AlignmentType,
      WidthType,
      BorderStyle,
      ShadingType,
      VerticalAlign,
      PageOrientation
    } = global.docx;

    console.log(`[DocxBuilder] Generating certificate for "${parcel.applicantName || 'Citizen'}" with ${shots.length} shots.`);
    committee = committee || {};
    const surveyorName = committee.surveyor || 'مسؤول المتغيرات المكانية';
    const directorName = committee.director || 'مروة محمد رضوان';
    const reviewerName = committee.reviewer || 'د / عماد عبدالله احمد';

    // 1. Sort shots in chronological order (Oldest -> Newest)
    const sortedShots = [...shots].sort((a, b) => {
      return parseDateScore(a.captureDate) - parseDateScore(b.captureDate);
    });

    const shotCount = sortedShots.length;
    const isPortrait = (shotCount === 6);
    const orientation = isPortrait ? PageOrientation.PORTRAIT : PageOrientation.LANDSCAPE;

    // 2. Page Setup & Dimensions
    // In docx.umd.js, PageSize checks:
    //   flip = orientation === PageOrientation.LANDSCAPE;
    //   width: flip ? heightTwips : widthTwips;
    // Therefore, width MUST be 11906 and height MUST be 16838.
    const pageWidth = 11906;
    const pageHeight = 16838;

    // Margins (approx 8.5 mm left/right, 6.5 mm top/bottom)
    const marginLR = 480;
    const marginTB = 360;
    const pageMargins = {
      top: marginTB,
      bottom: marginTB,
      left: marginLR,
      right: marginLR
    };

    // Printable page width in twips:
    // Landscape: 16838 - (480 * 2) = 15878 twips
    // Portrait:  11906 - (480 * 2) = 10946 twips
    const usableWidth = isPortrait ? (11906 - marginLR * 2) : (16838 - marginLR * 2);

    // Border Styles
    const borderNone = {
      top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
    };

    const borderThinBlack = {
      top: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
      bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
      left: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
      right: { style: BorderStyle.SINGLE, size: 6, color: '000000' }
    };

    const borderCellMeta = {
      top: { style: BorderStyle.SINGLE, size: 4, color: '94A3B8' },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: '94A3B8' },
      left: { style: BorderStyle.SINGLE, size: 4, color: '94A3B8' },
      right: { style: BorderStyle.SINGLE, size: 4, color: '94A3B8' }
    };

    // 3. Official Logos (from global.TemplateAssets)
    const dakahliaLogoBytes = global.TemplateAssets ? base64ToUint8Array(global.TemplateAssets.DAKAHLIA_LOGO) : null;
    const spatialLogoBytes = global.TemplateAssets ? base64ToUint8Array(global.TemplateAssets.SPATIAL_LOGO) : null;
    const northArrowBytes = global.TemplateAssets ? base64ToUint8Array(global.TemplateAssets.NORTH_ARROW) : null;

    // ==========================================
    // SECTION A: HEADER TABLE (3 Columns in DXA)
    // ==========================================
    // Left-to-Right layout:
    // Col 0 (Left): Spatial Logo & North Arrow
    // Col 1 (Center): Title Box ("بيان تسلسل زمني")
    // Col 2 (Right): Dakahlia Logo & Text
    const headerColSide = Math.round(usableWidth * 0.28);
    const headerColMid = usableWidth - (headerColSide * 2);

    const headerChildrenLeft = [];
    const leftLogosRuns = [];
    if (northArrowBytes) {
      leftLogosRuns.push(new ImageRun({
        data: northArrowBytes,
        transformation: { width: 24, height: 34 }
      }));
    }
    if (spatialLogoBytes) {
      leftLogosRuns.push(new TextRun({ text: '   ' }));
      leftLogosRuns.push(new ImageRun({
        data: spatialLogoBytes,
        transformation: { width: 50, height: 50 }
      }));
    }
    if (leftLogosRuns.length > 0) {
      headerChildrenLeft.push(new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 0, after: 10 },
        children: leftLogosRuns
      }));
    }

    const headerChildrenCenter = [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        bidirectional: true,
        spacing: { before: 40, after: 40 },
        children: [
          new TextRun({
            text: 'بيان تسلسل زمني',
            font: 'Arial',
            bold: true,
            size: 32,
            rightToLeft: true,
            color: '0F172A'
          })
        ]
      })
    ];

    const headerChildrenRight = [];
    if (dakahliaLogoBytes) {
      headerChildrenRight.push(new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 0, after: 10 },
        children: [
          new ImageRun({
            data: dakahliaLogoBytes,
            transformation: { width: 50, height: 50 }
          })
        ]
      }));
    }
    headerChildrenRight.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        bidirectional: true,
        spacing: { before: 0, after: 10, line: 200 },
        children: [
          new TextRun({ text: 'محافظة الدقهلية', font: 'Arial', bold: true, size: 19, rightToLeft: true })
        ]
      }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        bidirectional: true,
        spacing: { before: 0, after: 10, line: 200 },
        children: [
          new TextRun({ text: 'ديوان عام المحافظة', font: 'Arial', bold: true, size: 17, rightToLeft: true })
        ]
      }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        bidirectional: true,
        spacing: { before: 0, after: 10, line: 200 },
        children: [
          new TextRun({ text: 'وحدة المتغيرات المكانية', font: 'Arial', bold: true, size: 17, rightToLeft: true })
        ]
      })
    );

    const headerTable = new Table({
      width: { size: usableWidth, type: WidthType.DXA },
      alignment: AlignmentType.CENTER,
      borders: borderNone,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: headerColSide, type: WidthType.DXA },
              borders: borderNone,
              verticalAlign: VerticalAlign.CENTER,
              children: headerChildrenLeft
            }),
            new TableCell({
              width: { size: headerColMid, type: WidthType.DXA },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 8, color: '1E293B' },
                bottom: { style: BorderStyle.SINGLE, size: 8, color: '1E293B' },
                left: { style: BorderStyle.SINGLE, size: 8, color: '1E293B' },
                right: { style: BorderStyle.SINGLE, size: 8, color: '1E293B' }
              },
              shading: { fill: 'F1F5F9', type: ShadingType.CLEAR },
              verticalAlign: VerticalAlign.CENTER,
              children: headerChildrenCenter
            }),
            new TableCell({
              width: { size: headerColSide, type: WidthType.DXA },
              borders: borderNone,
              verticalAlign: VerticalAlign.CENTER,
              children: headerChildrenRight
            })
          ]
        })
      ]
    });

    // ==========================================
    // SECTION B: CITIZEN SURVEY METADATA TABLE
    // ==========================================
    // Compute accurate geometric centroid for the parcel:
    const centroid = calculatePolygonCentroid(parcel);
    const centerLng = (centroid.lon !== null && !isNaN(centroid.lon)) ? centroid.lon.toFixed(6) : '—';
    const centerLat = (centroid.lat !== null && !isNaN(centroid.lat)) ? centroid.lat.toFixed(6) : '—';

    const colMeta0 = Math.round(usableWidth * 0.16); // العنوان
    const colMeta1 = Math.round(usableWidth * 0.15); // الوحدة المحلية
    const colMeta2 = Math.round(usableWidth * 0.14); // المركز
    const colMeta3 = Math.round(usableWidth * 0.14); // خط العرض
    const colMeta4 = Math.round(usableWidth * 0.14); // خط الطول
    const colMeta5 = usableWidth - (colMeta0 + colMeta1 + colMeta2 + colMeta3 + colMeta4); // اسم المواطن (~27%)

    const applicantName = parcel.applicantName || '—';
    const markaz = parcel.markaz || parcel.centerCity || '—';
    const village = parcel.village || parcel.sheikhah || '—';
    const address = parcel.basin || parcel.address || parcel.placeName || '—';

    function createMetaHeaderCell(text, widthDxa) {
      return new TableCell({
        width: { size: widthDxa, type: WidthType.DXA },
        borders: borderCellMeta,
        shading: { fill: 'E2E8F0', type: ShadingType.CLEAR },
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 70, bottom: 70, left: 60, right: 60 },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            bidirectional: true,
            spacing: { before: 20, after: 20 },
            children: [
              new TextRun({ text, font: 'Arial', bold: true, size: 19, rightToLeft: true, color: '0F172A' })
            ]
          })
        ]
      });
    }

    function createMetaValueCell(text, widthDxa) {
      return new TableCell({
        width: { size: widthDxa, type: WidthType.DXA },
        borders: borderCellMeta,
        shading: { fill: 'FFFFFF', type: ShadingType.CLEAR },
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 70, bottom: 70, left: 60, right: 60 },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            bidirectional: true,
            spacing: { before: 20, after: 20 },
            children: [
              new TextRun({ text: String(text), font: 'Arial', bold: true, size: 18, rightToLeft: true, color: '1E293B' })
            ]
          })
        ]
      });
    }

    const metadataTable = new Table({
      width: { size: usableWidth, type: WidthType.DXA },
      alignment: AlignmentType.CENTER,
      borders: borderCellMeta,
      rows: [
        new TableRow({
          children: [
            createMetaHeaderCell('العنوان / الحوض', colMeta0),
            createMetaHeaderCell('الوحدة المحلية', colMeta1),
            createMetaHeaderCell('المركز', colMeta2),
            createMetaHeaderCell('خط العرض', colMeta3),
            createMetaHeaderCell('خط الطول', colMeta4),
            createMetaHeaderCell('اسم المواطن', colMeta5)
          ]
        }),
        new TableRow({
          children: [
            createMetaValueCell(address, colMeta0),
            createMetaValueCell(village, colMeta1),
            createMetaValueCell(markaz, colMeta2),
            createMetaValueCell(centerLat, colMeta3),
            createMetaValueCell(centerLng, colMeta4),
            createMetaValueCell(applicantName, colMeta5)
          ]
        })
      ]
    });

    // ==========================================
    // SECTION C: SATELLITE IMAGES & CAPTIONS
    // ==========================================
    // In Arabic reading from RIGHT to LEFT:
    // FAR RIGHT = Oldest Shot (sortedShots[0])
    // FAR LEFT  = Newest Shot (sortedShots[shotCount - 1])
    //
    // Physical Left-to-Right cells:
    // Cell 0 (Left) = Newest
    // Cell Last (Right) = Oldest
    //
    // Enlarged image dimensions to give a balanced, filled presentation across the page:
    const imageDocElements = [];

    if (!isPortrait) {
      if (shotCount === 4) {
        // 4 SHOTS: 2x2 Grid (2 on top, 2 on bottom) - matching user requirement
        const colDxa = Math.floor(usableWidth / 2);
        const colDxa2 = usableWidth - colDxa;
        const imgW = 340;
        const imgH = 145;

        function createDocxShotCell(shot, colWidth) {
          const rawImg = shot.imageData || shot.dataUrl;
          const shotBytes = base64ToUint8Array(rawImg);
          return new TableCell({
            width: { size: colWidth, type: WidthType.DXA },
            borders: borderThinBlack,
            shading: { fill: '000000', type: ShadingType.CLEAR },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 8, after: 8 },
                children: shotBytes ? [
                  new ImageRun({
                    data: shotBytes,
                    transformation: { width: imgW, height: imgH }
                  })
                ] : [
                  new TextRun({ text: 'صورة غير متاحة', font: 'Arial', size: 16, color: 'FFFFFF' })
                ]
              })
            ]
          });
        }

        function createDocxCapCell(shot, colWidth) {
          let statusText = shot.status || 'معاينة الموقع';
          if (shot.notes && !statusText.includes(shot.notes)) {
            statusText = `${statusText} (${shot.notes})`;
          }
          const captionText = `${statusText} في ${shot.captureDate || '—'}`;

          return new TableCell({
            width: { size: colWidth, type: WidthType.DXA },
            borders: borderThinBlack,
            shading: { fill: 'F1F5F9', type: ShadingType.CLEAR },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 40, bottom: 40, left: 40, right: 40 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                bidirectional: true,
                spacing: { before: 15, after: 15 },
                children: [
                  new TextRun({
                    text: captionText,
                    font: 'Arial',
                    bold: true,
                    size: 16,
                    rightToLeft: true,
                    color: '0F172A'
                  })
                ]
              })
            ]
          });
        }

        // Arabic RTL: Left cell is newer, Right cell is older
        const row1 = [sortedShots[1], sortedShots[0]];
        const row2 = [sortedShots[3], sortedShots[2]];

        imageDocElements.push(new Table({
          width: { size: usableWidth, type: WidthType.DXA },
          alignment: AlignmentType.CENTER,
          borders: borderThinBlack,
          rows: [
            new TableRow({ children: [createDocxShotCell(row1[0], colDxa), createDocxShotCell(row1[1], colDxa2)] }),
            new TableRow({ children: [createDocxCapCell(row1[0], colDxa), createDocxCapCell(row1[1], colDxa2)] }),
            new TableRow({ children: [createDocxShotCell(row2[0], colDxa), createDocxShotCell(row2[1], colDxa2)] }),
            new TableRow({ children: [createDocxCapCell(row2[0], colDxa), createDocxCapCell(row2[1], colDxa2)] })
          ]
        }));
      } else {
        // LANDSCAPE: 2, 3, or 5 shots in 1 horizontal row
        let imgW = 240;
        let imgH = 170;
        if (shotCount === 2) {
          imgW = 460;
          imgH = 240;
        } else if (shotCount === 3) {
          imgW = 330;
          imgH = 210;
        } else if (shotCount === 5) {
          imgW = 210;
          imgH = 155;
        }

        const colDxa = Math.floor(usableWidth / shotCount);
        const displayShots = [...sortedShots].reverse();

        const imgCells = [];
        const capCells = [];

        for (let i = 0; i < shotCount; i++) {
          const shot = displayShots[i];
          const actualColWidth = (i === shotCount - 1) ? (usableWidth - colDxa * (shotCount - 1)) : colDxa;

          // Support both imageData and dataUrl
          const rawImg = shot.imageData || shot.dataUrl;
          const shotBytes = base64ToUint8Array(rawImg);

          // Image Cell
          imgCells.push(new TableCell({
            width: { size: actualColWidth, type: WidthType.DXA },
            borders: borderThinBlack,
            shading: { fill: '000000', type: ShadingType.CLEAR },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 10, after: 10 },
                children: shotBytes ? [
                  new ImageRun({
                    data: shotBytes,
                    transformation: { width: imgW, height: imgH }
                  })
                ] : [
                  new TextRun({ text: 'صورة غير متاحة', font: 'Arial', size: 16, color: 'FFFFFF' })
                ]
              })
            ]
          }));

          // Caption Cell
          let statusText = shot.status || 'معاينة الموقع';
          if (shot.notes && !statusText.includes(shot.notes)) {
            statusText = `${statusText} (${shot.notes})`;
          }
          const captionText = `${statusText} في ${shot.captureDate || '—'}`;

          capCells.push(new TableCell({
            width: { size: actualColWidth, type: WidthType.DXA },
            borders: borderThinBlack,
            shading: { fill: 'F1F5F9', type: ShadingType.CLEAR },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 40, bottom: 40, left: 40, right: 40 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                bidirectional: true,
                spacing: { before: 15, after: 15 },
                children: [
                  new TextRun({
                    text: captionText,
                    font: 'Arial',
                    bold: true,
                    size: shotCount >= 5 ? 15 : 17,
                    rightToLeft: true,
                    color: '0F172A'
                  })
                ]
              })
            ]
          }));
        }

        imageDocElements.push(new Table({
          width: { size: usableWidth, type: WidthType.DXA },
          alignment: AlignmentType.CENTER,
          borders: borderThinBlack,
          rows: [
            new TableRow({ children: imgCells }),
            new TableRow({ children: capCells })
          ]
        }));
      }

    } else {
      // PORTRAIT: Exactly 6 shots in a 2x3 Grid
      // Enlarged to fill portrait page harmoniously:
      const imgW = 215;
      const imgH = 145;
      const colDxa = Math.floor(usableWidth / 3);

      function buildGridRow(shotsSublist) {
        const displaySublist = [...shotsSublist].reverse();
        const iCells = [];
        const cCells = [];

        for (let i = 0; i < displaySublist.length; i++) {
          const shot = displaySublist[i];
          const actualColWidth = (i === displaySublist.length - 1) ? (usableWidth - colDxa * (displaySublist.length - 1)) : colDxa;
          const rawImg = shot.imageData || shot.dataUrl;
          const shotBytes = base64ToUint8Array(rawImg);

          iCells.push(new TableCell({
            width: { size: actualColWidth, type: WidthType.DXA },
            borders: borderThinBlack,
            shading: { fill: '000000', type: ShadingType.CLEAR },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 10, after: 10 },
                children: shotBytes ? [
                  new ImageRun({
                    data: shotBytes,
                    transformation: { width: imgW, height: imgH }
                  })
                ] : [
                  new TextRun({ text: 'صورة غير متاحة', font: 'Arial', size: 16, color: 'FFFFFF' })
                ]
              })
            ]
          }));

          const captionText = `${shot.status || 'معاينة الموقع'} في ${shot.captureDate || '—'}`;
          cCells.push(new TableCell({
            width: { size: actualColWidth, type: WidthType.DXA },
            borders: borderThinBlack,
            shading: { fill: 'F1F5F9', type: ShadingType.CLEAR },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 40, bottom: 40, left: 40, right: 40 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                bidirectional: true,
                spacing: { before: 20, after: 20 },
                children: [
                  new TextRun({
                    text: captionText,
                    font: 'Arial',
                    bold: true,
                    size: 16,
                    rightToLeft: true,
                    color: '0F172A'
                  })
                ]
              })
            ]
          }));
        }
        return [
          new TableRow({ children: iCells }),
          new TableRow({ children: cCells })
        ];
      }

      const gridRowsTop = buildGridRow(sortedShots.slice(0, 3));
      const gridRowsBottom = buildGridRow(sortedShots.slice(3, 6));

      imageDocElements.push(new Table({
        width: { size: usableWidth, type: WidthType.DXA },
        alignment: AlignmentType.CENTER,
        borders: borderThinBlack,
        rows: [
          ...gridRowsTop,
          ...gridRowsBottom
        ]
      }));
    }

    // ==========================================
    // SECTION D: LEGAL DISCLAIMER BOX (DXA)
    // ==========================================
    // Strictly right-aligned with Eastern Arabic numerals (١- إلى ٥-)
    const legalItems = [
      '١- هذا البيان تم استخراجه بناء على الطلب المقدم من المواطن وطبقا للبيانات والمستندات التي تقدم بها وكذا طبقا لإرشاده للموقع.',
      '٢- يتحمل المواطن كافة المسئوليات القانونية والجنائية والمدنية كاملا عن أي بيانات او مستندات او ارشاد غير صحيح.',
      '٣- هذا البيان لا يعتد به كسند ملكية او فصل ملكية .',
      '٤- هذا البيان لا يحدد تاريخ بناء المبنى او تاريخ بناء أي دور في المبنى .',
      '٥- هذا البيان طبقا للقطات الصورة الفضائية المتاحة على برنامج Google Earth .'
    ];

    const disclaimerParagraphs = legalItems.map((item, idx) => {
      return new Paragraph({
        alignment: AlignmentType.RIGHT,
        bidirectional: true,
        spacing: { before: 6, after: 6, line: 240 },
        children: [
          new TextRun({
            text: item,
            font: 'Arial',
            bold: (idx === 1), // Emphasize citizen legal responsibility
            size: 16,
            rightToLeft: true,
            color: '1E293B'
          })
        ]
      });
    });

    const disclaimerTable = new Table({
      width: { size: usableWidth, type: WidthType.DXA },
      alignment: AlignmentType.CENTER,
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: '94A3B8' },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: '94A3B8' },
        left: { style: BorderStyle.SINGLE, size: 4, color: '94A3B8' },
        right: { style: BorderStyle.SINGLE, size: 4, color: '94A3B8' }
      },
      shading: { fill: 'F8FAFC', type: ShadingType.CLEAR },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: usableWidth, type: WidthType.DXA },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 4, color: '94A3B8' },
                bottom: { style: BorderStyle.SINGLE, size: 4, color: '94A3B8' },
                left: { style: BorderStyle.SINGLE, size: 4, color: '94A3B8' },
                right: { style: BorderStyle.SINGLE, size: 4, color: '94A3B8' }
              },
              margins: { top: 70, bottom: 70, left: 120, right: 140 },
              children: disclaimerParagraphs
            })
          ]
        })
      ]
    });

    // ==========================================
    // SECTION E: SIGNATORY BLOCK (3 Columns in DXA)
    // ==========================================
    // Left-to-Right physical cells:
    // Col 0 (Left): يعتمد السكرتير العام للمحافظة
    // Col 1 (Center): مدير وحدة المتغيرات المكانية
    // Col 2 (Right): مسؤول المتغيرات المكانية
    const sigColW = Math.floor(usableWidth / 3);
    const sigColLast = usableWidth - (sigColW * 2);

    const sigCellLeft = new TableCell({
      width: { size: sigColW, type: WidthType.DXA },
      borders: borderNone,
      verticalAlign: VerticalAlign.CENTER,
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          bidirectional: true,
          spacing: { before: 0, after: 5 },
          children: [
            new TextRun({ text: 'يعتمد ،،', font: 'Arial', bold: true, size: 18, rightToLeft: true })
          ]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          bidirectional: true,
          spacing: { before: 0, after: 5 },
          children: [
            new TextRun({ text: 'السكرتير العام للمحافظة', font: 'Arial', bold: true, size: 17, rightToLeft: true })
          ]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          bidirectional: true,
          spacing: { before: 0, after: 5 },
          children: [
            new TextRun({ text: `${reviewerName}`, font: 'Arial', bold: true, size: 18, rightToLeft: true })
          ]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          bidirectional: true,
          spacing: { before: 0, after: 0 },
          children: [
            new TextRun({ text: 'وكيل أول الوزارة', font: 'Arial', bold: true, size: 16, rightToLeft: true })
          ]
        })
      ]
    });

    const sigCellCenter = new TableCell({
      width: { size: sigColW, type: WidthType.DXA },
      borders: borderNone,
      verticalAlign: VerticalAlign.CENTER,
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          bidirectional: true,
          spacing: { before: 0, after: 10 },
          children: [
            new TextRun({ text: 'مدير وحدة المتغيرات المكانية', font: 'Arial', bold: true, size: 18, rightToLeft: true })
          ]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          bidirectional: true,
          spacing: { before: 10, after: 0 },
          children: [
            new TextRun({ text: `مهندسة / ${directorName}`, font: 'Arial', bold: true, size: 17, rightToLeft: true })
          ]
        })
      ]
    });

    const sigCellRight = new TableCell({
      width: { size: sigColLast, type: WidthType.DXA },
      borders: borderNone,
      verticalAlign: VerticalAlign.CENTER,
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          bidirectional: true,
          spacing: { before: 0, after: 10 },
          children: [
            new TextRun({ text: 'مسئول المتغيرات المكانية', font: 'Arial', bold: true, size: 18, rightToLeft: true })
          ]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          bidirectional: true,
          spacing: { before: 10, after: 0 },
          children: [
            new TextRun({ text: `الاسم: ${surveyorName}`, font: 'Arial', bold: true, size: 17, rightToLeft: true })
          ]
        })
      ]
    });

    const signaturesTable = new Table({
      width: { size: usableWidth, type: WidthType.DXA },
      alignment: AlignmentType.CENTER,
      borders: borderNone,
      rows: [
        new TableRow({
          children: [sigCellLeft, sigCellCenter, sigCellRight]
        })
      ]
    });

    // Spacer Helper
    function createSpacer(twips) {
      return new Paragraph({
        spacing: { before: twips, after: 0 },
        children: []
      });
    }

    // ==========================================
    // ASSEMBLE COMPLETE SINGLE PAGE DOCUMENT
    // ==========================================
    const spacerVal = isPortrait ? 60 : 70;
    const docChildren = [
      headerTable,
      createSpacer(spacerVal),
      metadataTable,
      createSpacer(spacerVal),
      ...imageDocElements,
      createSpacer(spacerVal),
      disclaimerTable,
      createSpacer(spacerVal),
      signaturesTable
    ];

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              size: {
                orientation: orientation,
                width: pageWidth,
                height: pageHeight
              },
              margin: pageMargins,
              borders: {
                pageBorders: {
                  top: { style: BorderStyle.DOUBLE, size: 12, space: 4, color: '000000' },
                  bottom: { style: BorderStyle.DOUBLE, size: 12, space: 4, color: '000000' },
                  left: { style: BorderStyle.DOUBLE, size: 12, space: 4, color: '000000' },
                  right: { style: BorderStyle.DOUBLE, size: 12, space: 4, color: '000000' }
                }
              }
            }
          },
          children: docChildren
        }
      ]
    });

    // 4. Pack to Blob
    const blob = await Packer.toBlob(doc);
    return blob;
  }

  // Export to global scope
  global.DocxBuilder = {
    generateDocxReport: generateDocxReport
  };

})(typeof window !== 'undefined' ? window : this);
