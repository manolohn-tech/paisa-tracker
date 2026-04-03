@echo off
title Paisa AI Expense Tracker
color 0A
echo.
echo  ========================================
echo   PAISA AI - Student Expense Tracker
echo  ========================================
echo.
echo  Starting server...
echo  Open Chrome at: http://localhost:8080
echo.

python --version >nul 2>&1
if %errorlevel% neq 0 (
    python3 --version >nul 2>&1
    if %errorlevel% neq 0 (
        echo  ERROR: Python not found!
        echo  Install from: https://python.org
        echo  Check "Add to PATH" during install.
        pause & exit /b 1
    )
    set PYTHON=python3
) else (
    set PYTHON=python
)

ping -n 2 127.0.0.1 >nul
start "" "http://localhost:8080"

%PYTHON% server.py
pause
