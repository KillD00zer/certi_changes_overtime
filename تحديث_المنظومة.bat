@echo off
setlocal EnableExtensions
chcp 65001 > nul
title Spatial Change Monitoring System - Upgrade & Update (GitHub)
cls
cd /d "%~dp0"

echo ======================================================================
echo   Spatial Change Monitoring System - GitHub Updater
echo   Google Earth Cadastral Suite (DUDC) - Auto Updater
echo ======================================================================
echo.

REM 1. Search for Git in system and common installation paths
where git >nul 2>&1
if %ERRORLEVEL% neq 0 (
    if exist "C:\Program Files\Git\cmd\git.exe" set "PATH=C:\Program Files\Git\cmd;%PATH%"
    if exist "%ProgramFiles%\Git\cmd\git.exe" set "PATH=%ProgramFiles%\Git\cmd;%PATH%"
    if exist "%LOCALAPPDATA%\Programs\Git\cmd\git.exe" set "PATH=%LOCALAPPDATA%\Programs\Git\cmd;%PATH%"
)

where git >nul 2>&1
set "HAS_GIT=1"
if %ERRORLEVEL% neq 0 set "HAS_GIT=0"

REM Check if valid Git repository exists
if not exist "%~dp0.git" set "HAS_GIT=0"

if "%HAS_GIT%"=="1" (
    goto git_update
) else (
    goto zip_fallback_update
)

:git_update
echo [1/3] Connecting to GitHub repository and checking for updates...
git fetch origin main >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [WARNING] Unable to connect to GitHub via Git. Switching to direct download...
    goto zip_fallback_update
)

set "LOCAL_HASH="
set "REMOTE_HASH="
for /f %%a in ('git rev-parse --short HEAD') do set "LOCAL_HASH=%%a"
for /f %%a in ('git rev-parse --short origin/main') do set "REMOTE_HASH=%%a"

echo [2/3] Current installed version: [%LOCAL_HASH%]
echo       Latest GitHub version:     [%REMOTE_HASH%]
echo.

set "INCOMING_COUNT=0"
for /f %%a in ('git rev-list HEAD..origin/main --count') do set "INCOMING_COUNT=%%a"

if "%INCOMING_COUNT%"=="0" (
    echo ======================================================================
    echo   System is fully up to date. You are running the latest release.
    echo ======================================================================
    echo.
    goto launch_prompt
)

echo ======================================================================
echo   %INCOMING_COUNT% new update(s) available. Change log:
echo ======================================================================
echo.
git log HEAD..origin/main --pretty=format:"* %s [%h] (%cr)"
echo.
echo ======================================================================
echo.

set "CONFIRM=Y"
set /p CONFIRM="Do you want to pull and apply this update now? (Y/N, default Y): "
if /i "%CONFIRM%"=="N" (
    echo Update cancelled.
    pause
    exit /b 0
)

echo.
echo [3/3] Pulling and applying updates from GitHub (git pull)...
echo ----------------------------------------------------------------------
git pull origin main

if %ERRORLEVEL% neq 0 (
    echo.
    echo [NOTICE] Local modifications detected. Stashing changes and retrying...
    git stash >nul 2>&1
    git pull origin main
)

if %ERRORLEVEL% neq 0 (
    echo [NOTICE] Cleaning conflicting working tree and retrying...
    git checkout -- . >nul 2>&1
    git pull origin main
)

if %ERRORLEVEL% equ 0 (
    echo.
    echo ======================================================================
    echo   [SUCCESS] System updated successfully to the latest version.
    echo ======================================================================
) else (
    echo.
    echo [ERROR] Git pull could not complete. Switching to direct download...
    goto zip_fallback_update
)
goto launch_prompt

:zip_fallback_update
echo [*] Downloading latest update package directly from GitHub (Direct Zip Stream)...
set "REPO_ZIP=https://github.com/KillD00zer/certi_changes_overtime/archive/refs/heads/main.zip"
set "TEMP_ZIP=%TEMP%\certi_update_%RANDOM%.zip"
set "TEMP_EXTRACT=%TEMP%\certi_unpacked_%RANDOM%"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$ProgressPreference = 'SilentlyContinue';" ^
    "try {" ^
    "    Write-Host '[*] Connecting and downloading update package...' -ForegroundColor Cyan;" ^
    "    Invoke-WebRequest -Uri '%REPO_ZIP%' -OutFile '%TEMP_ZIP%' -TimeoutSec 40;" ^
    "    if (-not (Test-Path '%TEMP_ZIP%')) { exit 1; }" ^
    "    Write-Host '[*] Extracting and applying extension files...' -ForegroundColor Yellow;" ^
    "    Expand-Archive -Path '%TEMP_ZIP%' -DestinationPath '%TEMP_EXTRACT%' -Force;" ^
    "    $rootFolder = Get-ChildItem -Path '%TEMP_EXTRACT%' | Select-Object -First 1;" ^
    "    $srcExt = Join-Path $rootFolder.FullName 'extension';" ^
    "    if (Test-Path $srcExt) {" ^
    "        Copy-Item -Path \"$srcExt\*\" -Destination '%~dp0extension' -Recurse -Force;" ^
    "    }" ^
    "    Remove-Item -Path '%TEMP_EXTRACT%' -Recurse -Force -ErrorAction SilentlyContinue;" ^
    "    Remove-Item -Path '%TEMP_ZIP%' -Force -ErrorAction SilentlyContinue;" ^
    "    Write-Host '[OK] Update completed successfully!' -ForegroundColor Green;" ^
    "} catch {" ^
    "    Write-Host '[!] Download failed: ' $_.Exception.Message -ForegroundColor Red;" ^
    "    exit 1;" ^
    "}"

if %ERRORLEVEL% equ 0 (
    echo.
    echo ======================================================================
    echo   [SUCCESS] Extension files downloaded and updated successfully!
    echo ======================================================================
) else (
    echo.
    echo ======================================================================
    echo   [ERROR] Update failed. Please check your internet connection.
    echo ======================================================================
    echo.
    pause
    exit /b 1
)

:launch_prompt
echo.
echo Available options:
echo   [1] Launch Chrome with updated extension now (Press 1 or Enter)
echo   [2] Exit and close window (Press 2)
echo.

set "ACTION_CHOICE=1"
set /p ACTION_CHOICE="Select option [1/2] (Default 1): "
if "%ACTION_CHOICE%"=="2" (
    echo Finished successfully.
    timeout /t 2 > nul
    exit /b 0
)

if exist "%~dp0Launch_Chrome_With_Extension.bat" (
    start "" "%~dp0Launch_Chrome_With_Extension.bat"
)
exit /b 0
