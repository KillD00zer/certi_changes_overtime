@echo off
setlocal EnableExtensions
chcp 65001 > nul
title منظومة رصد المتغيرات المكانية - ترقية وتحديث الإضافة (GitHub)
cls
cd /d "%~dp0"

echo ======================================================================
echo   منظومة رصد المتغيرات المكانية - ترقية وتحديث الإضافة من GitHub
echo   Google Earth Cadastral Suite (DUDC) - Auto Updater
echo ======================================================================
echo.

REM 1. البحث عن أداة Git في النظام ومسارات التثبيت الشائعة
where git >nul 2>&1
if %ERRORLEVEL% neq 0 (
    if exist "C:\Program Files\Git\cmd\git.exe" set "PATH=C:\Program Files\Git\cmd;%PATH%"
    if exist "%ProgramFiles%\Git\cmd\git.exe" set "PATH=%ProgramFiles%\Git\cmd;%PATH%"
    if exist "%LOCALAPPDATA%\Programs\Git\cmd\git.exe" set "PATH=%LOCALAPPDATA%\Programs\Git\cmd;%PATH%"
)

where git >nul 2>&1
set "HAS_GIT=1"
if %ERRORLEVEL% neq 0 set "HAS_GIT=0"

REM فحص هل المجلد مستودع Git صالح
if not exist "%~dp0.git" set "HAS_GIT=0"

if "%HAS_GIT%"=="1" (
    goto git_update
) else (
    goto zip_fallback_update
)

:git_update
echo [1/3] الاتصال بمستودع GitHub وفحص التحديثات...
git fetch origin main >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [تحذير] تعذر الاتصال بـ GitHub عبر Git. جاري الانتقال لطريقة التحميل المباشر...
    goto zip_fallback_update
)

set "LOCAL_HASH="
set "REMOTE_HASH="
for /f %%a in ('git rev-parse --short HEAD') do set "LOCAL_HASH=%%a"
for /f %%a in ('git rev-parse --short origin/main') do set "REMOTE_HASH=%%a"

echo [2/3] الإصدار الحالي المثبت: [%LOCAL_HASH%]
echo       أحدث إصدار على GitHub:  [%REMOTE_HASH%]
echo.

set "INCOMING_COUNT=0"
for /f %%a in ('git rev-list HEAD..origin/main --count') do set "INCOMING_COUNT=%%a"

if "%INCOMING_COUNT%"=="0" (
    echo ======================================================================
    echo   المنظومة محدثة بالكامل! أنت تعمل على أحدث كود منشور.
    echo ======================================================================
    echo.
    goto launch_prompt
)

echo ======================================================================
echo   يتوفر %INCOMING_COUNT% تحديث جديد! سجل التعديلات المنشورة:
echo ======================================================================
echo.
git log HEAD..origin/main --pretty=format:"* %s [%h] (%cr)"
echo.
echo ======================================================================
echo.

set "CONFIRM=Y"
set /p CONFIRM="هل تريد سحب وتطبيق هذا التحديث الآن؟ (Y/N، الافتراضي Y): "
if /i "%CONFIRM%"=="N" (
    echo تم إلغاء التحديث.
    pause
    exit /b 0
)

echo.
echo [3/3] جاري سحب وتطبيق التحديثات (git pull)...
echo ----------------------------------------------------------------------
git pull origin main

if %ERRORLEVEL% neq 0 (
    echo.
    echo [تنبيه] تم رصد تعديلات محلية. جاري الحفظ المؤقت وإعادة المحاولة...
    git stash >nul 2>&1
    git pull origin main
)

if %ERRORLEVEL% neq 0 (
    echo [تنبيه] جاري تنظيف شجرة العمل وإعادة المحاولة...
    git checkout -- . >nul 2>&1
    git pull origin main
)

if %ERRORLEVEL% equ 0 (
    echo.
    echo ======================================================================
    echo   [نجاح] تم تحديث المنظومة بنجاح إلى أحدث إصدار!
    echo ======================================================================
) else (
    echo.
    echo [خطأ] تعذر استكمال السحب عبر Git. جاري التحميل المباشر...
    goto zip_fallback_update
)
goto launch_prompt

:zip_fallback_update
echo [*] جاري تحميل أحدث حزمة تحديث مباشرة من GitHub (Direct Zip Stream)...
set "REPO_ZIP=https://github.com/KillD00zer/certi_changes_overtime/archive/refs/heads/main.zip"
set "TEMP_ZIP=%TEMP%\certi_update_%RANDOM%.zip"
set "TEMP_EXTRACT=%TEMP%\certi_unpacked_%RANDOM%"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$ProgressPreference = 'SilentlyContinue';" ^
    "try {" ^
    "    Write-Host '[*] جاري الاتصال وتنزيل الحزمة...' -ForegroundColor Cyan;" ^
    "    Invoke-WebRequest -Uri '%REPO_ZIP%' -OutFile '%TEMP_ZIP%' -TimeoutSec 40;" ^
    "    if (-not (Test-Path '%TEMP_ZIP%')) { exit 1; }" ^
    "    Write-Host '[*] جاري فك وتطبيق ملفات الإضافة...' -ForegroundColor Yellow;" ^
    "    Expand-Archive -Path '%TEMP_ZIP%' -DestinationPath '%TEMP_EXTRACT%' -Force;" ^
    "    $rootFolder = Get-ChildItem -Path '%TEMP_EXTRACT%' | Select-Object -First 1;" ^
    "    $srcExt = Join-Path $rootFolder.FullName 'extension';" ^
    "    if (Test-Path $srcExt) {" ^
    "        Copy-Item -Path \"$srcExt\*\" -Destination '%~dp0extension' -Recurse -Force;" ^
    "    }" ^
    "    Remove-Item -Path '%TEMP_EXTRACT%' -Recurse -Force -ErrorAction SilentlyContinue;" ^
    "    Remove-Item -Path '%TEMP_ZIP%' -Force -ErrorAction SilentlyContinue;" ^
    "    Write-Host '[OK] اكتمل التحديث بنجاح!' -ForegroundColor Green;" ^
    "} catch {" ^
    "    Write-Host '[!] فشل التحميل: ' $_.Exception.Message -ForegroundColor Red;" ^
    "    exit 1;" ^
    "}"

if %ERRORLEVEL% equ 0 (
    echo.
    echo ======================================================================
    echo   [نجاح] تم تنزيل وتحديث ملفات الإضافة بنجاح!
    echo ======================================================================
) else (
    echo.
    echo ======================================================================
    echo   [خطأ] تعذر إتمام التحديث. يرجى التحقق من اتصال الإنترنت.
    echo ======================================================================
    echo.
    pause
    exit /b 1
)

:launch_prompt
echo.
echo الخيارات المتاحة:
echo   [1] تشغيل متصفح Chrome مع الإضافة المحدثة فوراً (اضغط 1 أو Enter)
echo   [2] إنهاء وإغلاق النافذة (اضغط 2)
echo.

set "ACTION_CHOICE=1"
set /p ACTION_CHOICE="حدد اختيارك [1/2] (الافتراضي 1): "
if "%ACTION_CHOICE%"=="2" (
    echo تم الانتهاء بنجاح.
    timeout /t 2 > nul
    exit /b 0
)

if exist "%~dp0Launch_Chrome_With_Extension.bat" (
    start "" "%~dp0Launch_Chrome_With_Extension.bat"
)
exit /b 0
