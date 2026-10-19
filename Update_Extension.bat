@echo off
setlocal EnableExtensions
chcp 65001 > nul
title Google Earth Cadastral Survey - GitHub System Updater
cls
cd /d "%~dp0"

echo ======================================================================
echo   Google Earth Cadastral Survey - GitHub System Updater
echo   منظومة الرفع المساحي والمتغيرات المكانية - أداة التحديث الميداني
echo ======================================================================
echo.

where git >nul 2>&1
if %ERRORLEVEL% neq 0 (
    if exist "C:\Program Files\Git\cmd\git.exe" set "PATH=C:\Program Files\Git\cmd;%PATH%"
    if exist "%ProgramFiles%\Git\cmd\git.exe" set "PATH=%ProgramFiles%\Git\cmd;%PATH%"
    if exist "%LOCALAPPDATA%\Programs\Git\cmd\git.exe" set "PATH=%LOCALAPPDATA%\Programs\Git\cmd;%PATH%"
)

where git >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] أداة Git غير مثبتة على هذا النظام أو غير مضافة لمتغيرات البيئة.
    echo يرجى تثبيت Git من: https://git-scm.com/
    echo.
    pause
    exit /b 1
)

echo [1/3] جارٍ الاتصال بمستودع GitHub والتحقق من التحديثات...
git fetch origin main >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [WARNING] تعذر الاتصال بـ GitHub. يرجى التحقق من اتصال الإنترنت.
    echo.
    pause
    exit /b 1
)

set "LOCAL_HASH="
set "REMOTE_HASH="
for /f %%a in ('git rev-parse --short HEAD') do set "LOCAL_HASH=%%a"
for /f %%a in ('git rev-parse --short origin/main') do set "REMOTE_HASH=%%a"

echo [2/3] الإصدار المثبت حالياً: [%LOCAL_HASH%]
echo       أحدث إصدار على GitHub:   [%REMOTE_HASH%]
echo.

if "%LOCAL_HASH%"=="%REMOTE_HASH%" (
    echo ======================================================================
    echo   المنظومة محدثة بالكامل لأحدث إصدار رسمي (%LOCAL_HASH%)!
    echo ======================================================================
    echo.
    pause
    exit /b 0
)

echo ======================================================================
echo   يتوفر تحديث جديد! سجل التعديلات المنشورة:
echo ======================================================================
echo.
git log HEAD..origin/main --pretty=format:"* %%s [%%h] (%%cr)"
echo.
echo ======================================================================
echo.

set /p CONFIRM="هل تريد سحب وتطبيق هذا التحديث الآن؟ (Y/N، الافتراضي Y): "
if /i "%CONFIRM%"=="N" (
    echo تم إلغاء عملية التحديث.
    pause
    exit /b 0
)

echo.
echo [3/3] جارٍ سحب وتطبيق التحديثات من GitHub (git pull)...
echo ----------------------------------------------------------------------
git pull origin main

if %ERRORLEVEL% neq 0 (
    echo.
    echo [ملاحظة] تم العثور على تعديلات محلية. جارٍ حفظها مؤقتاً (git stash) وإعادة السحب...
    git stash >nul 2>&1
    git pull origin main
)

if %ERRORLEVEL% neq 0 (
    echo [ملاحظة] جارٍ تنظيف الملفات المتعارضة (git checkout -- .) وإعادة السحب...
    git checkout -- . >nul 2>&1
    git pull origin main
)

if %ERRORLEVEL% equ 0 (
    echo.
    echo ======================================================================
    echo   [نجاح] تم تحديث المنظومة بنجاح إلى أحدث إصدار!
    echo   يمكنك الآن إعادة تحميل الإضافة في المتصفح لاستخدام المميزات الجديدة.
    echo ======================================================================
) else (
    echo.
    echo [خطأ] تعذر استكمال التحديث التلقائي. يرجى مراجعة رسائل الخطأ أعلاه.
)

echo.
pause
