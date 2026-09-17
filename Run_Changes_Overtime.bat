@echo off
chcp 65001 >nul
cd /d "%~dp0src"
call run_app.bat
