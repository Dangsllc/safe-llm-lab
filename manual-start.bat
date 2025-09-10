@echo off
echo Manual Vite Server Start
echo ========================

REM Kill any existing Node processes on port 5173
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173') do taskkill /F /PID %%a 2>nul

echo Starting Vite development server...
echo.

REM Try multiple methods to start the server
echo Method 1: Direct vite execution
node node_modules\vite\bin\vite.js --host 0.0.0.0 --port 5173

if %errorlevel% neq 0 (
    echo.
    echo Method 2: NPX vite
    npx vite --host 0.0.0.0 --port 5173
)

if %errorlevel% neq 0 (
    echo.
    echo Method 3: Vite binary
    .\node_modules\.bin\vite --host 0.0.0.0 --port 5173
)

pause
