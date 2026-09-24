@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title تحديث منظومة المتغيرات المكانية - Google Earth Survey

color 0A
cls
echo ================================================================
echo    GOOGLE EARTH CADASTRAL SURVEY EXTENSION (DUDC)
echo    تحديث منظومة رصد المتغيرات المكانية من GitHub
echo ================================================================
echo.

set "REPO_URL=https://github.com/KillD00zer/certi_processing_tools"
set "BRANCH=main"
set "TARGET_DIR=%~dp0"
set "EXT_DIR=%~dp0extension"
set "ZIP_FILE=%TEMP%\certi_tools_update_%RANDOM%.zip"
set "EXTRACT_DIR=%TEMP%\certi_tools_extracted_%RANDOM%"

echo [*] جاري فحص والاتصال بـ GitHub...
echo [*] المستودع: %REPO_URL%
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$ProgressPreference = 'SilentlyContinue';" ^
    "$repoUrl = '%REPO_URL%';" ^
    "$zipUrl = \"$repoUrl/archive/refs/heads/%BRANCH%.zip\";" ^
    "Write-Host '[*] جاري تنزيل أحدث كود وتحديثات من GitHub...' -ForegroundColor Cyan;" ^
    "try {" ^
    "    Invoke-WebRequest -Uri $zipUrl -OutFile '%ZIP_FILE%' -TimeoutSec 30;" ^
    "} catch {" ^
    "    Write-Host '[!] فشل في تنزيل ملف التحديث. يرجى التأكد من اتصال الإنترنت أو صلاحية المستودع.' -ForegroundColor Red;" ^
    "    exit 1;" ^
    "}" ^
    "if (-not (Test-Path '%ZIP_FILE%')) {" ^
    "    Write-Host '[!] لم يتم العثور على ملف التنزيل.' -ForegroundColor Red;" ^
    "    exit 1;" ^
    "}" ^
    "Write-Host '[*] جاري فك الضغط وتحديث ملفات المنظومة...' -ForegroundColor Yellow;" ^
    "Expand-Archive -Path '%ZIP_FILE%' -DestinationPath '%EXTRACT_DIR%' -Force;" ^
    "$innerRoot = Get-ChildItem -Path '%EXTRACT_DIR%' | Select-Object -First 1;" ^
    "if (-not $innerRoot) {" ^
    "    Write-Host '[!] الملف المضغوط فارغ أو غير صالح.' -ForegroundColor Red;" ^
    "    exit 1;" ^
    "}" ^
    "$srcExtension = Join-Path $innerRoot.FullName 'extension';" ^
    "if (Test-Path $srcExtension) {" ^
    "    Copy-Item -Path \"$srcExtension\*\" -Destination '%EXT_DIR%' -Recurse -Force;" ^
    "    Write-Host '[OK] تم تحديث مجلد الإضافة (extension) بنجاح!' -ForegroundColor Green;" ^
    "}" ^
    "$srcBatch = Join-Path $innerRoot.FullName 'Launch_Chrome_With_Extension.bat';" ^
    "if (Test-Path $srcBatch) {" ^
    "    Copy-Item -Path $srcBatch -Destination '%TARGET_DIR%' -Force;" ^
    "}" ^
    "Remove-Item -Path '%EXTRACT_DIR%' -Recurse -Force -ErrorAction SilentlyContinue;" ^
    "Remove-Item -Path '%ZIP_FILE%' -Force -ErrorAction SilentlyContinue;" ^
    "Write-Host '[OK] اكتمل التحديث بالكامل!' -ForegroundColor Green;"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ================================================================
    echo  [!] حدث خطأ أثناء التحديث.
    echo  يرجى التأكد من اتصال الإنترنت وأن المستودع متاح للعامة (Public).
    echo ================================================================
    echo.
    pause
    exit /b 1
)

echo.
echo ================================================================
echo   ✅ تم تحديث المنظومة بنجاح إلى أحدث إصدار!
echo ================================================================
echo.
echo  خيارات التشغيل:
echo  [1] إعادة تشغيل Google Chrome الآن مع الإضافة المحدثة فوراً (اضغط 1 أو Enter)
echo  [2] إغلاق النافذة بدون تشغيل Chrome (اضغط 2)
echo.

set /p USER_CHOICE="اختر خيارك [1/2] (الافتراضي 1): "
if "%USER_CHOICE%"=="2" (
    echo.
    echo تم الانتهاء! عند فتح المتصفح ستعمل الإضافة بالإصدار المحدث.
    timeout /t 3 >nul
    exit /b 0
)

:: تشغيل كروم مع الإضافة المحدثة
if exist "%~dp0Launch_Chrome_With_Extension.bat" (
    start "" "%~dp0Launch_Chrome_With_Extension.bat"
) else (
    start "" chrome.exe --load-extension="%EXT_DIR%" "https://earth.google.com/web"
)
exit /b 0
