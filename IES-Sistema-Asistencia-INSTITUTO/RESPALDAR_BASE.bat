@echo off
setlocal
cd /d "%~dp0"
if not exist "backups" mkdir "backups"
for /f "tokens=1-3 delims=/" %%a in ('date /t') do set FECHA=%%c-%%b-%%a
for /f "tokens=1-2 delims=:" %%a in ('time /t') do set HORA=%%a-%%b
set HORA=%HORA: =%
copy /Y "attendance_api-real\attendance_api\asistencia.db" "backups\asistencia_%FECHA%_%HORA%.db" >nul
if errorlevel 1 (
  echo No se pudo realizar el respaldo.
) else (
  echo Respaldo realizado correctamente en la carpeta backups.
)
pause
