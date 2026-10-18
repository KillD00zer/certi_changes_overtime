# -*- coding: utf-8 -*-
"""
Local Background Updater Service for Google Earth Cadastral Suite (DUDC).
Runs on http://127.0.0.1:8766 to enable the extension in-app update button
to pull the latest code from GitHub and reload seamlessly.
"""

import os
import sys
import json
import time
import shutil
import urllib.request
import zipfile
import subprocess
from http.server import HTTPServer, BaseHTTPRequestHandler

# Ensure stdout and stderr never crash under pythonw.exe
if sys.stdout is None:
    sys.stdout = open(os.devnull, 'w', encoding='utf-8')
if sys.stderr is None:
    sys.stderr = open(os.devnull, 'w', encoding='utf-8')

PROJ_DIR = os.path.dirname(os.path.abspath(__file__))
EXT_DIR = os.path.join(PROJ_DIR, "extension")
BUILD_INFO_PATH = os.path.join(EXT_DIR, "build_info.json")
PORT = 8766


def log(msg):
    try:
        log_file = os.path.join(PROJ_DIR, "updater_service.log")
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}\n")
    except Exception:
        pass


def get_current_commit():
    """Retrieve current local Git commit hash."""
    try:
        res = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=PROJ_DIR,
            capture_output=True,
            text=True,
            timeout=5
        )
        if res.returncode == 0 and res.stdout.strip():
            return res.stdout.strip()
    except Exception:
        pass

    if os.path.exists(BUILD_INFO_PATH):
        try:
            with open(BUILD_INFO_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("commit", "unknown")
        except Exception:
            pass
    return "unknown"


def update_build_info(commit_hash):
    """Write latest commit info to extension/build_info.json."""
    try:
        manifest_ver = "3.0.0"
        manifest_path = os.path.join(EXT_DIR, "manifest.json")
        if os.path.exists(manifest_path):
            with open(manifest_path, "r", encoding="utf-8") as f:
                mData = json.load(f)
                manifest_ver = mData.get("version", "3.0.0")

        data = {
            "version": manifest_ver,
            "commit": commit_hash,
            "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        }
        with open(BUILD_INFO_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        log(f"Failed to write build_info.json: {e}")
        return False


def zip_fallback_pull():
    """Direct zip download and extraction fallback."""
    zip_url = "https://github.com/KillD00zer/certi_changes_overtime/archive/refs/heads/main.zip"
    temp_zip = os.path.join(PROJ_DIR, "_update_temp.zip")
    temp_dir = os.path.join(PROJ_DIR, "_update_temp_unpacked")

    try:
        log("Downloading zip fallback from GitHub...")
        urllib.request.urlretrieve(zip_url, temp_zip)

        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)
        os.makedirs(temp_dir, exist_ok=True)

        with zipfile.ZipFile(temp_zip, "r") as zf:
            zf.extractall(temp_dir)

        # Locate extracted extension dir
        root_entries = [os.path.join(temp_dir, d) for d in os.listdir(temp_dir) if os.path.isdir(os.path.join(temp_dir, d))]
        if root_entries:
            src_ext = os.path.join(root_entries[0], "extension")
            if os.path.exists(src_ext):
                # Copy files into EXT_DIR
                for item in os.listdir(src_ext):
                    s = os.path.join(src_ext, item)
                    d = os.path.join(EXT_DIR, item)
                    if os.path.isdir(s):
                        if os.path.exists(d):
                            shutil.rmtree(d, ignore_errors=True)
                        shutil.copytree(s, d)
                    else:
                        shutil.copy2(s, d)

        # Cleanup
        if os.path.exists(temp_zip):
            os.remove(temp_zip)
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)

        log("Zip fallback update applied successfully.")
        return True
    except Exception as e:
        log(f"Zip fallback failed: {e}")
        return False


def perform_git_pull():
    """Execute git pull with fallback and return status and commit hash."""
    log("perform_git_pull requested")
    success = False
    output = ""

    # Attempt 1: Git
    try:
        subprocess.run(["git", "fetch", "origin", "main"], cwd=PROJ_DIR, capture_output=True, timeout=20)
        pull_res = subprocess.run(["git", "pull", "origin", "main"], cwd=PROJ_DIR, capture_output=True, text=True, timeout=25)
        if pull_res.returncode == 0:
            success = True
            output = pull_res.stdout.strip()
            log(f"git pull succeeded: {output}")
        else:
            log(f"git pull failed with code {pull_res.returncode}, attempting clean...")
            # Stash or reset working tree
            subprocess.run(["git", "checkout", "--", "."], cwd=PROJ_DIR, capture_output=True, timeout=10)
            retry = subprocess.run(["git", "pull", "origin", "main"], cwd=PROJ_DIR, capture_output=True, text=True, timeout=25)
            if retry.returncode == 0:
                success = True
                output = retry.stdout.strip()
                log(f"git pull retry succeeded: {output}")
    except Exception as ge:
        log(f"git pull exception: {ge}")

    # Attempt 2: Zip fallback if git pull wasn't successful
    if not success:
        log("Trying direct zip fallback...")
        if zip_fallback_pull():
            success = True
            output = "تم التحديث عبر حزمة GitHub المباشرة بنجاح."

    new_commit = get_current_commit()
    update_build_info(new_commit)

    return {
        "success": success,
        "commit": new_commit,
        "output": output,
        "message": "تم سحب وتطبيق أحدث كود من GitHub بنجاح" if success else "تعذر استكمال السحب التلقائي"
    }


class UpdaterRequestHandler(BaseHTTPRequestHandler):
    def address_string(self):
        return self.client_address[0]

    def log_message(self, format, *args):
        # Safe logging without stdout/stderr crash
        pass

    def send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()

    def do_GET(self):
        if self.path in ["/status", "/health", "/"]:
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_cors_headers()
            self.end_headers()
            resp = {
                "service": "dudc_extension_updater",
                "status": "ready",
                "local_commit": get_current_commit(),
                "project_dir": PROJ_DIR
            }
            self.wfile.write(json.dumps(resp, ensure_ascii=False).encode("utf-8"))
        elif self.path == "/update":
            result = perform_git_pull()
            self.send_response(200 if result.get("success") else 500)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps(result, ensure_ascii=False).encode("utf-8"))
        else:
            self.send_error(404, "Not Found")

    def do_POST(self):
        if self.path in ["/update", "/pull"]:
            result = perform_git_pull()
            self.send_response(200 if result.get("success") else 500)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps(result, ensure_ascii=False).encode("utf-8"))
        else:
            self.send_error(404, "Not Found")


def run_service():
    log("Starting DUDC Extension Updater Service...")
    current_commit = get_current_commit()
    update_build_info(current_commit)

    server_address = ("127.0.0.1", PORT)
    try:
        httpd = HTTPServer(server_address, UpdaterRequestHandler)
        log(f"Updater service listening on 127.0.0.1:{PORT}")
        httpd.serve_forever()
    except OSError as e:
        log(f"Port {PORT} error or already bound: {e}")


if __name__ == "__main__":
    run_service()
