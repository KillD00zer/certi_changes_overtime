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
import subprocess
from http.server import HTTPServer, BaseHTTPRequestHandler

PROJ_DIR = os.path.dirname(os.path.abspath(__file__))
EXT_DIR = os.path.join(PROJ_DIR, "extension")
BUILD_INFO_PATH = os.path.join(EXT_DIR, "build_info.json")
PORT = 8766


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
        if res.returncode == 0:
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
        print(f"[Error] Failed to write build_info.json: {e}")
        return False


def perform_git_pull():
    """Execute git pull and return status and commit hash."""
    try:
        # 1. Fetch
        subprocess.run(["git", "fetch", "origin", "main"], cwd=PROJ_DIR, capture_output=True, timeout=25)
        # 2. Pull
        pull_res = subprocess.run(["git", "pull", "origin", "main"], cwd=PROJ_DIR, capture_output=True, text=True, timeout=30)
        
        new_commit = get_current_commit()
        update_build_info(new_commit)

        if pull_res.returncode == 0:
            return {
                "success": True,
                "commit": new_commit,
                "output": pull_res.stdout.strip(),
                "message": "تم سحب وتطبيق أحدث كود من GitHub بنجاح"
            }
        else:
            return {
                "success": False,
                "commit": new_commit,
                "error": pull_res.stderr.strip() or "فشل سحب التحديث",
                "message": "تعذر إتمام git pull تلقائياً"
            }
    except Exception as e:
        return {
            "success": False,
            "commit": get_current_commit(),
            "error": str(e),
            "message": "خطأ أثناء محاولة سحب التحديث"
        }


class UpdaterRequestHandler(BaseHTTPRequestHandler):
    def address_string(self):
        return self.client_address[0]

    def log_message(self, format, *args):
        sys.stderr.write(f"[{time.strftime('%H:%M:%S')}] {self.client_address[0]} - {format % args}\n")

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
    current_commit = get_current_commit()
    update_build_info(current_commit)

    server_address = ("127.0.0.1", PORT)
    try:
        httpd = HTTPServer(server_address, UpdaterRequestHandler)
        print(f"[Updater] DUDC Extension Updater Service running on http://127.0.0.1:{PORT}")
        print(f"[Updater] Current local commit: {current_commit}")
        httpd.serve_forever()
    except OSError as e:
        print(f"[Updater] Port {PORT} already in use or error: {e}")


if __name__ == "__main__":
    run_service()
