@echo off
setlocal
set ROOT=%~dp0..

if not exist "%ROOT%\.venv\Scripts\python.exe" goto create_venv
goto skip_create

:create_venv
echo Creating venv at "%ROOT%\.venv"
python -m venv "%ROOT%\.venv"

:skip_create

call "%ROOT%\.venv\Scripts\activate.bat"
python -m pip install --upgrade pip
python -m pip install -r "%~dp0requirements.txt"

endlocal
