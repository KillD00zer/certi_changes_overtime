/**
 * Docx Builder for Google Earth Survey Extension
 * Generates official Egyptian DUDC technical inspection report (.docx)
 * with complete Arabic RTL formatting, tables, image embeds, and official signature blocks.
 */

(function (global) {
  function base64ToUint8Array(base64) {
    const raw = base64.replace(/^data:image\/\w+;base64,/, '');
    const binary = atob(raw);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  async function generateDocxReport(parcel, shots, committee) {
    if (!window.docx) {
      throw new Error('مكتبة docx غير محملة في المتصفح.');
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
      VerticalAlign
    } = window.docx;

    const committeeData = committee || {
      surveyor: 'مهندس / فني المساحة',
      reviewer: 'مراجع المتغيرات المكانية',
      director: 'مدير مركز معلومات شبكات المرافق'
    };

    const docChildren = [];

    // Helper: Arabic Paragraph
    function createP(text, opts = {}) {
      return new Paragraph({
        alignment: opts.align || AlignmentType.RIGHT,
        bidirectional: true,
        spacing: {
          before: opts.before || 80,
          after: opts.after || 80,
          line: opts.line || 260
        },
        children: [
          new TextRun({
            text: text,
            font: opts.font || 'Arial',
            size: (opts.size || 11) * 2, // half-points
            bold: !!opts.bold,
            color: opts.color || '111827',
            rightToLeft: true
          })
        ]
      });
    }

    // Helper: Table Cell
    function createCell(text, opts = {}) {
      const isHeader = !!opts.isHeader;
      return new TableCell({
        width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
        shading: {
          fill: isHeader ? (opts.headerBg || '1E3A8A') : (opts.bg || (opts.alt ? 'F9FAFB' : 'FFFFFF')),
          type: ShadingType.CLEAR
        },
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 120, bottom: 120, left: 140, right: 140 },
        children: [
          new Paragraph({
            alignment: opts.align || (isHeader ? AlignmentType.CENTER : AlignmentType.RIGHT),
            bidirectional: true,
            children: [
              new TextRun({
                text: text,
                font: 'Arial',
                size: (opts.size || (isHeader ? 10.5 : 10)) * 2,
                bold: isHeader || !!opts.bold,
                color: isHeader ? (opts.headerColor || 'FFFFFF') : (opts.color || '1F2937'),
                rightToLeft: true
              })
            ]
          })
        ]
      });
    }

    // --- 1. OFFICIAL HEADER ---
    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        bidirectional: true,
        spacing: { before: 0, after: 60 },
        children: [
          new TextRun({ text: 'جمهورية مصر العربية - محافظة الدقهلية', font: 'Arial', size: 24, bold: true, rightToLeft: true })
        ]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        bidirectional: true,
        spacing: { before: 0, after: 120 },
        children: [
          new TextRun({ text: 'مركز معلومات شبكات المرافق (DUDC) - وحدة المتغيرات المكانية والتصالح', font: 'Arial', size: 22, bold: true, color: '1E3A8A', rightToLeft: true })
        ]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        bidirectional: true,
        spacing: { before: 60, after: 200 },
        children: [
          new TextRun({ text: '═════════════════════════════════════════════════════', font: 'Arial', size: 16, color: '9CA3AF' })
        ]
      })
    );

    // --- 2. REPORT TITLE ---
    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        bidirectional: true,
        spacing: { before: 100, after: 180 },
        children: [
          new TextRun({
            text: 'تقرير المعاينة الفنية ورصد التغيرات المكانية والإنشائية عبر الزمن',
            font: 'Arial',
            size: 28,
            bold: true,
            color: '0F172A',
            rightToLeft: true
          })
        ]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        bidirectional: true,
        spacing: { before: 0, after: 240 },
        children: [
          new TextRun({
            text: 'توثيق الأقمار الصناعية التاريخية لطلبات التصالح (القانون رقم 17 لسنة 2019 والقانون رقم 187 لسنة 2023)',
            font: 'Arial',
            size: 20,
            bold: true,
            color: '475569',
            rightToLeft: true
          })
        ]
      })
    );

    // --- 3. APPLICANT & PARCEL DETAILS TABLE ---
    const borderStyle = { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' };
    const borders = { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle };

    const detailsRows = [
      new TableRow({
        children: [
          createCell('اسم مقدم الطلب:', { isHeader: true, width: 25 }),
          createCell(parcel.applicantName || 'غير مسجل', { width: 35, bold: true }),
          createCell('الرقم القومي:', { isHeader: true, width: 18 }),
          createCell(parcel.nationalId || '---', { width: 22, bold: true, align: AlignmentType.CENTER })
        ]
      }),
      new TableRow({
        children: [
          createCell('المركز / المدينة:', { isHeader: true, width: 25 }),
          createCell(parcel.centerCity || '---', { width: 35 }),
          createCell('القرية / الحوض:', { isHeader: true, width: 18 }),
          createCell(parcel.village || '---', { width: 22 })
        ]
      }),
      new TableRow({
        children: [
          createCell('المساحة المحسوبة (م²):', { isHeader: true, width: 25 }),
          createCell(`${parcel.calculatedAreaM2.toFixed(2)} م² (محيط: ${parcel.perimeterM.toFixed(2)} م)`, { width: 35, bold: true, color: 'B91C1C' }),
          createCell('نظام الإحداثيات:', { isHeader: true, width: 18 }),
          createCell(parcel.crs || 'WGS84', { width: 22, size: 9, align: AlignmentType.CENTER })
        ]
      }),
      new TableRow({
        children: [
          createCell('وصف الموقع والتعامل:', { isHeader: true, width: 25 }),
          createCell(parcel.locationDesc || 'معاينة رصد تغيرات مكانية وتصالح', { width: 75, alt: true })
        ]
      })
    ];

    docChildren.push(
      createP('أولاً: البيانات الأساسية للطلب والموقع', { size: 13, bold: true, color: '1E3A8A', before: 180, after: 100 }),
      new Table({
        rows: detailsRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: borders
      })
    );

    // --- 4. CORNER COORDINATES TABLE ---
    const coordHeader = new TableRow({
      children: [
        createCell('رقم النقطة', { isHeader: true, width: 15, align: AlignmentType.CENTER }),
        createCell('خط الطول (Longitude WGS84)', { isHeader: true, width: 28, align: AlignmentType.CENTER }),
        createCell('دائرة العرض (Latitude WGS84)', { isHeader: true, width: 28, align: AlignmentType.CENTER }),
        createCell('الإحداثي الشرقي (X)', { isHeader: true, width: 15, align: AlignmentType.CENTER }),
        createCell('الإحداثي الشمالي (Y)', { isHeader: true, width: 14, align: AlignmentType.CENTER })
      ]
    });

    const coordRows = [coordHeader];
    parcel.vertices.forEach((v, idx) => {
      coordRows.push(
        new TableRow({
          children: [
            createCell(String(v.id || idx + 1), { align: AlignmentType.CENTER, bold: true, alt: idx % 2 === 1 }),
            createCell(v.lon.toFixed(8), { align: AlignmentType.CENTER, alt: idx % 2 === 1 }),
            createCell(v.lat.toFixed(8), { align: AlignmentType.CENTER, alt: idx % 2 === 1 }),
            createCell(v.rawX !== undefined ? v.rawX.toFixed(2) : '---', { align: AlignmentType.CENTER, alt: idx % 2 === 1 }),
            createCell(v.rawY !== undefined ? v.rawY.toFixed(2) : '---', { align: AlignmentType.CENTER, alt: idx % 2 === 1 })
          ]
        })
      );
    });

    docChildren.push(
      createP('ثانياً: جدول إحداثيات أركان الموقع (دقة جيوديسية WGS84)', { size: 13, bold: true, color: '1E3A8A', before: 200, after: 100 }),
      new Table({
        rows: coordRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: borders
      })
    );

    // --- 5. SATELLITE TIMELINE CARDS ---
    docChildren.push(
      createP('ثالثاً: التسلسل الزمني لصور الأقمار الصناعية وحالة المعاينة الإنشائية', { size: 13, bold: true, color: '1E3A8A', before: 240, after: 120 })
    );

    if (shots && shots.length > 0) {
      shots.forEach((shot, sIdx) => {
        // Year Banner
        docChildren.push(
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            bidirectional: true,
            spacing: { before: 200, after: 100 },
            children: [
              new TextRun({
                text: `📍 اللقطة رقم (${sIdx + 1}): رصد عام [${shot.year || 'غير محدد'}] - تاريخ التصوير: ${shot.captureDate || 'معتمد'}`,
                font: 'Arial',
                size: 23,
                bold: true,
                color: '1E3A8A',
                rightToLeft: true
              })
            ]
          })
        );

        // Embed Satellite Image if available
        if (shot.imageData) {
          try {
            const imgBytes = base64ToUint8Array(shot.imageData);
            docChildren.push(
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 80, after: 120 },
                children: [
                  new ImageRun({
                    data: imgBytes,
                    transformation: {
                      width: 580,
                      height: 360
                    }
                  })
                ]
              })
            );
          } catch (e) {
            console.error('Error embedding image in docx:', e);
          }
        }

        // Inspection Notes for this year
        const statusRows = [
          new TableRow({
            children: [
              createCell('الحالة الإنشائية للقطعة في هذا التاريخ:', { isHeader: true, width: 35 }),
              createCell(shot.status ? shot.status : '---', { width: 65, bold: !!shot.status, color: '0F172A' })
            ]
          }),
          new TableRow({
            children: [
              createCell('الملاحظات الفنية للمعاينة:', { isHeader: true, width: 35 }),
              createCell(shot.notes || 'تمت المطابقة والتدقيق بواسطة اللجنة الفنية بالمركز.', { width: 65, alt: true })
            ]
          })
        ];

        docChildren.push(
          new Table({
            rows: statusRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: borders
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 100, after: 160 },
            children: [
              new TextRun({ text: '--------------------------------------------------------------------------------------------------', font: 'Arial', size: 14, color: 'E2E8F0' })
            ]
          })
        );
      });
    } else {
      docChildren.push(
        createP('(لم يتم إدراج لقطات فضائية في التقرير - يرجى استخدام زر التقاط الصور عبر إضافة المتصفح)', { size: 11, color: '64748B' })
      );
    }

    // --- 6. SIGNATURES & ACCREDITATION TABLE ---
    const sigRows = [
      new TableRow({
        children: [
          createCell('فني الرفع المساحي', { isHeader: true, width: 33, align: AlignmentType.CENTER }),
          createCell('مراجع المتغيرات المكانية', { isHeader: true, width: 33, align: AlignmentType.CENTER }),
          createCell('مدير مركز معلومات شبكات المرافق', { isHeader: true, width: 34, align: AlignmentType.CENTER })
        ]
      }),
      new TableRow({
        children: [
          createCell(`\n\nالاسم: ${committeeData.surveyor}\nالتوقيع: .....................\nالتاريخ: .....................\n`, { align: AlignmentType.CENTER, width: 33 }),
          createCell(`\n\nالاسم: ${committeeData.reviewer}\nالتوقيع: .....................\nالتاريخ: .....................\n`, { align: AlignmentType.CENTER, width: 33 }),
          createCell(`\n\nالاسم: ${committeeData.director}\nالتوقيع: .....................\nالتاريخ: .....................\n`, { align: AlignmentType.CENTER, width: 34 })
        ]
      })
    ];

    docChildren.push(
      createP('رابعاً: توقيعات واعتماد اللجنة الفنية', { size: 13, bold: true, color: '1E3A8A', before: 260, after: 120 }),
      new Table({
        rows: sigRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: borders
      })
    );

    // Create Document Object
    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1000,
                bottom: 1000,
                left: 1000,
                right: 1000
              }
            }
          },
          children: docChildren
        }
      ]
    });

    // Generate Blob
    const blob = await Packer.toBlob(doc);
    return blob;
  }

  global.DocxBuilder = {
    generateDocxReport
  };

})(typeof window !== 'undefined' ? window : this);
