"""
Spatial Changes Over Time System - Local HTTP REST API Controller
=================================================================
Supports:
1. High-Resolution Sub-Meter Satellite Imagery (Maxar/Airbus 30cm via Wayback Archive)
2. Interactive Google Maps Satellite Map & Custom Frame Capture
3. Auto-fetch all historical annual shots with real multi-temporal differences
4. Distinct Month & Year Starting Date inputs
5. Explicit User "Include in Report" button per shot
6. Clean comment entry without default checkboxes
7. 1-Click Google Earth Pro KML Export
8. Clipboard Paste (Ctrl+V) & Image Upload
"""

import os
import sys
import json
import time
import base64
import hashlib
import shutil
import urllib.parse
import subprocess
from http.server import HTTPServer, SimpleHTTPRequestHandler

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(BASE_DIR)

from geo_parser import parse_survey_file
from wayback_engine import get_yearly_releases, render_yearly_satellite_image, get_distinct_parcel_passes, get_best_wayback_zoom
from google_satellite_engine import render_google_satellite_image
from docx_timeline_builder import build_timeline_report
from kml_generator import generate_parcel_kml

CONFIG_FILE = os.path.join(BASE_DIR, "app_config.json")
DEFAULT_OUTPUT_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "generated_reports"))
TEMP_ASSETS_DIR = os.path.join(BASE_DIR, "temp_assets")
os.makedirs(TEMP_ASSETS_DIR, exist_ok=True)
os.makedirs(DEFAULT_OUTPUT_DIR, exist_ok=True)


def load_config():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {"output_dir": DEFAULT_OUTPUT_DIR}


def save_config(cfg):
    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(cfg, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Error saving config: {e}")


def get_configured_output_dir():
    cfg = load_config()
    out = cfg.get("output_dir", DEFAULT_OUTPUT_DIR)
    os.makedirs(out, exist_ok=True)
    return out


class AppRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def send_json(self, data, status=200):
        try:
            body = json.dumps(data, ensure_ascii=False).encode('utf-8')
            self.send_response(status)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except (ConnectionError, BrokenPipeError, ConnectionAbortedError, OSError):
            pass


    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == "/" or path == "/index.html":
            html_path = os.path.join(BASE_DIR, "index.html")
            if os.path.exists(html_path):
                with open(html_path, "rb") as f:
                    content = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(content)))
                self.end_headers()
                self.wfile.write(content)
                return

        if path == "/api/get-output-dir":
            self.send_json({"output_dir": get_configured_output_dir()})
            return

        if path.startswith("/api/get-releases"):
            query = urllib.parse.parse_qs(parsed.query)
            start_y = int(query.get("start_year", [2014])[0])
            releases = get_yearly_releases(start_y)
            self.send_json({"success": True, "releases": releases})
            return

        if path.startswith("/temp_assets/"):
            filename = os.path.basename(path.split('?')[0])
            file_path = os.path.join(TEMP_ASSETS_DIR, filename)
            if os.path.exists(file_path):
                with open(file_path, "rb") as f:
                    content = f.read()
                self.send_response(200)
                ext = os.path.splitext(filename)[1].lower()
                mime = "image/jpeg" if ext in ('.jpg', '.jpeg') else "image/png"
                self.send_header("Content-Type", mime)
                self.send_header("Content-Length", str(len(content)))
                self.end_headers()
                self.wfile.write(content)
                return
            else:
                self.send_error(404, "File not found")
                return

        super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        content_len = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_len) if content_len > 0 else b""

        try:
            if path == "/api/load-sample":
                sample_file = os.path.join(BASE_DIR, "sample_timeline_survey.csv")
                parcel = parse_survey_file(sample_file)
                start_year = int(parcel.get("start_year", 2018))
                releases = get_yearly_releases(start_year)
                all_releases = get_yearly_releases(2014)
                distinct_passes = get_distinct_parcel_passes(parcel, start_year)
                best_wb = 18
                if distinct_passes:
                    best_wb = get_best_wayback_zoom(parcel, distinct_passes[0])
                elif releases:
                    best_wb = get_best_wayback_zoom(parcel, releases[0])
                parcel["wayback_max_zoom"] = best_wb
                self.send_json({
                    "success": True,
                    "parcel": parcel,
                    "releases": releases,
                    "all_releases": all_releases,
                    "distinct_passes": distinct_passes,
                    "passes_count": len(distinct_passes)
                })
                return

            if path.startswith("/api/get-releases"):
                query = urllib.parse.parse_qs(parsed.query)
                start_y = int(query.get("start_year", [2014])[0])
                releases = get_yearly_releases(start_y)
                self.send_json({"success": True, "releases": releases})
                return

            if path == "/api/get-parcel-passes":
                req_data = json.loads(body.decode('utf-8'))
                parcel = req_data["parcel"]
                start_year = int(req_data.get("start_year", parcel.get("start_year", 2018)))
                distinct_passes = get_distinct_parcel_passes(parcel, start_year)
                self.send_json({
                    "success": True,
                    "distinct_passes": distinct_passes,
                    "passes_count": len(distinct_passes),
                    "start_year": start_year
                })
                return

            if path == "/api/upload":
                content_type = self.headers.get('Content-Type', '')
                if 'multipart/form-data' in content_type:
                    boundary = content_type.split("boundary=")[-1].encode()
                    parts = body.split(b"--" + boundary)
                    filename = "uploaded_survey.csv"
                    file_bytes = None
                    for part in parts:
                        if b'filename="' in part:
                            hdr, fbody = part.split(b"\r\n\r\n", 1)
                            fbody = fbody.rstrip(b"\r\n")
                            try:
                                fname_part = hdr.split(b'filename="')[1].split(b'"')[0].decode('utf-8', errors='ignore')
                                if fname_part:
                                    filename = os.path.basename(fname_part)
                            except Exception:
                                pass
                            file_bytes = fbody
                            break
                    if not file_bytes:
                        self.send_json({"success": False, "error": "No file content detected."}, 400)
                        return
                    dest_file = os.path.join(TEMP_ASSETS_DIR, filename)
                    with open(dest_file, "wb") as f:
                        f.write(file_bytes)
                    parcel = parse_survey_file(dest_file)
                    parcel["uploaded_filename"] = filename
                    start_year = int(parcel.get("start_year", 2018))
                    releases = get_yearly_releases(start_year)
                    all_releases = get_yearly_releases(2014)
                    distinct_passes = get_distinct_parcel_passes(parcel, start_year)
                    best_wb = 18
                    if distinct_passes:
                        best_wb = get_best_wayback_zoom(parcel, distinct_passes[0])
                    elif releases:
                        best_wb = get_best_wayback_zoom(parcel, releases[0])
                    parcel["wayback_max_zoom"] = best_wb
                    self.send_json({
                        "success": True,
                        "parcel": parcel,
                        "releases": releases,
                        "all_releases": all_releases,
                        "distinct_passes": distinct_passes,
                        "passes_count": len(distinct_passes)
                    })
                    return
                else:
                    self.send_json({"success": False, "error": "Invalid Content-Type for upload."}, 400)
                    return

            # Auto-fetch historical shots: either distinct passes or annual timeline
            if path == "/api/auto-fetch-all-years":
                req_data = json.loads(body.decode('utf-8'))
                parcel = req_data["parcel"]
                start_year = int(parcel.get("start_year", 2018))
                mode = req_data.get("mode", "passes")

                # Compute unique parcel fingerprint based on boundary coordinates
                p_verts = parcel.get("vertices", [])
                coords_str = "_".join(f"{v['lon']:.5f},{v['lat']:.5f}" for v in p_verts)
                p_fp = hashlib.md5(coords_str.encode()).hexdigest()[:8]

                if mode == "years":
                    items_to_fetch = get_yearly_releases(start_year)
                else:
                    items_to_fetch = get_distinct_parcel_passes(parcel, start_year)
                    if not items_to_fetch:
                        items_to_fetch = get_yearly_releases(start_year)

                def process_item(item):
                    y = item["year"]
                    lbl = item.get("label", f"تصوير سنة {y}")
                    k = item["key"]
                    cache_filename = f"shot_{p_fp}_{y}_{k}.jpg"
                    cache_path = os.path.join(TEMP_ASSETS_DIR, cache_filename)
                    if not os.path.exists(cache_path):
                        render_yearly_satellite_image(parcel, item, cache_path)
                    return {
                        "id": f"shot_{p_fp}_{y}_{k}",
                        "year": y,
                        "key": k,
                        "label": lbl,
                        "release_date": item.get("date", item.get("release_date", str(y))),
                        "tile_url_template": item.get("tile_url_template", ""),
                        "image_url": f"/temp_assets/{cache_filename}",
                        "image_path": cache_path,
                        "included": True,
                        "comment": ""
                    }

                from concurrent.futures import ThreadPoolExecutor
                with ThreadPoolExecutor(max_workers=5) as executor:
                    shots = list(executor.map(process_item, items_to_fetch))

                shots.sort(key=lambda s: (s["year"], s.get("release_date", "")))
                self.send_json({"success": True, "shots": shots, "mode": mode, "passes_count": len(shots)})
                return

            # Capture shot from interactive window (Wayback sub-meter or Google Maps)
            if path == "/api/capture-shot":
                req_data = json.loads(body.decode('utf-8'))
                parcel = req_data["parcel"]
                year = int(req_data.get("year", 2026))
                custom_bounds = req_data.get("bounds")
                custom_zoom = req_data.get("zoom")
                source = req_data.get("source", "wayback")
                req_key = req_data.get("key")
                req_tile_url = req_data.get("tile_url_template")
                req_label = req_data.get("label", f"تصوير سنة {year}")

                p_verts = parcel.get("vertices", [])
                coords_str = "_".join(f"{v['lon']:.5f},{v['lat']:.5f}" for v in p_verts)
                p_fp = hashlib.md5(coords_str.encode()).hexdigest()[:8]

                ts = int(time.time())
                shot_filename = f"shot_{p_fp}_{year}_{ts}.jpg"
                shot_path = os.path.join(TEMP_ASSETS_DIR, shot_filename)

                if source != "google":
                    match_rel = None
                    if req_tile_url:
                        match_rel = {
                            "year": year,
                            "key": req_key or str(year),
                            "label": req_label,
                            "release_date": str(year),
                            "tile_url_template": req_tile_url
                        }
                    else:
                        all_releases = get_yearly_releases(2014)
                        match_rel = next((r for r in all_releases if r["year"] == year), None)

                    if match_rel:
                        render_yearly_satellite_image(
                            parcel,
                            match_rel,
                            shot_path,
                            custom_bounds=custom_bounds,
                            custom_zoom=custom_zoom
                        )
                        release_date = match_rel.get("release_date", str(year))
                    else:
                        render_google_satellite_image(
                            parcel,
                            shot_path,
                            label_text=f"سنة: {year}",
                            custom_bounds=custom_bounds,
                            custom_zoom=custom_zoom
                        )
                        release_date = f"Google Maps ({year})"
                else:
                    label_text = f"Google Maps Satellite - سنة: {year}"
                    render_google_satellite_image(
                        parcel,
                        shot_path,
                        label_text=label_text,
                        custom_bounds=custom_bounds,
                        custom_zoom=custom_zoom
                    )
                    release_date = f"Google Maps ({year})"

                self.send_json({
                    "success": True,
                    "shot": {
                        "id": f"shot_{p_fp}_{year}_{ts}",
                        "year": year,
                        "key": req_key,
                        "label": req_label,
                        "tile_url_template": req_tile_url,
                        "release_date": release_date,
                        "image_url": f"/temp_assets/{shot_filename}",
                        "image_path": shot_path,
                        "included": True,
                        "comment": ""
                    }
                })
                return

            # Upload or Paste custom image (from Google Earth or clipboard)
            if path == "/api/upload-shot-image":
                req_data = json.loads(body.decode('utf-8'))
                year = req_data.get("year", 2026)
                img_b64 = req_data["image_base64"]
                if "," in img_b64:
                    img_b64 = img_b64.split(",", 1)[1]
                data = base64.b64decode(img_b64)

                ts = int(time.time())
                shot_filename = f"shot_{year}_{ts}_custom.jpg"
                shot_path = os.path.join(TEMP_ASSETS_DIR, shot_filename)
                with open(shot_path, "wb") as f:
                    f.write(data)

                self.send_json({
                    "success": True,
                    "shot": {
                        "id": f"shot_{year}_{ts}",
                        "year": year,
                        "release_date": f"Google Earth Snapshot ({year})",
                        "image_url": f"/temp_assets/{shot_filename}",
                        "image_path": shot_path,
                        "included": True,
                        "comment": ""
                    }
                })
                return

            if path == "/api/export-kml":
                req_data = json.loads(body.decode('utf-8'))
                parcel = req_data["parcel"]
                applicant_clean = "".join(c for c in parcel.get("applicant_name", "مواطن") if c.isalnum() or c in (' ', '_', '-')).strip()
                kml_name = f"موقع_{applicant_clean}.kml"
                kml_path = os.path.join(TEMP_ASSETS_DIR, kml_name)
                generate_parcel_kml(parcel, kml_path)

                try:
                    subprocess.Popen(f'explorer "{kml_path}"', shell=True)
                except Exception:
                    pass


                self.send_json({
                    "success": True,
                    "kml_path": kml_path,
                    "message": "تم تصدير وتشغيل ملف KML بنجاح"
                })
                return

            if path == "/api/set-output-dir":
                req_data = json.loads(body.decode('utf-8'))
                new_dir = req_data.get("output_dir", "").strip()
                if new_dir and os.path.isdir(new_dir):
                    save_config({"output_dir": new_dir})
                    self.send_json({"success": True, "output_dir": new_dir})
                else:
                    self.send_json({"success": False, "error": "Invalid directory path"}, 400)
                return

            if path == "/api/browse-output-dir":
                chosen_dir = None
                try:
                    import tkinter as tk
                    from tkinter import filedialog
                    root = tk.Tk()
                    root.withdraw()
                    root.attributes('-topmost', True)
                    chosen_dir = filedialog.askdirectory(initialdir=get_configured_output_dir(), title="اختر مجلد حفظ تقارير التغيرات المكانية")
                    root.destroy()
                except Exception:
                    pass

                if chosen_dir:
                    save_config({"output_dir": chosen_dir})
                    self.send_json({"success": True, "output_dir": chosen_dir})
                else:
                    self.send_json({"success": False, "cancelled": True})
                return

            if path == "/api/open-folder":
                req_data = json.loads(body.decode('utf-8')) if body else {}
                target = req_data.get("path") or get_configured_output_dir()
                if os.path.exists(target):
                    subprocess.Popen(f'explorer "{target}"')
                    self.send_json({"success": True})
                else:
                    self.send_json({"success": False, "error": "Folder does not exist"}, 404)
                return

            if path == "/api/generate-report":
                req_data = json.loads(body.decode('utf-8'))
                parcel = req_data["parcel"]
                shots_list = req_data.get("shots", [])
                signatures = req_data.get("signatures", {})

                out_root = get_configured_output_dir()
                applicant_clean = "".join(c for c in parcel.get("applicant_name", "مواطن") if c.isalnum() or c in (' ', '_', '-')).strip()
                citizen_folder = os.path.join(out_root, applicant_clean)
                os.makedirs(citizen_folder, exist_ok=True)

                # Filter: ONLY include shots where included == True!
                included_shots = [s for s in shots_list if s.get("included") is True]

                if not included_shots:
                    self.send_json({
                        "success": False,
                        "error": "لم يتم تضمين أي لقطة في التقرير! يرجى الضغط على زر 'تضمين في التقرير' للقطات المراد إدراجها."
                    }, 400)
                    return

                yearly_items = []
                for idx, shot in enumerate(included_shots, 1):
                    y = shot.get("year", 2026)
                    src_img = shot.get("image_path", "")
                    comment_text = shot.get("comment", "").strip()
                    rel_date = shot.get("release_date", str(y))
                    lbl = shot.get("label") or f"تصوير سنة {y}"

                    target_img_name = f"satellite_{y}_{idx}.jpg"
                    target_img_path = os.path.join(citizen_folder, target_img_name)
                    if os.path.exists(src_img):
                        shutil.copyfile(src_img, target_img_path)
                    else:
                        target_img_path = src_img

                    yearly_items.append({
                        "year": y,
                        "label": lbl,
                        "release_date": rel_date,
                        "image_path": target_img_path,
                        "comment": comment_text
                    })

                # Copy survey file
                up_name = parcel.get("uploaded_filename")
                if up_name:
                    src_up = os.path.join(TEMP_ASSETS_DIR, up_name)
                    if os.path.exists(src_up):
                        shutil.copyfile(src_up, os.path.join(citizen_folder, up_name))
                else:
                    sample_src = os.path.join(BASE_DIR, "sample_timeline_survey.csv")
                    if os.path.exists(sample_src):
                        shutil.copyfile(sample_src, os.path.join(citizen_folder, "بيانات_الرفع_المساحي.csv"))

                # KML
                kml_path = os.path.join(citizen_folder, f"موقع_{applicant_clean}.kml")
                generate_parcel_kml(parcel, kml_path)

                # Generate Word Document
                docx_name = f"تقرير_تغيرات_مكانية_{applicant_clean}.docx"
                docx_path = os.path.join(citizen_folder, docx_name)
                build_timeline_report(parcel, yearly_items, docx_path, signatures)

                self.send_json({
                    "success": True,
                    "docx_path": docx_path,
                    "folder_path": citizen_folder,
                    "total_years": len(yearly_items)
                })
                return

            self.send_error(404, "Endpoint not found")

        except Exception as e:
            import traceback
            traceback.print_exc()
            self.send_json({"success": False, "error": str(e)}, 500)


def run_server(port=8768):
    server_address = ('127.0.0.1', port)
    httpd = None
    HTTPServer.allow_reuse_address = True
    while port < 8780:
        try:
            httpd = HTTPServer(server_address, AppRequestHandler)
            break
        except OSError:
            port += 1
            server_address = ('127.0.0.1', port)

    print(f"================================================================")
    print(f"  SPATIAL CHANGES OVER TIME SYSTEM - APPSERVER READY")
    print(f"  Access GUI at: http://127.0.0.1:{port}")
    print(f"  Output Directory: {get_configured_output_dir()}")
    print(f"================================================================")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer shutting down.")
        httpd.server_close()


if __name__ == "__main__":
    port = 8768
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            pass
    run_server(port)
