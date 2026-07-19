@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

set "PORTABLE_DIR=%~dp0"
if exist "%PORTABLE_DIR%CAOS-VTT.exe" goto launch

set "PORTABLE_DIR="
set "CAOS_LAUNCHER_ROOT=%~dp0"
for /f "usebackq delims=" %%D in (`powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$artifactRoot=Join-Path $env:CAOS_LAUNCHER_ROOT 'server\.artifacts'; if (Test-Path -LiteralPath $artifactRoot -PathType Container) { Get-ChildItem -LiteralPath $artifactRoot -Directory | Where-Object { $_.Name -eq 'portable' -or $_.Name -like 'portable-*' } | Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'CAOS-VTT\CAOS-VTT.exe') -PathType Leaf } | Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName }"`) do set "PORTABLE_DIR=%%D\CAOS-VTT\"
set "CAOS_LAUNCHER_ROOT="
if defined PORTABLE_DIR if exist "%PORTABLE_DIR%CAOS-VTT.exe" goto launch

echo A versao portatil compilada nao foi encontrada.
echo Gere-a primeiro com:
echo powershell -ExecutionPolicy Bypass -File .\scripts\build-portable.ps1 -CampaignRoot "F:\RPG\mnemosyne\projeto-mnemosyne-rpg"
pause
exit /b 1

:launch
pushd "%PORTABLE_DIR%"
"CAOS-VTT.exe" %*
set "exitCode=%ERRORLEVEL%"
popd

if not "%exitCode%"=="0" (
    echo.
    echo A versao portatil terminou com erro. Leia a mensagem acima antes de fechar.
    pause
)

exit /b %exitCode%
