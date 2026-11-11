@echo off
chcp 65001 >nul
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install the LTS version from https://nodejs.org and run this file again.
  pause
  exit /b 1
)
call npm install
if errorlevel 1 ( echo npm install failed & pause & exit /b 1 )
call npm run dist
if errorlevel 1 ( echo build failed & pause & exit /b 1 )
echo.
echo Done. The installer is in the dist folder.
explorer dist
pause
