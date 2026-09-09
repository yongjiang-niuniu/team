@echo off
setlocal

where py >nul 2>nul
if %errorlevel% equ 0 (
  py -3 "%~dp0start_public_demo.py"
) else (
  where python >nul 2>nul
  if errorlevel 1 (
    echo Python 3 was not found.
    echo Install Python 3.11+ from https://www.python.org/downloads/ and tick "Add python.exe to PATH".
    echo Node.js 20+ and ngrok are also required for the public demo launcher.
    pause
    exit /b 1
  )
  python "%~dp0start_public_demo.py"
)
if errorlevel 1 (
  echo Public demo launcher failed.
  pause
  exit /b 1
)
