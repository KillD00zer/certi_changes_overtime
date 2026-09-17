"""
Spatial Changes Over Time System - Geo Parser Engine
=====================================================
Parses cadastral survey files (.csv, .xlsx, .xls), extracts coordinates,
detects coordinate systems (WGS84, Egyptian Red Belt EPSG:22992, UTM 36N),
calculates geodesic area and bounding boxes, and parses metadata & starting dates.
"""

import os
import re
import datetime
import pandas as pd
from pyproj import Transformer, Geod

ARABIC_TO_ENG = str.maketrans('٠١٢٣٤٥٦٧٨٩،', '0123456789.')
GEOD = Geod(ellps='WGS84')

# Coordinate Transformers
TRANSFORMER_RED_BELT = Transformer.from_crs("EPSG:22992", "EPSG:4326", always_xy=True)
TRANSFORMER_UTM36N   = Transformer.from_crs("EPSG:32636", "EPSG:4326", always_xy=True)


def clean_str(val):
    if pd.isna(val) or val is None:
        return ""
    return " ".join(str(val).strip().split())


def clean_num(val):
    if pd.isna(val) or val is None:
        return None
    s = str(val).translate(ARABIC_TO_ENG).replace(',', '.')
    s = re.sub(r'[^\d.-]', '', s)
    try:
        return float(s)
    except (ValueError, TypeError):
        return None


def parse_date_str(val):
    """Attempts to extract a valid YYYY-MM-DD or YYYY date from string or datetime."""
    if pd.isna(val) or val is None:
        return None
    if isinstance(val, (datetime.date, datetime.datetime)):
        return val.strftime("%Y-%m-%d")
    
    s = str(val).translate(ARABIC_TO_ENG).strip()
    
    # Match YYYY-MM-DD or YYYY/MM/DD
    m = re.search(r'(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})', s)
    if m:
        y, mth, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
        return f"{y:04d}-{mth:02d}-{d:02d}"
    
    # Match DD-MM-YYYY or DD/MM/YYYY
    m = re.search(r'(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})', s)
    if m:
        d, mth, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        return f"{y:04d}-{mth:02d}-{d:02d}"
    
    # Match just Year YYYY
    m = re.search(r'\b(19\d\d|20\d\d)\b', s)
    if m:
        return f"{m.group(1)}-01-01"
    
    return None


def detect_crs_and_transform(coords_raw):
    """
    coords_raw: list of tuples [(x, y), ...]
    Detects whether coordinates are:
    - WGS84 Lat/Lon (or Lon/Lat)
    - Egyptian Red Belt (EPSG:22992)
    - UTM Zone 36N (EPSG:32636)
    Returns: (list of (lon, lat) in WGS84, detected_crs_name)
    """
    if not coords_raw:
        return [], "UNKNOWN"

    sample_x, sample_y = coords_raw[0]

    # Case 1: Already Lat/Lon Decimal Degrees (Egypt is Lat ~22-32, Lon ~25-37)
    if (20 <= sample_x <= 38 and 20 <= sample_y <= 38):
        # Determine which is Lon and which is Lat
        # In Egypt, Longitude is ~25 to ~37, Latitude is ~22 to ~32
        # If sample_x is Lon (~31.5) and sample_y is Lat (~30.8)
        return [(x, y) for x, y in coords_raw], "WGS84 (EPSG:4326)"

    # Case 2: Egyptian Red Belt (EPSG:22992)
    # X ~ 300,000 to 450,000 ; Y ~ 750,000 to 1,050,000
    if (200000 <= sample_x <= 500000 and 700000 <= sample_y <= 1100000):
        transformed = []
        for x, y in coords_raw:
            lon, lat = TRANSFORMER_RED_BELT.transform(x, y)
            transformed.append((lon, lat))
        return transformed, "Egyptian Red Belt (EPSG:22992)"

    # Case 3: UTM Zone 36N (EPSG:32636)
    # X ~ 200,000 to 800,000 ; Y ~ 3,000,000 to 3,600,000
    if (150000 <= sample_x <= 850000 and 3000000 <= sample_y <= 3600000):
        transformed = []
        for x, y in coords_raw:
            lon, lat = TRANSFORMER_UTM36N.transform(x, y)
            transformed.append((lon, lat))
        return transformed, "UTM Zone 36N (EPSG:32636)"

    # Fallback: assume already lon/lat or best effort
    return [(x, y) for x, y in coords_raw], "Assumed WGS84"


def parse_survey_file(file_path, default_start_date=None):
    """
    Parses a survey file (.csv, .xlsx, .xls) and returns a structured dictionary:
    {
        "applicant_name": str,
        "national_id": str,
        "center_city": str,
        "village": str,
        "start_date": str (YYYY-MM-DD),
        "start_year": int,
        "stated_area_m2": float,
        "calculated_area_m2": float,
        "perimeter_m": float,
        "crs": str,
        "vertices": [{"id": 1, "lon": float, "lat": float, "raw_x": float, "raw_y": float}, ...],
        "bounds": {"min_lon": ..., "max_lon": ..., "min_lat": ..., "max_lat": ...},
        "centroid": {"lon": ..., "lat": ...}
    }
    """
    ext = os.path.splitext(file_path)[1].lower()
    df = None

    if ext == '.csv':
        encodings = ['utf-8-sig', 'utf-8', 'cp1256', 'latin-1']
        for enc in encodings:
            try:
                df = pd.read_csv(file_path, encoding=enc)
                break
            except Exception:
                continue
    elif ext in ('.xlsx', '.xls'):
        df = pd.read_excel(file_path)

    if df is None or df.empty:
        raise ValueError("Could not read survey table or file is empty.")

    # Strip column names
    df.columns = [str(c).strip() for c in df.columns]

    # Find coordinate columns
    x_col, y_col = None, None
    pt_col = None

    # Patterns for X / Longitude / Easting
    patterns_x = [
        r'^point[_\s]*x$', r'^pt[_\s]*x$', r'^x[_\s]*coord', r'^x[_\s]*coordinate',
        r'^easting$', r'^east$', r'^x$', r'^lon$', r'^long$', r'^longitude$',
        r'شرق', r'خط.*طول', r'الاحداثي.*السيني', r'point.*x', r'coord.*x'
    ]
    # Patterns for Y / Latitude / Northing
    patterns_y = [
        r'^point[_\s]*y$', r'^pt[_\s]*y$', r'^y[_\s]*coord', r'^y[_\s]*coordinate',
        r'^northing$', r'^north$', r'^y$', r'^lat$', r'^latitude$',
        r'شمال', r'دائر.*عرض', r'الاحداثي.*الصادي', r'point.*y', r'coord.*y'
    ]
    # Patterns for Point ID
    patterns_pt = [
        r'^objectid$', r'^orig_fid$', r'^fid$', r'^pt$', r'^point$', r'^id$', r'^p_id$',
        r'^نقطة$', r'^رقم.*نقطة$', r'^م$'
    ]

    for col in df.columns:
        c_low = col.lower().strip()
        if not x_col and any(re.search(p, c_low) for p in patterns_x):
            x_col = col
        elif not y_col and any(re.search(p, c_low) for p in patterns_y):
            y_col = col
        elif not pt_col and any(re.search(p, c_low) for p in patterns_pt):
            pt_col = col

    # Fallback to positional columns if numeric
    if not x_col or not y_col:
        num_cols = [c for c in df.columns if pd.to_numeric(df[c].astype(str).str.translate(ARABIC_TO_ENG).str.replace(',', ''), errors='coerce').notnull().sum() > len(df) * 0.5]
        if len(num_cols) >= 2:
            x_col, y_col = num_cols[0], num_cols[1]

    if not x_col or not y_col:
        raise ValueError("Unable to automatically detect coordinate columns (X/Y or Long/Lat) in file.")

    # Extract metadata from headers or first row
    applicant_name = ""
    national_id = ""
    center_city = ""
    village = ""
    transaction_type = ""
    site_description = ""
    receipt_no = ""
    request_no = ""
    start_date = default_start_date or "2018-05-01"
    stated_area = 0.0

    meta_name_patterns = [r'اسم.*مقدم.*الطلب', r'اسم.*المواطن', r'الاسم', r'applicant', r'name']
    meta_nid_patterns  = [r'رقم.*قومي', r'الرقم.*القومي', r'national.*id', r'nid']
    meta_center_patterns = [r'المركز', r'المدينة', r'center', r'city']
    meta_village_patterns = [r'القرية', r'قرية', r'حوض', r'village']
    meta_trans_patterns = [r'وصف.*التعامل', r'نوع.*الطلب', r'التعامل']
    meta_site_patterns = [r'وصف.*الموقع', r'نوع.*المبنى', r'الاستخدام']
    meta_receipt_patterns = [r'ايصال.*سداد', r'رقم.*ايصال']
    meta_request_patterns = [r'request.*no', r'رقم.*الطلب']
    meta_date_patterns = [r'تاريخ.*بداية', r'تاريخ.*الطلب', r'تاريخ.*السند', r'تاريخ.*معاينة', r'start.*date', r'date']
    meta_area_patterns = [r'المساحة.*م2', r'المساحة.*المذكورة', r'المساحة', r'area', r'shape_area']

    for col in df.columns:
        c_low = col.lower().strip()
        val = df[col].iloc[0] if len(df) > 0 else ""
        if not applicant_name and any(re.search(p, c_low) for p in meta_name_patterns):
            applicant_name = clean_str(val)
        elif not national_id and any(re.search(p, c_low) for p in meta_nid_patterns):
            national_id = clean_str(val)
        elif not center_city and any(re.search(p, c_low) for p in meta_center_patterns):
            center_city = clean_str(val)
        elif not village and any(re.search(p, c_low) for p in meta_village_patterns):
            village = clean_str(val)
        elif not transaction_type and any(re.search(p, c_low) for p in meta_trans_patterns):
            transaction_type = clean_str(val)
        elif not site_description and any(re.search(p, c_low) for p in meta_site_patterns):
            site_description = clean_str(val)
        elif not receipt_no and any(re.search(p, c_low) for p in meta_receipt_patterns):
            receipt_no = clean_str(val)
        elif not request_no and any(re.search(p, c_low) for p in meta_request_patterns):
            request_no = clean_str(val)
        elif any(re.search(p, c_low) for p in meta_date_patterns):
            d = parse_date_str(val)
            if d:
                start_date = d
        elif not stated_area and any(re.search(p, c_low) for p in meta_area_patterns):
            a = clean_num(val)
            if a:
                stated_area = a

    # Collect raw coordinates
    raw_coords = []
    pt_indices = []
    for idx, row in df.iterrows():
        vx = clean_num(row[x_col])
        vy = clean_num(row[y_col])
        if vx is not None and vy is not None:
            raw_coords.append((vx, vy))
            pt_id = clean_str(row[pt_col]) if pt_col else str(len(raw_coords))
            pt_indices.append(pt_id or str(len(raw_coords)))

    if len(raw_coords) < 3:
        raise ValueError(f"Need at least 3 valid coordinate points to form a parcel, found {len(raw_coords)}.")

    # Reproject to WGS84 if needed
    wgs_coords, detected_crs = detect_crs_and_transform(raw_coords)

    # Clean consecutive duplicate vertices
    clean_wgs = []
    clean_raw = []
    clean_indices = []
    for w_pt, r_pt, p_idx in zip(wgs_coords, raw_coords, pt_indices):
        if not clean_wgs:
            clean_wgs.append(w_pt)
            clean_raw.append(r_pt)
            clean_indices.append(p_idx)
        else:
            prev = clean_wgs[-1]
            dist_m = ((w_pt[0] - prev[0])**2 + (w_pt[1] - prev[1])**2)**0.5 * 111000.0
            if dist_m > 0.05:  # more than 5cm apart
                clean_wgs.append(w_pt)
                clean_raw.append(r_pt)
                clean_indices.append(p_idx)

    wgs_coords = clean_wgs
    raw_coords = clean_raw
    pt_indices = clean_indices

    # Clean ring closure if duplicate last point
    if len(wgs_coords) > 3:
        first = wgs_coords[0]
        last = wgs_coords[-1]
        dist_m = ((first[0]-last[0])**2 + (first[1]-last[1])**2)**0.5 * 111000.0
        if dist_m < 0.1:  # closed polygon repeated endpoint
            wgs_coords = wgs_coords[:-1]
            raw_coords = raw_coords[:-1]
            pt_indices = pt_indices[:-1]

    # Calculate Geodesic Area and Perimeter
    lons = [pt[0] for pt in wgs_coords]
    lats = [pt[1] for pt in wgs_coords]

    try:
        area_m2, perimeter_m = GEOD.polygon_area_perimeter(lons, lats)
        calc_area = abs(area_m2)
        perimeter = abs(perimeter_m)
    except Exception:
        calc_area = 0.0
        perimeter = 0.0

    # Bounding Box & Centroid
    min_lon, max_lon = min(lons), max(lons)
    min_lat, max_lat = min(lats), max(lats)
    center_lon = sum(lons) / len(lons)
    center_lat = sum(lats) / len(lats)

    # Format vertices list
    vertices = []
    for i, ((lon, lat), (rx, ry)) in enumerate(zip(wgs_coords, raw_coords), 1):
        pid = pt_indices[i-1] if i-1 < len(pt_indices) else str(i)
        vertices.append({
            "id": pid,
            "index": i,
            "lon": float(lon),
            "lat": float(lat),
            "raw_x": float(rx),
            "raw_y": float(ry),
            "lon_str": f"{float(lon):.8f}",
            "lat_str": f"{float(lat):.8f}"
        })

    # Determine start year and month
    start_year = 2018
    start_month = 1
    try:
        parts = start_date.split('-')
        start_year = int(parts[0])
        if len(parts) > 1:
            start_month = int(parts[1])
    except Exception:
        start_year = 2018
        start_month = 1

    return {
        "applicant_name": applicant_name or "المواطن (طلب فحص تغيرات مكانية)",
        "national_id": national_id or "غير محدد",
        "center_city": center_city or "المنصورة",
        "village": village or "غير محدد",
        "transaction_type": transaction_type or "",
        "site_description": site_description or "",
        "receipt_no": receipt_no or "",
        "request_no": request_no or "",
        "start_date": start_date,
        "start_year": start_year,
        "start_month": start_month,
        "stated_area_m2": stated_area if stated_area > 0 else round(calc_area, 2),
        "calculated_area_m2": round(calc_area, 2),
        "perimeter_m": round(perimeter, 2),
        "crs": detected_crs,
        "vertices": vertices,
        "bounds": {
            "min_lon": min_lon,
            "max_lon": max_lon,
            "min_lat": min_lat,
            "max_lat": max_lat
        },
        "centroid": {
            "lon": center_lon,
            "lat": center_lat
        }
    }
