@echo off
chcp 65001 >nul
title Spatial Changes Over Time System - DUDC
color 0B

echo ================================================================
echo    SPATIAL CHANGES OVER TIME REPORT SYSTEM (DUDC)
echo    منظومة رصد التغيرات المكانية والإنشائية عبر الزمن
echo ================================================================
echo.

cd /d "%~dp0"

:: Check for Python
set PY_CMD=
where python >nul 2>nul
if %ERRORLEVEL% equ 0 (
    set PY_CMD=python
) else (
    if exist "C:\Program Files\ArcGIS\Pro\bin\Python\envs\arcgispro-py3\python.exe" (
        set PY_CMD="C:\Program Files\ArcGIS\Pro\bin\Python\envs\arcgispro-py3\python.exe"
    )
)

if "%PY_CMD%"=="" (
    echo [ERROR] Python 3 was not found on your system.
    echo Please install Python 3.10+ or run inside ArcGIS Pro environment.
    pause
    exit /b 1
)

echo [*] Starting App Server on http://127.0.0.1:8768 ...
start "" http://127.0.0.1:8768
%PY_CMD% app_server.py 8768

pause
