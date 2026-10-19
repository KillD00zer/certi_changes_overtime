# -*- coding: utf-8 -*-
"""
Local Background Updater Service for Google Earth Cadastral Suite (DUDC).
Runs on http://127.0.0.1:8766 to enable the extension in-app update button
to check and pull updates directly, identical to DUDC V4.0 architecture.
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


def get_git_binary():
    """Finds git executable from PATH or common Windows installation directories."""
    git_bin = shutil.which("git")
    if git_bin:
        return git_bin
    for cand in [
        r"C:\Program Files\Git\cmd\git.exe",
        r"C:\Program Files\Git\bin\git.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\Git\cmd\git.exe"),
        os.path.expandvars(r"%ProgramFiles%\Git\cmd\git.exe"),
    ]:
        if os.path.isfile(cand):
            return cand
    return None


def get_current_commit():
    """Retrieve current local Git commit hash."""
    git_bin = get_git_binary()
    if git_bin:
        try:
            res = subprocess.run(
                [git_bin, "rev-parse", "--short", "HEAD"],
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


def check_git_updates():
    """Checks remote repository for updates and returns commit history (matches DUDC V4.0 git_service.py)."""
    git_bin = get_git_binary()
    if not git_bin:
        return {
            "success": False,
            "error": "أداة Git غير مثبتة على هذا النظام أو غير مضافة لمتغيرات البيئة PATH."
        }

    try:
        fetch_res = subprocess.run(
            [git_bin, "fetch", "origin", "main"],
            cwd=PROJ_DIR,
            capture_output=True,
            text=True,
            timeout=10,
            encoding='utf-8'
        )
        if fetch_res.returncode != 0:
            return {
                "success": False,
                "error": f"تعذر الاتصال بـ GitHub: {fetch_res.stderr.strip() or fetch_res.stdout.strip()}"
            }
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "error": "انتهت مهلة الاتصال بخادم GitHub. يرجى التحقق من اتصال الإنترنت."
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"خطأ أثناء فحص GitHub: {str(e)}"
        }

    try:
        local_hash = subprocess.check_output(
            [git_bin, "rev-parse", "--short", "HEAD"],
            cwd=PROJ_DIR,
            text=True
        ).strip()

        remote_hash = subprocess.check_output(
            [git_bin, "rev-parse", "--short", "origin/main"],
            cwd=PROJ_DIR,
            text=True
        ).strip()

        local_raw = subprocess.check_output(
            [git_bin, "log", "-1", "--pretty=format:%h|||%s|||%cr|||%an|||%b"],
            cwd=PROJ_DIR,
            text=True,
            encoding='utf-8'
        ).strip().split('|||')

        current_commit = {
            "hash": local_raw[0] if len(local_raw) > 0 else local_hash,
            "subject": local_raw[1] if len(local_raw) > 1 else "",
            "date": local_raw[2] if len(local_raw) > 2 else "",
            "author": local_raw[3] if len(local_raw) > 3 else "",
            "body": local_raw[4].strip() if len(local_raw) > 4 else ""
        }

        if local_hash == remote_hash:
            return {
                "success": True,
                "update_available": False,
                "current_commit": current_commit,
                "remote_hash": remote_hash,
                "message": "أنت تعمل على أحدث إصدار متوفر حالياً."
            }

        log_out = subprocess.check_output(
            [git_bin, "log", "HEAD..origin/main", "--pretty=format:%h|||%s|||%cr|||%an|||%b<<<ENTRY>>>"],
            cwd=PROJ_DIR,
            text=True,
            encoding='utf-8'
        )

        incoming = []
        for item in log_out.split("<<<ENTRY>>>"):
            item = item.strip()
            if not item:
                continue
            parts = item.split("|||")
            incoming.append({
                "hash": parts[0].strip() if len(parts) > 0 else "",
                "subject": parts[1].strip() if len(parts) > 1 else "",
                "date": parts[2].strip() if len(parts) > 2 else "",
                "author": parts[3].strip() if len(parts) > 3 else "",
                "body": parts[4].strip() if len(parts) > 4 else ""
            })

        return {
            "success": True,
            "update_available": True,
            "count": len(incoming),
            "commits": incoming,
            "current_commit": current_commit,
            "remote_hash": remote_hash,
            "latest_subject": incoming[0]["subject"] if incoming else "",
            "latest_body": incoming[0]["body"] if incoming else ""
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"فشل قراءة سجل التحديثات: {str(e)}"
        }


def perform_git_update():
    """3-Tier Resilient Pull (Normal -> Stash -> Clean Checkout -> Zip Fallback). Matches DUDC V4.0."""
    log("perform_git_update requested")
    git_bin = get_git_binary()
    if not git_bin:
        return {"success": False, "error": "أداة Git غير متوفرة على هذا النظام."}

    try:
        # Tier 1: Normal Pull
        pull_res = subprocess.run(
            [git_bin, "pull", "origin", "main"],
            cwd=PROJ_DIR,
            capture_output=True,
            text=True,
            timeout=30,
            encoding='utf-8'
        )

        # Tier 2: Stash local changes if merge conflict
        if pull_res.returncode != 0:
            err_msg = (pull_res.stderr or pull_res.stdout or "").strip()
            log(f"git pull tier 1 returned code {pull_res.returncode}: {err_msg}")
            if any(k in err_msg.lower() for k in ("overwritten by merge", "commit your changes", "stash", "local changes")):
                subprocess.run(
                    [git_bin, "stash"],
                    cwd=PROJ_DIR,
                    capture_output=True,
                    text=True,
                    timeout=15,
                    encoding='utf-8'
                )
                pull_res = subprocess.run(
                    [git_bin, "pull", "origin", "main"],
                    cwd=PROJ_DIR,
                    capture_output=True,
                    text=True,
                    timeout=30,
                    encoding='utf-8'
                )

        # Tier 3: Clean tracked checkout if still conflict
        if pull_res.returncode != 0:
            log("git pull tier 2 failed, trying checkout -- .")
            subprocess.run(
                [git_bin, "checkout", "--", "."],
                cwd=PROJ_DIR,
                capture_output=True,
                text=True,
                timeout=15,
                encoding='utf-8'
            )
            pull_res = subprocess.run(
                [git_bin, "pull", "origin", "main"],
                cwd=PROJ_DIR,
                capture_output=True,
                text=True,
                timeout=30,
                encoding='utf-8'
            )

        # Tier 4: Zip fallback if git pull still failed
        if pull_res.returncode != 0:
            log("Git pull failed, attempting zip fallback...")
            if zip_fallback_pull():
                pull_res_output = "تم التحديث عبر حزمة GitHub المباشرة بنجاح."
            else:
                return {
                    "success": False,
                    "error": f"فشل السحب من GitHub: {pull_res.stderr.strip() or pull_res.stdout.strip()}"
                }
        else:
            pull_res_output = pull_res.stdout.strip()

        new_hash = subprocess.check_output(
            [git_bin, "rev-parse", "--short", "HEAD"],
            cwd=PROJ_DIR,
            text=True
        ).strip()

        new_raw = subprocess.check_output(
            [git_bin, "log", "-1", "--pretty=format:%h|||%s|||%cr|||%an|||%b"],
            cwd=PROJ_DIR,
            text=True,
            encoding='utf-8'
        ).strip().split('|||')

        new_commit = {
            "hash": new_raw[0] if len(new_raw) > 0 else new_hash,
            "subject": new_raw[1] if len(new_raw) > 1 else "",
            "date": new_raw[2] if len(new_raw) > 2 else "",
            "author": new_raw[3] if len(new_raw) > 3 else "",
            "body": new_raw[4].strip() if len(new_raw) > 4 else ""
        }

        update_build_info(new_commit["hash"])

        log(f"Update succeeded to commit {new_commit['hash']}")
        return {
            "success": True,
            "message": "تم تحديث المنظومة بنجاح إلى أحدث إصدار!",
            "commit": new_commit,
            "pull_output": pull_res_output
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "error": "استغرق التحديث وقتاً طويلاً وتجاوز المهلة المحددة."}
    except Exception as e:
        log(f"perform_git_update exception: {e}")
        return {"success": False, "error": f"حدث خطأ أثناء التحديث: {str(e)}"}


class UpdaterRequestHandler(BaseHTTPRequestHandler):
    def address_string(self):
        return self.client_address[0]

    def log_message(self, format, *args):
        pass

    def send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()

    def do_GET(self):
        clean_path = self.path.split('?')[0]
        if clean_path in ["/api/check-update", "/api/check_update"]:
            res = check_git_updates()
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps(res, ensure_ascii=False).encode("utf-8"))
        elif clean_path in ["/status", "/health", "/"]:
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
        elif clean_path in ["/api/perform-update", "/update"]:
            res = perform_git_update()
            self.send_response(200 if res.get("success") else 500)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps(res, ensure_ascii=False).encode("utf-8"))
        else:
            self.send_error(404, "Not Found")

    def do_POST(self):
        clean_path = self.path.split('?')[0]
        if clean_path in ["/api/perform-update", "/api/perform_update", "/update", "/pull"]:
            res = perform_git_update()
            self.send_response(200 if res.get("success") else 500)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps(res, ensure_ascii=False).encode("utf-8"))
        elif clean_path in ["/api/check-update", "/api/check_update"]:
            res = check_git_updates()
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps(res, ensure_ascii=False).encode("utf-8"))
        else:
            self.send_error(404, "Not Found")


def run_service():
    log("Starting DUDC Extension Updater Service (Port 8766)...")
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
