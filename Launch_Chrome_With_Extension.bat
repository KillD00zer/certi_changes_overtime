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
set "USER_DATA=%~dp0.browser_profile"

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
    echo عبر فتح edge://extensions أو chrome://extensions وتفعيل Developer Mode ثم Load Unpacked.
    echo.
    pause
    exit /b 1
)

echo [*] المتصفح المكتشف: %BROWSER_BIN%
echo [*] مسار الإضافة: %EXT_PATH%
echo [*] جاري تشغيل المتصفح وتحميل الإضافة تلقائياً...
echo.

:: تشغيل خدمة التحديث المباشر التلقائي بالخلفية لدعم زر التحديث داخل الإضافة
where python >nul 2>&1
if %ERRORLEVEL% equ 0 (
    start /b "" python "%~dp0updater_service.py" >nul 2>&1
)

:: استخدام بروفايل مخصص لضمان تحميل الإضافة حتى لو كان المتصفح مفتوحاً مسبقاً
start "" "%BROWSER_BIN%" --user-data-dir="%USER_DATA%" --load-extension="%EXT_PATH%" --no-first-run --no-default-browser-check "https://earth.google.com/web"

echo ================================================================
echo [OK] تم إطلاق المتصفح وتحميل الإضافة بنجاح!
echo.
echo 💡 ملحوظة هامة:
echo    إذا كان المتصفح مفتوحاً من قبل والإضافة مثبتة لديك:
echo    ادخل على edge://extensions أو chrome://extensions واضغط [↻ Reload / إعادة تحميل]
echo ================================================================
echo.
timeout /t 5 > nul
exit /b 0
