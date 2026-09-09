@echo off
setlocal

set "PORT=5050"
set "LISTENER_PID="
for /f %%p in ('powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess"') do set "LISTENER_PID=%%p"
if defined LISTENER_PID (
  echo Backend already listening on %PORT% ^(PID: %LISTENER_PID%^). Skipping duplicate start.
  exit /b 0
)

cd /d "%~dp0..\backend"
set "FLASK_DEBUG=0"
"%~dp0..\backend\.venv\Scripts\python.exe" -m flask --app wsgi run --host 127.0.0.1 --port 5050 --no-debugger --no-reload
