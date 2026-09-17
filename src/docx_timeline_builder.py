"""
Spatial Changes Over Time System - Word Report Generator Engine
===============================================================
Generates an official, print-ready Microsoft Word report (.docx) documenting
spatial and structural changes over time for any given cadastral parcel.
Includes:
- Official governmental branding & header table.
- Parcel metadata & corner coordinate list.
- Chronological satellite imagery snapshots with date badges.
- Formatted observation & comment sections under each year.
- Official committee signature block.
"""

import os
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

FONT_FAMILY = "Arial"


def set_cell_background(cell, hex_color):
    """Sets background color of a table cell."""
    tcPr = cell._element.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:val="clear" w:color="auto" w:fill="{hex_color}"/>')
    tcPr.append(shd)


def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    """Sets internal padding (margins) for a table cell in dxa (1 pt = 20 dxa)."""
    tcPr = cell._element.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = OxmlElement(f'w:{m}')
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)


def set_cell_border(cell, **kwargs):
    """
    Sets cell borders.
    kwargs: top, bottom, left, right
    values: {"sz": 4, "val": "single", "color": "CCCCCC"}
    """
    tcPr = cell._element.get_or_add_tcPr()
    tcBorders = OxmlElement('w:tcBorders')
    for border_name in ['top', 'left', 'bottom', 'right']:
        if border_name in kwargs:
            edge = OxmlElement(f'w:{border_name}')
            for key, val in kwargs[border_name].items():
                edge.set(qn(f'w:{key}'), str(val))
            tcBorders.append(edge)
    tcPr.append(tcBorders)


def style_run(run, font_name=FONT_FAMILY, size_pt=12, bold=False, color_rgb=(0, 0, 0), italic=False):
    """Applies strict typography and complex script (RTL) fonts to a run."""
    run.font.name = font_name
    run.font.size = Pt(size_pt)
    run.font.bold = bold
    run.font.italic = italic
    run.font.color.rgb = RGBColor(*color_rgb)
    
    # Enforce RTL and complex script XML properties
    rPr = run._element.get_or_add_rPr()
    rFonts = OxmlElement('w:rFonts')
    rFonts.set(qn('w:ascii'), font_name)
    rFonts.set(qn('w:hAnsi'), font_name)
    rFonts.set(qn('w:cs'), font_name)
    rPr.append(rFonts)

    if bold:
        bCs = OxmlElement('w:bCs')
        rPr.append(bCs)

    rtl = OxmlElement('w:rtl')
    rPr.append(rtl)


def add_styled_paragraph(doc, text="", align=WD_ALIGN_PARAGRAPH.RIGHT, space_before=0, space_after=0, line_spacing=1.15):
    """Adds a paragraph with strict zero/tight spacing and RTL alignment."""
    p = doc.add_paragraph()
    p.alignment = align
    p.paragraph_format.space_before = Pt(space_before)
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.line_spacing = line_spacing

    # Enforce RTL
    pPr = p._element.get_or_add_pPr()
    bidi = OxmlElement('w:bidi')
    pPr.append(bidi)
    return p


def build_timeline_report(parcel, yearly_items, output_docx_path, staff_signatures=None):
    """
    Builds the complete Word document (.docx).
    parcel: dict from geo_parser
    yearly_items: list of dicts:
       [
          {
             "year": 2018,
             "release_date": "2018-07-25",
             "image_path": "path/to/sat.jpg",
             "comment": "Surveyor comment or empty string"
          }, ...
       ]
    staff_signatures: dict of staff titles and names
    """
    if staff_signatures is None:
        staff_signatures = {
            "survey_tech": "محمد ابراهيم بدير",
            "changes_specialist": "أحمد عبد الله",
            "gis_officer": "شريف محمد",
            "director": "م / السيد زين العابدين"
        }

    doc = docx.Document()

    # Page Margins: 0.5 in top/bottom, 0.6 in left/right
    for section in doc.sections:
        section.top_margin = Inches(0.5)
        section.bottom_margin = Inches(0.5)
        section.left_margin = Inches(0.6)
        section.right_margin = Inches(0.6)

    # 1. Header Title & Branding
    p_header = add_styled_paragraph(doc, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=2)
    r1 = p_header.add_run("جمهورية مصر العربية - محافظة الدقهلية\nمركز معلومات شبكات المرافق\n")
    style_run(r1, size_pt=13, bold=True, color_rgb=(30, 41, 59))
    r2 = p_header.add_run("إدارة رصد المتغيرات المكانية والجيومكانية")
    style_run(r2, size_pt=11, bold=True, color_rgb=(71, 85, 105))

    p_title = add_styled_paragraph(doc, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=4, space_after=8)
    r_title = p_title.add_run("تقرير رصد التغيرات المكانية والإنشائية عبر الزمن")
    style_run(r_title, size_pt=16, bold=True, color_rgb=(15, 23, 42))

    # 2. Citizen & Parcel Metadata Table
    passes_cnt = parcel.get("passes_count")
    passes_val = f"{passes_cnt} تصويرات حقيقية" if passes_cnt else f"{len(yearly_items)} تصويرات"
    trans_info = " - ".join(filter(None, [parcel.get("transaction_type"), parcel.get("site_description")]))

    meta_fields = [
        [("اسم مقدم الطلب:", parcel.get("applicant_name", "")), ("الرقم القومي:", parcel.get("national_id", ""))],
        [("المركز / المدينة:", parcel.get("center_city", "")), ("القرية / الحوض:", parcel.get("village", ""))],
        [("تاريخ بداية الرصد:", parcel.get("start_date", "")), ("المساحة المحسوبة:", f"{parcel.get('calculated_area_m2', 0):.2f} م²")],
        [("نظام الإحداثيات:", parcel.get("crs", "WGS84")), ("التصويرات الجوية المتاحة:", passes_val)]
    ]
    if trans_info or parcel.get("stated_area_m2"):
        meta_fields.append([
            ("وصف التعامل / الموقع:", trans_info or "غير محدد"),
            ("المساحة المذكورة:", f"{parcel.get('stated_area_m2', 0):.2f} م²")
        ])

    table_meta = doc.add_table(rows=len(meta_fields), cols=4)
    table_meta.alignment = WD_TABLE_ALIGNMENT.CENTER
    table_meta.autofit = False

    for row_idx, row_data in enumerate(meta_fields):
        # Col 0: Label 1, Col 1: Value 1, Col 2: Label 2, Col 3: Value 2
        (lbl1, val1), (lbl2, val2) = row_data

        cell_l1 = table_meta.cell(row_idx, 0)
        cell_v1 = table_meta.cell(row_idx, 1)
        cell_l2 = table_meta.cell(row_idx, 2)
        cell_v2 = table_meta.cell(row_idx, 3)

        cell_l1.width = Inches(1.5)
        cell_v1.width = Inches(2.1)
        cell_l2.width = Inches(1.5)
        cell_v2.width = Inches(2.1)

        for c, lbl, val in [(cell_l1, lbl1, None), (cell_v1, None, val1), (cell_l2, lbl2, None), (cell_v2, None, val2)]:
            set_cell_background(c, "F1F5F9" if lbl else "FFFFFF")
            set_cell_margins(c, top=80, bottom=80, left=100, right=100)
            set_cell_border(c,
                top={"sz": 4, "val": "single", "color": "CBD5E1"},
                bottom={"sz": 4, "val": "single", "color": "CBD5E1"},
                left={"sz": 4, "val": "single", "color": "CBD5E1"},
                right={"sz": 4, "val": "single", "color": "CBD5E1"}
            )
            p = c.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            r = p.add_run(lbl if lbl else str(val))
            style_run(r, size_pt=11, bold=True if lbl else False, color_rgb=(15, 23, 42))

    # Corner Coordinates Sub-table (compact)
    p_coord_lbl = add_styled_paragraph(doc, space_before=6, space_after=2)
    r_c_lbl = p_coord_lbl.add_run("إحداثيات أركان الموقع (WGS84):")
    style_run(r_c_lbl, size_pt=11, bold=True, color_rgb=(30, 41, 59))

    n_verts = len(parcel.get("vertices", []))
    table_pts = doc.add_table(rows=n_verts + 1, cols=3)
    table_pts.alignment = WD_TABLE_ALIGNMENT.CENTER
    table_pts.autofit = False

    headers = ["رقم النقطة", "خط الطول (Longitude E)", "دائرة العرض (Latitude N)"]
    widths = [Inches(1.2), Inches(3.0), Inches(3.0)]

    for c_idx, h_text in enumerate(headers):
        cell = table_pts.cell(0, c_idx)
        cell.width = widths[c_idx]
        set_cell_background(cell, "E2E8F0")
        set_cell_margins(cell, top=60, bottom=60, left=100, right=100)
        set_cell_border(cell,
            top={"sz": 4, "val": "single", "color": "94A3B8"},
            bottom={"sz": 6, "val": "single", "color": "64748B"},
            left={"sz": 4, "val": "single", "color": "94A3B8"},
            right={"sz": 4, "val": "single", "color": "94A3B8"}
        )
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(0)
        r = p.add_run(h_text)
        style_run(r, size_pt=10.5, bold=True, color_rgb=(15, 23, 42))

    for idx, v in enumerate(parcel.get("vertices", []), 1):
        row_cells = [table_pts.cell(idx, 0), table_pts.cell(idx, 1), table_pts.cell(idx, 2)]
        vals = [str(v.get("id", idx)), v.get("lon_str", f"{v['lon']:.8f}"), v.get("lat_str", f"{v['lat']:.8f}")]
        for c_idx, c in enumerate(row_cells):
            c.width = widths[c_idx]
            set_cell_background(c, "F8FAFC" if idx % 2 == 1 else "FFFFFF")
            set_cell_margins(c, top=40, bottom=40, left=80, right=80)
            set_cell_border(c,
                top={"sz": 3, "val": "single", "color": "CBD5E1"},
                bottom={"sz": 3, "val": "single", "color": "CBD5E1"},
                left={"sz": 3, "val": "single", "color": "CBD5E1"},
                right={"sz": 3, "val": "single", "color": "CBD5E1"}
            )
            p = c.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            r = p.add_run(vals[c_idx])
            style_run(r, size_pt=10, bold=(c_idx == 0), color_rgb=(15, 23, 42))

    # Page Break after cover metadata to start timeline cards cleanly
    doc.add_page_break()

    # 3. Chronological Yearly Timeline Cards
    p_tl_hdr = add_styled_paragraph(doc, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=4, space_after=12)
    r_tl_hdr = p_tl_hdr.add_run("سلسلة صور الأقمار الصناعية التاريخية ورصد التغيرات الزمنية")
    style_run(r_tl_hdr, size_pt=15, bold=True, color_rgb=(15, 23, 42))

    for item_idx, item in enumerate(yearly_items, 1):
        year = item.get("year", "")
        rel_date = item.get("release_date", "")
        img_path = item.get("image_path", "")
        comment = item.get("comment", "").strip()
        lbl_display = item.get("label") or f"تصوير سنة {year}"

        # Year Title
        p_yr = add_styled_paragraph(doc, space_before=10, space_after=4)
        r_yr = p_yr.add_run(f"🛰️ {lbl_display}")
        style_run(r_yr, size_pt=13, bold=True, color_rgb=(2, 132, 199))

        # Satellite Image Table Container
        tbl_img = doc.add_table(rows=1, cols=1)
        tbl_img.alignment = WD_TABLE_ALIGNMENT.CENTER
        cell_img = tbl_img.cell(0, 0)
        cell_img.width = Inches(6.8)
        set_cell_background(cell_img, "0F172A")
        set_cell_margins(cell_img, top=100, bottom=100, left=100, right=100)
        set_cell_border(cell_img,
            top={"sz": 8, "val": "single", "color": "0284C7"},
            bottom={"sz": 8, "val": "single", "color": "0284C7"},
            left={"sz": 8, "val": "single", "color": "0284C7"},
            right={"sz": 8, "val": "single", "color": "0284C7"}
        )

        p_img = cell_img.paragraphs[0]
        p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_img.paragraph_format.space_before = Pt(0)
        p_img.paragraph_format.space_after = Pt(0)

        if os.path.exists(img_path):
            p_img.add_run().add_picture(img_path, width=Inches(6.6))
        else:
            r_err = p_img.add_run("[صورة القمر الصناعي غير متوفرة]")
            style_run(r_err, size_pt=12, color_rgb=(239, 68, 68))

        # Observation / Comment Section directly beneath image
        tbl_comm = doc.add_table(rows=1, cols=1)
        tbl_comm.alignment = WD_TABLE_ALIGNMENT.CENTER
        cell_comm = tbl_comm.cell(0, 0)
        cell_comm.width = Inches(6.8)
        set_cell_background(cell_comm, "F8FAFC")
        set_cell_margins(cell_comm, top=120, bottom=120, left=150, right=150)
        set_cell_border(cell_comm,
            top={"sz": 4, "val": "single", "color": "94A3B8"},
            bottom={"sz": 6, "val": "single", "color": "64748B"},
            left={"sz": 4, "val": "single", "color": "94A3B8"},
            right={"sz": 4, "val": "single", "color": "94A3B8"}
        )

        p_c_title = cell_comm.paragraphs[0]
        p_c_title.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        p_c_title.paragraph_format.space_before = Pt(0)
        p_c_title.paragraph_format.space_after = Pt(4)
        r_ct = p_c_title.add_run(f"ملاحظات الفحص والمعاينة الميدانية ({lbl_display}):")
        style_run(r_ct, size_pt=11.5, bold=True, color_rgb=(30, 41, 59))

        if comment:
            # User provided a typed comment in the UI
            p_comm_text = cell_comm.add_paragraph()
            p_comm_text.alignment = WD_ALIGN_PARAGRAPH.RIGHT
            p_comm_text.paragraph_format.space_before = Pt(2)
            p_comm_text.paragraph_format.space_after = Pt(0)
            r_ctext = p_comm_text.add_run(comment)
            style_run(r_ctext, size_pt=11, bold=False, color_rgb=(15, 23, 42))
        else:
            # Empty / handwriting mode: provide structured lines and checklist
            p_check = cell_comm.add_paragraph()
            p_check.alignment = WD_ALIGN_PARAGRAPH.RIGHT
            p_check.paragraph_format.space_before = Pt(2)
            p_check.paragraph_format.space_after = Pt(4)
            r_chk = p_check.add_run("الموقف البنائي:  [   ] أرض فضاء      [   ] تشوين مواد بناء      [   ] صب قواعد وسملات      [   ] دور أرضي      [   ] تعلية أدوار")
            style_run(r_chk, size_pt=10.5, color_rgb=(71, 85, 105))

            p_line1 = cell_comm.add_paragraph()
            p_line1.alignment = WD_ALIGN_PARAGRAPH.RIGHT
            p_line1.paragraph_format.space_before = Pt(4)
            p_line1.paragraph_format.space_after = Pt(4)
            r_l1 = p_line1.add_run("ملاحظات المعاين: ......................................................................................................................................................")
            style_run(r_l1, size_pt=10.5, color_rgb=(148, 163, 184))

            p_line2 = cell_comm.add_paragraph()
            p_line2.alignment = WD_ALIGN_PARAGRAPH.RIGHT
            p_line2.paragraph_format.space_before = Pt(0)
            p_line2.paragraph_format.space_after = Pt(0)
            r_l2 = p_line2.add_run("توقيع القائم بالفحص: ..................................................... التاريخ: ..... / ..... / ...........")
            style_run(r_l2, size_pt=10.5, color_rgb=(148, 163, 184))

        # Page break after every 1 or 2 images to ensure clean, uncluttered printout
        # Usually 1 high-res image + comment fits nicely per page
        if item_idx < len(yearly_items):
            doc.add_page_break()

    # 4. Committee Endorsement & Signatures
    p_sig_hdr = add_styled_paragraph(doc, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=16, space_after=8)
    r_sh = p_sig_hdr.add_run("اعتماد وتوقيعات اللجنة الفنية وإدارة المتغيرات المكانية")
    style_run(r_sh, size_pt=13, bold=True, color_rgb=(15, 23, 42))

    if "manager" in staff_signatures and "director" in staff_signatures and "survey_tech" not in staff_signatures:
        sig_titles = [
            ("مدير إدارة المتغيرات المكانية", staff_signatures.get("manager", "م / محمد مصطفى")),
            ("مدير عام المركز", staff_signatures.get("director", "م / السيد زين العابدين"))
        ]
        col_w = Inches(3.4)
    else:
        sig_titles = [
            ("فني المساحة", staff_signatures.get("survey_tech", "محمد ابراهيم بدير")),
            ("باحث المتغيرات المكانية", staff_signatures.get("changes_specialist", "أحمد عبد الله")),
            ("مسؤول النظم الجغرافية", staff_signatures.get("gis_officer", "شريف محمد")),
            ("مدير المركز", staff_signatures.get("director", "م / السيد زين العابدين"))
        ]
        col_w = Inches(1.7)

    tbl_sig = doc.add_table(rows=2, cols=len(sig_titles))
    tbl_sig.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl_sig.autofit = False

    for col_idx, (title, name) in enumerate(sig_titles):
        cell_t = tbl_sig.cell(0, col_idx)
        cell_n = tbl_sig.cell(1, col_idx)
        cell_t.width = col_w
        cell_n.width = col_w

        for c, txt, is_bold in [(cell_t, title, True), (cell_n, f"أ / {name}" if "م /" not in name else name, False)]:
            set_cell_background(c, "F1F5F9" if is_bold else "FFFFFF")
            set_cell_margins(c, top=80, bottom=80, left=60, right=60)
            set_cell_border(c,
                top={"sz": 4, "val": "single", "color": "94A3B8"},
                bottom={"sz": 4, "val": "single", "color": "94A3B8"},
                left={"sz": 4, "val": "single", "color": "94A3B8"},
                right={"sz": 4, "val": "single", "color": "94A3B8"}
            )
            p = c.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            r = p.add_run(txt)
            style_run(r, size_pt=11, bold=is_bold, color_rgb=(15, 23, 42))

    os.makedirs(os.path.dirname(os.path.abspath(output_docx_path)), exist_ok=True)
    doc.save(output_docx_path)
    return output_docx_path
