@echo off
setlocal

set "PORT=5173"
set "LISTENER_PID="
for /f %%p in ('powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess"') do set "LISTENER_PID=%%p"
if defined LISTENER_PID (
  echo Frontend already listening on %PORT% ^(PID: %LISTENER_PID%^). Skipping duplicate start.
  exit /b 0
)

cd /d "%~dp0..\frontend"
"%ProgramFiles%\nodejs\node.exe" node_modules\vite\bin\vite.js --host 127.0.0.1 --port 5173
