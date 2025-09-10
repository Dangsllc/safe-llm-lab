@echo off
echo Safe LLM Lab - Lite Mode Server Start
echo =====================================

REM Kill any existing Node processes on port 5173
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173') do taskkill /F /PID %%a 2>nul

echo Starting Vite development server in lite mode...
echo This version runs without backend dependencies.
echo.

REM Temporarily rename main App.tsx and use lite version
if exist "src\App.tsx" (
    ren "src\App.tsx" "App-full.tsx"
)
if exist "src\App-lite.tsx" (
    copy "src\App-lite.tsx" "src\App.tsx"
)

echo Starting server...
npm run dev

REM Restore original App.tsx after server stops
if exist "src\App-full.tsx" (
    del "src\App.tsx"
    ren "src\App-full.tsx" "App.tsx"
)

pause
