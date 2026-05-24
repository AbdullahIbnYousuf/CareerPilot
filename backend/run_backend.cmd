@echo off
setlocal
set ROOT=%~dp0..

if exist "%ROOT%\.venv\Scripts\python.exe" goto use_root_venv
if exist "%~dp0venv\Scripts\python.exe" goto use_local_venv
echo No venv found. Run setup_backend.cmd first.
exit /b 1

:use_root_venv
set PY="%ROOT%\.venv\Scripts\python.exe"
goto got_py

:use_local_venv
set PY="%~dp0venv\Scripts\python.exe"
goto got_py

:got_py

cd /d "%~dp0"
%PY% -m uvicorn app.main:app --reload

endlocal
