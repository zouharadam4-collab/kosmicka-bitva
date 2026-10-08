@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Nejdriv nainstaluj Node.js z https://nodejs.org  ^(verze LTS^) a spust me znovu.
  pause
  exit /b
)
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3000/host"
node server.js
pause
