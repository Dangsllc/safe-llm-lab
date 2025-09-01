@echo off
echo Starting Safe LLM Lab Development Server...
echo.

REM Check if Node.js is available
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js not found in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if npm is available
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: npm not found in PATH
    pause
    exit /b 1
)

echo Node.js and npm are available
echo.

REM Navigate to project directory
cd /d "%~dp0"

REM Install dependencies if node_modules doesn't exist
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install dependencies
        pause
        exit /b 1
    )
)

echo Starting Vite development server...
echo Open http://localhost:5173 in your browser
echo Press Ctrl+C to stop the server
echo.

REM Start the development server
npm run dev

pause
