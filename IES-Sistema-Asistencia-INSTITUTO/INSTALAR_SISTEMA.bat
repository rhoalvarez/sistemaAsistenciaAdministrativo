@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ===============================================
echo   IES - INSTALACION DEL SISTEMA LOCAL
echo ===============================================
echo.

where python >nul 2>&1
if errorlevel 1 (
  echo ERROR: No se encontro Python.
  echo Instala Python 3.11 o superior y volve a ejecutar este archivo.
  pause
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: No se encontro Node.js.
  echo Instala Node.js 20.19+ o 22.12+ y volve a ejecutar este archivo.
  pause
  exit /b 1
)

python -m pip --version >nul 2>&1
if errorlevel 1 (
  echo ERROR: Python esta instalado pero pip no esta disponible.
  echo Repara la instalacion de Python y asegurate de habilitar pip.
  pause
  exit /b 1
)

echo [1/3] Instalando dependencias de Python...
if exist "attendance_api-real\attendance_api\python_deps" rmdir /s /q "attendance_api-real\attendance_api\python_deps"
mkdir "attendance_api-real\attendance_api\python_deps" >nul 2>&1
python -m pip install --disable-pip-version-check --no-warn-script-location --upgrade --target "attendance_api-real\attendance_api\python_deps" -r "attendance_api-real\attendance_api\requirements.txt"
if errorlevel 1 goto :error

echo [2/3] Instalando dependencias de Registro de Asistencia...
call npm --prefix "ies-registroAsistencia-api-real\ies-registroAsistencia" install
if errorlevel 1 goto :error

echo [3/3] Instalando dependencias de Administracion...
call npm --prefix "ies-administrativo" install
if errorlevel 1 goto :error

echo.
echo ===============================================
echo   INSTALACION TERMINADA CORRECTAMENTE
echo ===============================================
echo Ahora ejecuta INICIAR_SISTEMA.bat
pause
exit /b 0

:error
echo.
echo ERROR durante la instalacion.
echo Revisá el mensaje anterior para identificar la dependencia que fallo.
pause
exit /b 1
