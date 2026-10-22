@echo off
setlocal EnableExtensions
chcp 65001 > nul
title Launch Google Earth Cadastral Survey & Spatial Changes Suite
color 0B
cls
cd /d "%~dp0"

echo ================================================================
echo    GOOGLE EARTH CADASTRAL SURVEY EXTENSION (DUDC)
echo    Cadastral Survey and Spatial Changes Suite - Web Launcher
echo ================================================================
echo.

set "EXT_PATH=%~dp0extension"
set "USER_DATA=%~dp0.browser_profile"

:: Search for installed Google Chrome or Microsoft Edge
set "BROWSER_BIN="
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    set "BROWSER_BIN=C:\Program Files\Google\Chrome\Application\chrome.exe"
) else if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    set "BROWSER_BIN=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
) else if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" (
    set "BROWSER_BIN=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
) else if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    set "BROWSER_BIN=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
) else if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" (
    set "BROWSER_BIN=C:\Program Files\Microsoft\Edge\Application\msedge.exe"
)

if "%BROWSER_BIN%"=="" (
    echo [!] Chrome or Edge browser was not found automatically.
    echo You can install and load the extension manually from:
    echo %EXT_PATH%
    echo by opening edge://extensions or chrome://extensions, enabling Developer Mode, and clicking Load Unpacked.
    echo.
    pause
    exit /b 1
)

echo [*] Detected browser: %BROWSER_BIN%
echo [*] Extension path:   %EXT_PATH%
echo [*] Starting background auto-updater service...

:: Start background auto-updater daemon for in-app extension updates
where pythonw >nul 2>&1
if %ERRORLEVEL% equ 0 (
    start "" pythonw "%~dp0updater_service.py"
) else (
    where python >nul 2>&1
    if %ERRORLEVEL% equ 0 (
        start "" /min python "%~dp0updater_service.py"
    )
)

echo [*] Launching browser and loading extension automatically...
echo.

:: Launch browser with dedicated user profile to ensure extension loads properly
start "" "%BROWSER_BIN%" --user-data-dir="%USER_DATA%" --load-extension="%EXT_PATH%" --no-first-run --no-default-browser-check "https://earth.google.com/web"

echo ================================================================
echo [OK] Browser launched and extension loaded successfully.
echo.
echo Important Note:
echo    If your browser was already running with this extension:
echo    Navigate to chrome://extensions or edge://extensions and click [Reload]
echo ================================================================
echo.
timeout /t 5 /nobreak >nul 2>nul || ping -n 5 127.0.0.1 >nul
exit /b 0

