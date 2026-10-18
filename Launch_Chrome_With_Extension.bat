@echo off
setlocal EnableExtensions
chcp 65001 > nul
title تشغيل إضافة Google Earth Survey للمتغيرات المكانية
color 0B
cls
cd /d "%~dp0"

echo ================================================================
echo    GOOGLE EARTH CADASTRAL SURVEY EXTENSION (DUDC)
echo    منظومة رصد المتغيرات المكانية - إضافة Google Earth Web
echo ================================================================
echo.

set "EXT_PATH=%~dp0extension"

:: البحث عن متصفح Chrome أو Edge المثبت على النظام
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
    echo [!] لم يتم العثور على متصفح Chrome أو Edge تلقائياً.
    echo يمكنك تثبيت وتفعيل الإضافة يدوياً من المسار:
    echo %EXT_PATH%
    echo عبر فتح chrome://extensions وتفعيل Developer Mode ثم Load Unpacked.
    echo.
    pause
    exit /b 1
)

echo [*] جاري تشغيل المتصفح وتحميل الإضافة تلقائياً...
echo [*] مسار الإضافة: %EXT_PATH%
echo.

start "" "%BROWSER_BIN%" --load-extension="%EXT_PATH%" "https://earth.google.com/web"

echo [OK] تم تشغيل المتصفح بنجاح!
echo يمكنك الآن النقر على أيقونة الإضافة في شريط الأدوات العلوي أو الجانبي.
timeout /t 4 > nul
exit /b 0
