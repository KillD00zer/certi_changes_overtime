@echo off
setlocal EnableExtensions
chcp 65001 > nul
title Google Earth Cadastral Survey - GitHub System Updater
cls
cd /d "%~dp0"

echo ======================================================================
echo   Google Earth Cadastral Survey - GitHub System Updater
echo   Cadastral Survey and Spatial Changes Suite - Field Updater
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
    echo [ERROR] Git is not installed or not found in system PATH.
    echo Please install Git from: https://git-scm.com/
    echo.
    pause
    exit /b 1
)

echo [1/3] Connecting to GitHub repository and checking for updates...
git fetch origin main >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [WARNING] Unable to connect to GitHub. Please check your internet connection.
    echo.
    pause
    exit /b 1
)

set "LOCAL_HASH="
set "REMOTE_HASH="
for /f %%a in ('git rev-parse --short HEAD') do set "LOCAL_HASH=%%a"
for /f %%a in ('git rev-parse --short origin/main') do set "REMOTE_HASH=%%a"

echo [2/3] Current installed version: [%LOCAL_HASH%]
echo       Latest GitHub version:     [%REMOTE_HASH%]
echo.

if "%LOCAL_HASH%"=="%REMOTE_HASH%" (
    echo ======================================================================
    echo   System is up to date with the latest official release: %LOCAL_HASH%
    echo ======================================================================
    echo.
    pause
    exit /b 0
)

echo ======================================================================
echo   New update available. Change log:
echo ======================================================================
echo.
git log HEAD..origin/main --pretty=format:"* %%s [%%h] (%%cr)"
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
    echo [NOTE] Local modifications detected. Stashing changes (git stash) and retrying pull...
    git stash >nul 2>&1
    git pull origin main
)

if %ERRORLEVEL% neq 0 (
    echo [NOTE] Cleaning conflicting files (git checkout -- .) and retrying pull...
    git checkout -- . >nul 2>&1
    git pull origin main
)

if %ERRORLEVEL% equ 0 (
    echo.
    echo ======================================================================
    echo   [SUCCESS] System updated successfully to the latest version.
    echo   Please reload the extension in Chrome to use the new features.
    echo ======================================================================
) else (
    echo.
    echo [ERROR] Automatic update could not be completed. Please check the error messages above.
)

echo.
pause
