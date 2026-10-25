@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ===============================================
echo   IES - SISTEMA DE ASISTENCIA LOCAL
echo ===============================================
echo.

if not exist "attendance_api-real\attendance_api\python_deps" (
  echo Faltan las dependencias de Python.
  echo Ejecuta primero INSTALAR_SISTEMA.bat
  pause
  exit /b 1
)
if not exist "ies-registroAsistencia-api-real\ies-registroAsistencia\node_modules" (
  echo Faltan dependencias de React.
  echo Ejecuta primero INSTALAR_SISTEMA.bat
  pause
  exit /b 1
)
if not exist "ies-administrativo\node_modules" (
  echo Faltan dependencias de Administracion.
  echo Ejecuta primero INSTALAR_SISTEMA.bat
  pause
  exit /b 1
)

for /f "delims=" %%A in ('powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | Select-Object -First 1 -ExpandProperty IPAddress)"') do set "IP_LOCAL=%%A"

set "PYTHONPATH=%~dp0attendance_api-real\attendance_api\python_deps;%~dp0attendance_api-real\attendance_api"

echo Iniciando API en el puerto 8000...
start "IES - API FastAPI" /D "%~dp0attendance_api-real\attendance_api" cmd /k "set PYTHONPATH=%PYTHONPATH%&& python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"

timeout /t 2 /nobreak >nul

echo Iniciando Registro de Asistencia en el puerto 5174...
start "IES - Registro de Asistencia" /D "%~dp0ies-registroAsistencia-api-real\ies-registroAsistencia" cmd /k "npm run dev -- --host 0.0.0.0"

echo Iniciando Administracion en el puerto 5173...
start "IES - Administracion" /D "%~dp0ies-administrativo" cmd /k "npm run dev -- --host 0.0.0.0"

timeout /t 4 /nobreak >nul

echo.
echo ===============================================
echo   SISTEMA INICIADO
echo.
echo   Administracion: http://localhost:5173
echo   Asistencia:     http://localhost:5174
echo   API:            http://localhost:8000
echo   Swagger:        http://localhost:8000/docs
echo.
if not "%IP_LOCAL%"=="" echo   Para otros dispositivos de la red:
echo   Administracion: http://%IP_LOCAL%:5173
echo   Asistencia:     http://%IP_LOCAL%:5174
echo   API:            http://%IP_LOCAL%:8000
echo.
echo   NO cierres las 3 ventanas negras mientras uses el sistema.
echo ===============================================
echo.
start "" http://localhost:5173
start "" http://localhost:5174
pause
