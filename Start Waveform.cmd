@echo off
cd /d "%~dp0"
if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"
where npm >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 24 LTS, or use the Windows EXE installer instead.
  pause
  exit /b 1
)
if not exist node_modules\electron\package.json (
  call npm ci
  if errorlevel 1 goto failed
)
call node node_modules/electron/install.js
if errorlevel 1 goto failed
call npm run build
if errorlevel 1 goto failed
call npm start
if errorlevel 1 goto failed
exit /b 0
:failed
echo Waveform could not start. See the error above.
pause
exit /b 1
