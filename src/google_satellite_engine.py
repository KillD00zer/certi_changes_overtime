"""
Spatial Changes Over Time System - Google Maps Satellite Engine
===============================================================
Fetches high-resolution satellite tiles directly from Google Maps (mt0-3.google.com),
stitches them seamlessly in parallel, projects parcel coordinates,
overlays the highlighted parcel boundary, and renders labeled snapshots.
Supports framing from interactive Leaflet map bounds or automatic parcel fitting.
"""

import os
import math
import ssl
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
    Selects optimal Google Maps zoom level (up to zoom 21 for sharp sub-meter detail on small parcels).
    Matches production configuration from SPV and DUDC projects.
    """
    try:
        area_val = float(stated_area_m2)
    except (ValueError, TypeError):
        area_val = 500.0

    if area_val < 250:
        return 21
    elif area_val < 2500:
        return 20
    elif area_val < 10000:
        return 19
    else:
        return 18


def fetch_google_tile(x, y, z):
    """Downloads a single 256x256 satellite tile from Google Maps."""
    sub = (x + y) % 4
    url = f"https://mt{sub}.google.com/vt/lyrs=s&hl=en&z={z}&x={x}&y={y}"
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=10, context=SSL_CTX) as resp:
        return Image.open(resp).convert('RGBA')


def get_system_font(size=14, bold=False):
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


def render_google_satellite_image(parcel, output_path, label_text="Google Maps Satellite", custom_bounds=None, custom_zoom=None):
    """
    Renders a high-resolution Google Maps satellite snapshot with the parcel overlay.
    custom_bounds: optional dict {"min_lon": ..., "max_lon": ..., "min_lat": ..., "max_lat": ...}
    custom_zoom: optional int (15 to 21)
    """
    verts = parcel.get("vertices", [])
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
        span_lon = orig_max_lon - orig_min_lon
        span_lat = orig_max_lat - orig_min_lat
        stated_a = parcel.get("stated_area_m2", 500)
        if stated_a < 250:
            min_span = 0.00016
            pad_ratio = 0.38
        elif stated_a < 2500:
            min_span = 0.00022
            pad_ratio = 0.38
        else:
            min_span = 0.00030
            pad_ratio = 0.40

        eff_span_lon = max(span_lon, min_span)
        eff_span_lat = max(span_lat, min_span)
        pad_lon = eff_span_lon * pad_ratio
        pad_lat = eff_span_lat * pad_ratio
        min_lon = orig_min_lon - pad_lon
        max_lon = orig_max_lon + pad_lon
        min_lat = orig_min_lat - pad_lat
        max_lat = orig_max_lat + pad_lat

    zoom = custom_zoom or determine_zoom(parcel.get("stated_area_m2", 500))
    zoom = max(15, min(21, zoom))

    # Tile coordinates
    min_tx, min_ty = lonlat_to_tile(min_lon, max_lat, zoom)
    max_tx, max_ty = lonlat_to_tile(max_lon, min_lat, zoom)

    while (max_tx - min_tx) > 7 or (max_ty - min_ty) > 7:
        zoom -= 1
        min_tx, min_ty = lonlat_to_tile(min_lon, max_lat, zoom)
        max_tx, max_ty = lonlat_to_tile(max_lon, min_lat, zoom)

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
    tile_tasks = []
    with ThreadPoolExecutor(max_workers=8) as executor:
        for ix, tx in enumerate(range(min_tx, max_tx + 1)):
            for iy, ty in enumerate(range(min_ty, max_ty + 1)):
                future = executor.submit(fetch_google_tile, tx, ty, zoom)
                tile_tasks.append((future, ix * 256, iy * 256))

        for future, px_x, px_y in tile_tasks:
            try:
                tile_img = future.result()
                stitched.paste(tile_img, (px_x, px_y))
            except Exception:
                pass

    # Project coordinates
    base_px = min_tx * 256.0
    base_py = min_ty * 256.0

    crop_offset_x = 0
    crop_offset_y = 0
    scale_factor = 1.0

    if custom_bounds and "min_lon" in custom_bounds:
        c_x1, c_y1 = lonlat_to_pixels(custom_bounds["min_lon"], custom_bounds["max_lat"], zoom)
        c_x2, c_y2 = lonlat_to_pixels(custom_bounds["max_lon"], custom_bounds["min_lat"], zoom)
        crop_box = (
            max(0, int(c_x1 - base_px)),
            max(0, int(c_y1 - base_py)),
            min(stitched.width, int(c_x2 - base_px)),
            min(stitched.height, int(c_y2 - base_py))
        )
        crop_w = crop_box[2] - crop_box[0]
        crop_h = crop_box[3] - crop_box[1]
        if crop_w > 50 and crop_h > 50:
            stitched = stitched.crop(crop_box)
            if crop_w < 700 or crop_h < 500:
                scale_factor = max(1.2, min(3.0, 750.0 / max(crop_w, crop_h)))
                new_w = int(round(crop_w * scale_factor))
                new_h = int(round(crop_h * scale_factor))
                stitched = stitched.resize((new_w, new_h), Image.Resampling.LANCZOS)
            crop_offset_x = crop_box[0]
            crop_offset_y = crop_box[1]

    pixel_poly = []
    for v in verts:
        gx, gy = lonlat_to_pixels(v["lon"], v["lat"], zoom)
        px = (gx - base_px - crop_offset_x) * scale_factor
        py = (gy - base_py - crop_offset_y) * scale_factor
        pixel_poly.append((px, py))

    # Drawing overlay
    overlay = Image.new('RGBA', stitched.size, (255, 255, 255, 0))
    draw = ImageDraw.Draw(overlay)

    # 1. Translucent red fill
    if len(pixel_poly) >= 3:
        draw.polygon(pixel_poly, fill=(239, 68, 68, 55))

    # 2. Bold red boundary
    draw.polygon(pixel_poly, outline=(239, 68, 68, 255), width=4)

    # 3. Vertex nodes
    node_font = get_system_font(12, bold=True)
    for idx, (px, py) in enumerate(pixel_poly, 1):
        r = 7
        draw.ellipse([(px - r, py - r), (px + r, py + r)], fill=(34, 197, 94, 255), outline=(0, 0, 0, 255), width=2)
        draw.text((px + 9, py - 9), str(idx), fill=(255, 255, 255, 255), font=node_font)

    # 4. Badge Banner
    badge_w = 360
    badge_h = 38
    banner_font = get_system_font(14, bold=True)
    draw.rounded_rectangle(
        [(16, 16), (16 + badge_w, 16 + badge_h)],
        radius=8,
        fill=(15, 23, 42, 230),
        outline=(56, 189, 248, 220),
        width=2
    )
    draw.text((28, 24), label_text, fill=(255, 255, 255, 255), font=banner_font)

    # 5. North Arrow
    na_x = stitched.width - 45
    na_y = 35
    draw.ellipse([(na_x - 18, na_y - 18), (na_x + 18, na_y + 18)], fill=(15, 23, 42, 220), outline=(255, 255, 255, 180), width=1)
    draw.polygon([(na_x, na_y - 14), (na_x - 6, na_y + 8), (na_x, na_y + 3)], fill=(239, 68, 68, 255))
    draw.polygon([(na_x, na_y - 14), (na_x + 6, na_y + 8), (na_x, na_y + 3)], fill=(255, 255, 255, 255))
    draw.text((na_x - 4, na_y - 28), "N", fill=(255, 255, 255, 255), font=node_font)

    final_img = Image.alpha_composite(stitched, overlay)
    rgb_result = final_img.convert('RGB')

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    rgb_result.save(output_path, 'JPEG', quality=95)
    return output_path
