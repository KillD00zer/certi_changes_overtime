"""
Spatial Changes Over Time System - Esri Wayback Historical Imagery Engine
==========================================================================
Fetches sub-meter historical satellite imagery from Esri World Imagery Wayback
archive (196+ releases from 2014 to present), filters by starting year,
stitches tiles in parallel, projects parcel boundaries, and renders labeled snapshots.
"""

import os
import re
import math
import json
import ssl
import hashlib
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from PIL import Image, ImageDraw, ImageFont

# Ignore SSL verification for tile fetching
SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
}

WAYBACK_CONFIG_URL = "https://s3-us-west-2.amazonaws.com/config.maptiles.arcgis.com/waybackconfig.json"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CACHE_CONFIG_PATH = os.path.join(BASE_DIR, "temp_assets", "wayback_config.json")
_PARCEL_PASSES_CACHE = {}


def load_wayback_config():
    """Loads the Wayback release configuration, using disk cache if available."""
    if os.path.exists(CACHE_CONFIG_PATH):
        try:
            with open(CACHE_CONFIG_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass

    try:
        req = urllib.request.Request(WAYBACK_CONFIG_URL, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=12, context=SSL_CTX) as resp:
            data = json.loads(resp.read().decode('utf-8'))
        os.makedirs(os.path.dirname(CACHE_CONFIG_PATH), exist_ok=True)
        with open(CACHE_CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f)
        return data
    except Exception as e:
        print(f"Warning: Could not fetch fresh Wayback config: {e}")
        return {}


def get_yearly_releases(start_year=2018):
    """
    Returns a sorted list of optimal Wayback releases, one per year, from start_year to present.
    """
    config = load_wayback_config()
    releases_by_year = {}

    for key, item in config.items():
        title = item.get("itemTitle", "")
        m = re.search(r'(\d{4})-(\d{2})-(\d{2})', title)
        if not m:
            continue
        y = int(m.group(1))
        mth = int(m.group(2))
        d = int(m.group(3))
        dt_str = f"{y:04d}-{mth:02d}-{d:02d}"

        if y < start_year:
            continue

        item_url = item.get("itemURL", "")
        tile_template = item_url.replace("{level}", "{z}").replace("{row}", "{y}").replace("{col}", "{x}")

        rel_entry = {
            "key": key,
            "year": y,
            "month": mth,
            "day": d,
            "release_date": dt_str,
            "title": title,
            "tile_url_template": tile_template
        }

        if y not in releases_by_year:
            releases_by_year[y] = []
        releases_by_year[y].append(rel_entry)

    selected_releases = []
    for y in sorted(releases_by_year.keys()):
        rels = releases_by_year[y]
        # Prefer mid-year releases (July / August / June)
        rels.sort(key=lambda r: (abs(r["month"] - 7), -r["day"]))
        best = rels[0]
        selected_releases.append(best)

    return selected_releases


def get_distinct_parcel_passes(parcel, start_year=2018, zoom=18):
    """
    Scans the entire Wayback archive history for this specific parcel,
    detecting exactly how many actual unique aerial/satellite imagery passes
    updated the parcel between start_year and the present.
    """
    verts = parcel.get("vertices", [])
    if not verts:
        return []

    center_lon = sum(v["lon"] for v in verts) / len(verts)
    center_lat = sum(v["lat"] for v in verts) / len(verts)
    tx, ty = lonlat_to_tile(center_lon, center_lat, zoom)

    cache_key = (round(center_lon, 5), round(center_lat, 5), start_year, zoom)
    if cache_key in _PARCEL_PASSES_CACHE:
        return _PARCEL_PASSES_CACHE[cache_key]

    config = load_wayback_config()
    items = []
    for k, item in config.items():
        title = item.get("itemTitle", "")
        m = re.search(r'(\d{4})-(\d{2})-(\d{2})', title)
        if not m:
            continue
        y = int(m.group(1))
        mth = int(m.group(2))
        d = int(m.group(3))
        if y < start_year:
            continue

        item_url = item.get("itemURL", "")
        tile_template = item_url.replace("{level}", "{z}").replace("{row}", "{y}").replace("{col}", "{x}")
        items.append({
            "key": k,
            "year": y,
            "month": mth,
            "day": d,
            "date": f"{y}-{mth:02d}-{d:02d}",
            "title": title,
            "tile_url_template": tile_template
        })

    # Sort chronological (oldest to newest)
    items.sort(key=lambda x: x["date"])

    def probe_tile(it):
        url = it["tile_url_template"].format(z=zoom, x=tx, y=ty)
        req = urllib.request.Request(url, headers=HEADERS)
        try:
            with urllib.request.urlopen(req, timeout=6, context=SSL_CTX) as resp:
                data = resp.read()
                return (it, hashlib.md5(data).hexdigest()[:12], len(data))
        except Exception:
            return (it, None, 0)

    with ThreadPoolExecutor(max_workers=20) as executor:
        results = list(executor.map(probe_tile, items))

    distinct_passes = []
    current_hash = None

    for it, h, sz in results:
        if h and h != current_hash:
            distinct_passes.append({
                "key": it["key"],
                "year": it["year"],
                "month": it["month"],
                "day": it["day"],
                "date": it["date"],
                "title": it["title"],
                "tile_url_template": it["tile_url_template"],
                "tile_size": sz,
                "hash": h
            })
            current_hash = h

    # Count occurrences per year to give clean labels without days
    year_counts = {}
    for p in distinct_passes:
        y = p["year"]
        year_counts[y] = year_counts.get(y, 0) + 1

    year_seen = {}
    for idx, p in enumerate(distinct_passes, 1):
        y = p["year"]
        year_seen[y] = year_seen.get(y, 0) + 1
        p["pass_number"] = idx

        if year_counts[y] == 1:
            p["label"] = f"تصوير سنة {y}"
        else:
            half = "النصف الأول" if year_seen[y] == 1 else "النصف الثاني"
            p["label"] = f"تصوير سنة {y} ({half})"

    _PARCEL_PASSES_CACHE[cache_key] = distinct_passes
    return distinct_passes


def lonlat_to_tile(lon, lat, zoom):
    lat_rad = math.radians(lat)
    n = 2.0 ** zoom
    xtile = int((lon + 180.0) / 360.0 * n)
    ytile = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
    return xtile, ytile


def lonlat_to_pixels(lon, lat, zoom):
    lat_rad = math.radians(lat)
    n = 2.0 ** zoom
    x = ((lon + 180.0) / 360.0 * n) * 256.0
    y = ((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n) * 256.0
    return x, y


def determine_zoom(stated_area_m2):
    """
    Selects high-resolution zoom level tailored for parcel size.
    Wayback global maximum available zoom is 19.
    """
    if stated_area_m2 < 3500:
        return 19
    elif stated_area_m2 < 20000:
        return 18
    else:
        return 17


def fetch_tile_image(url):
    """Downloads a single 256x256 satellite tile."""
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=8, context=SSL_CTX) as resp:
        return Image.open(resp).convert('RGBA')


def get_system_font(size=14, bold=False):
    """Attempts to load a standard clean system font (Arial, Segoe UI, Tahoma)."""
    font_paths = [
        "C:\\Windows\\Fonts\\arialbd.ttf" if bold else "C:\\Windows\\Fonts\\arial.ttf",
        "C:\\Windows\\Fonts\\segoeuib.ttf" if bold else "C:\\Windows\\Fonts\\segoeui.ttf",
        "C:\\Windows\\Fonts\\tahomabd.ttf" if bold else "C:\\Windows\\Fonts\\tahoma.ttf",
    ]
    for path in font_paths:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                pass
    return ImageFont.load_default()


def render_yearly_satellite_image(parcel, release_info, output_path, custom_bounds=None, custom_zoom=None):
    """
    Renders a high-resolution satellite imagery snapshot for the given parcel and Wayback release.
    Features:
    - 40% contextual margin for surrounding roads and neighboring buildings.
    - Semi-transparent red parcel fill + bold 4px perimeter stroke + green vertex nodes.
    - Sleek dark header badge showing the Year and exact Capture Date.
    - North arrow widget.
    - Saves output as JPEG at 95% quality.
    """
    verts = parcel["vertices"]
    lons = [v["lon"] for v in verts]
    lats = [v["lat"] for v in verts]

    if custom_bounds and "min_lon" in custom_bounds:
        min_lon = custom_bounds["min_lon"]
        max_lon = custom_bounds["max_lon"]
        min_lat = custom_bounds["min_lat"]
        max_lat = custom_bounds["max_lat"]
    else:
        orig_min_lon, orig_max_lon = min(lons), max(lons)
        orig_min_lat, orig_max_lat = min(lats), max(lats)
        span_lon = max(orig_max_lon - orig_min_lon, 0.0003)
        span_lat = max(orig_max_lat - orig_min_lat, 0.0003)
        pad_lon = span_lon * 0.40
        pad_lat = span_lat * 0.40
        min_lon = orig_min_lon - pad_lon
        max_lon = orig_max_lon + pad_lon
        min_lat = orig_min_lat - pad_lat
        max_lat = orig_max_lat + pad_lat

    zoom = custom_zoom or determine_zoom(parcel.get("stated_area_m2", 500))
    zoom = max(15, min(19, zoom))


    # Tile coordinates (capped at zoom 19 max)
    min_tx, min_ty = lonlat_to_tile(min_lon, max_lat, zoom)
    max_tx, max_ty = lonlat_to_tile(max_lon, min_lat, zoom)

    # Guard against excessively large tile spans
    while (max_tx - min_tx) > 6 or (max_ty - min_ty) > 6:
        zoom -= 1
        min_tx, min_ty = lonlat_to_tile(min_lon, max_lat, zoom)
        max_tx, max_ty = lonlat_to_tile(max_lon, min_lat, zoom)

    # Ensure minimum 3x3 tiles
    while (max_tx - min_tx + 1) < 3:
        min_tx -= 1
        max_tx += 1
    while (max_ty - min_ty + 1) < 3:
        min_ty -= 1
        max_ty += 1

    tiles_x = max_tx - min_tx + 1
    tiles_y = max_ty - min_ty + 1

    stitched = Image.new('RGBA', (tiles_x * 256, tiles_y * 256), (20, 24, 33, 255))

    # Parallel download tiles
    tile_template = release_info["tile_url_template"]
    tile_tasks = []

    with ThreadPoolExecutor(max_workers=8) as executor:
        for ix, tx in enumerate(range(min_tx, max_tx + 1)):
            for iy, ty in enumerate(range(min_ty, max_ty + 1)):
                url = tile_template.format(z=zoom, x=tx, y=ty)
                future = executor.submit(fetch_tile_image, url)
                tile_tasks.append((future, ix * 256, iy * 256))

        for future, px_x, px_y in tile_tasks:
            try:
                tile_img = future.result()
                stitched.paste(tile_img, (px_x, px_y))
            except Exception:
                pass

    # Project parcel vertices to canvas coordinates
    base_px = min_tx * 256.0
    base_py = min_ty * 256.0

    pixel_poly = []
    for v in verts:
        gx, gy = lonlat_to_pixels(v["lon"], v["lat"], zoom)
        pixel_poly.append((gx - base_px, gy - base_py))

    # Create transparent overlay for annotations
    overlay = Image.new('RGBA', stitched.size, (255, 255, 255, 0))
    draw = ImageDraw.Draw(overlay)

    # 1. Translucent red fill
    if len(pixel_poly) >= 3:
        draw.polygon(pixel_poly, fill=(239, 68, 68, 55))

    # 2. Bold red boundary stroke
    draw.polygon(pixel_poly, outline=(239, 68, 68, 255), width=4)

    # 3. Vertex markers with ID numbers
    node_font = get_system_font(12, bold=True)
    for idx, (px, py) in enumerate(pixel_poly, 1):
        r = 7
        draw.ellipse([(px - r, py - r), (px + r, py + r)], fill=(34, 197, 94, 255), outline=(0, 0, 0, 255), width=2)
        # Small label offset
        draw.text((px + 9, py - 9), str(idx), fill=(255, 255, 255, 255), font=node_font)

    # 4. Badge Banner: "📅 سنة: 2021 | تاريخ الالتقاط: 2021-07-28"
    year_str = str(release_info.get("year", ""))
    date_str = str(release_info.get("release_date", ""))
    badge_text = f"Year: {year_str}  |  Capture Date: {date_str}"

    badge_w = 340
    badge_h = 38
    banner_font = get_system_font(14, bold=True)
    draw.rounded_rectangle(
        [(16, 16), (16 + badge_w, 16 + badge_h)],
        radius=8,
        fill=(15, 23, 42, 230),
        outline=(56, 189, 248, 220),
        width=2
    )
    draw.text((28, 24), badge_text, fill=(255, 255, 255, 255), font=banner_font)

    # 5. North Arrow Widget at top-right
    na_x = stitched.width - 45
    na_y = 35
    draw.ellipse([(na_x - 18, na_y - 18), (na_x + 18, na_y + 18)], fill=(15, 23, 42, 220), outline=(255, 255, 255, 180), width=1)
    # Arrow points North (upwards)
    draw.polygon([(na_x, na_y - 14), (na_x - 6, na_y + 8), (na_x, na_y + 3)], fill=(239, 68, 68, 255))
    draw.polygon([(na_x, na_y - 14), (na_x + 6, na_y + 8), (na_x, na_y + 3)], fill=(255, 255, 255, 255))
    draw.text((na_x - 4, na_y - 28), "N", fill=(255, 255, 255, 255), font=node_font)

    # Composite overlay onto stitched imagery
    final_img = Image.alpha_composite(stitched, overlay)
    rgb_result = final_img.convert('RGB')

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    rgb_result.save(output_path, 'JPEG', quality=95)
    return output_path
