@echo off
chcp 65001 >nul
title تشغيل إضافة Google Earth Survey للمتغيرات المكانية
color 0B

echo ================================================================
echo    GOOGLE EARTH CADASTRAL SURVEY EXTENSION (DUDC)
echo    منظومة رصد المتغيرات المكانية - إضافة Google Earth Web
echo ================================================================
echo.

set EXT_PATH=%~dp0extension

:: Detect Chrome Executable
set CHROME_BIN=
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    set CHROME_BIN="C:\Program Files\Google\Chrome\Application\chrome.exe"
) else if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    set CHROME_BIN="C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
) else if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" (
    set CHROME_BIN="%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
) else if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    set CHROME_BIN="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
)

if "%CHROME_BIN%"=="" (
    echo [!] لم يتم العثور على مسار Chrome أو Edge التلقائي.
    echo يمكنك تثبيت الإضافة يدوياً من مسار:
    echo %EXT_PATH%
    echo عبر فتح chrome://extensions وتفعيل Developer Mode ثم Load Unpacked.
    pause
    exit /b 1
)

echo [*] جاري تشغيل المتصفح وتحميل الإضافة تلقائياً...
echo [*] مسار الإضافة: %EXT_PATH%
echo.

start "" %CHROME_BIN% --load-extension="%EXT_PATH%" "https://earth.google.com/web"

echo [OK] تم تشغيل المتصفح. يمكنك الآن الضغط على أيقونة الإضافة في شريط الأدوات العلوي!
timeout /t 5 >nul
