@echo off
echo Full App Startup Testing Script
echo ===============================

echo Step 1: Running comprehensive diagnostic...
node debug-full-app.js

echo.
echo Step 2: Testing Vite startup with error capture...
echo Starting Vite server to capture startup errors...

REM Create error log file
echo. > vite-startup-errors.log

REM Start Vite and capture both stdout and stderr
npm run dev > vite-startup-output.log 2> vite-startup-errors.log

echo.
echo Step 3: Check log files for detailed error information
echo - vite-startup-output.log: Standard output
echo - vite-startup-errors.log: Error messages
echo - debug-full-app.log: Diagnostic log
echo - full-app-diagnostic-report.json: Structured report

pause
