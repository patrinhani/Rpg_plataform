@echo off
chcp 65001 >nul
cd /d "%~dp0"

"CAOS-VTT.exe" --tunnel %*
set "exitCode=%ERRORLEVEL%"

if not "%exitCode%"=="0" (
    echo.
    echo O modo online terminou com erro. Leia a mensagem acima antes de fechar.
    pause
)

exit /b %exitCode%
