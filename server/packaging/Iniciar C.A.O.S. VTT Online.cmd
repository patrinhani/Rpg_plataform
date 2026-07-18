@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

"CAOS-VTT.exe" --tunnel --public-origin-file "ORIGEM-WEB.txt" %*
set "exitCode=%ERRORLEVEL%"

if not "%exitCode%"=="0" (
    echo.
    echo O modo online terminou com erro. Leia a mensagem acima antes de fechar.
    pause
)

exit /b %exitCode%
