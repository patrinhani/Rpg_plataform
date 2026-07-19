@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

set "CAMPAIGN_ROOT=F:\RPG\mnemosyne\projeto-mnemosyne-rpg"
if defined CAOS_VTT_CAMPAIGN_ROOT set "CAMPAIGN_ROOT=%CAOS_VTT_CAMPAIGN_ROOT%"

if not exist ".venv-vtt\Scripts\python.exe" (
    echo O ambiente Python do VTT nao foi preparado.
    echo Execute primeiro: powershell -ExecutionPolicy Bypass -File .\scripts\bootstrap-dev.ps1
    pause
    exit /b 1
)

if not exist "node_modules\vite\bin\vite.js" (
    echo As dependencias do frontend nao foram instaladas.
    echo Execute primeiro: npm install
    pause
    exit /b 1
)

if not exist "tools\campaign_manifest\generated\mnemosyne.manifest.json" (
    echo O manifesto da campanha nao foi encontrado.
    pause
    exit /b 1
)

if not exist "%CAMPAIGN_ROOT%\" (
    echo A campanha nao foi encontrada em:
    echo %CAMPAIGN_ROOT%
    echo Defina CAOS_VTT_CAMPAIGN_ROOT antes de abrir este arquivo se ela estiver em outro local.
    pause
    exit /b 1
)

if /I "%~1"=="--check" (
    pushd "%~dp0server"
    "%~dp0.venv-vtt\Scripts\python.exe" -c "import caos_vtt, fastapi, PIL, uvicorn"
    if errorlevel 1 (
        popd
        echo O backend ou uma dependencia Python nao pode ser importado.
        exit /b 1
    )
    popd
    echo Arquivos e dependencias obrigatorias encontrados. Portas e servicos serao validados ao iniciar.
    exit /b 0
)

echo Validando o backend em http://127.0.0.1:8765/ ...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "try { $health=Invoke-RestMethod -Uri 'http://127.0.0.1:8765/api/vtt/health' -TimeoutSec 2; if ($health.status -eq 'ok' -and $null -ne $health.protocolVersion) { exit 0 } } catch {}; exit 1"
if "%ERRORLEVEL%"=="0" (
    echo Backend C.A.O.S. ja esta ativo; reutilizando a instancia atual.
) else (
    echo Iniciando backend em uma nova janela...
    start "C.A.O.S. Backend" powershell.exe -NoExit -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-backend.ps1" -CampaignManifest "%~dp0tools\campaign_manifest\generated\mnemosyne.manifest.json" -CampaignRoot "%CAMPAIGN_ROOT%"
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$deadline=(Get-Date).AddSeconds(25); do { try { $health=Invoke-RestMethod -Uri 'http://127.0.0.1:8765/api/vtt/health' -TimeoutSec 1; if ($health.status -eq 'ok' -and $null -ne $health.protocolVersion) { exit 0 } } catch {}; Start-Sleep -Milliseconds 350 } while ((Get-Date) -lt $deadline); exit 1"
if not "%ERRORLEVEL%"=="0" (
    echo O backend C.A.O.S. nao respondeu na porta 8765. Confira a janela do backend.
    pause
    exit /b 1
)

echo Validando o frontend em http://localhost:5173/ ...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "try { $response=Invoke-WebRequest -Uri 'http://localhost:5173/' -UseBasicParsing -TimeoutSec 2; if ($response.StatusCode -lt 500 -and $response.Content -match '<title>\s*C\.A\.O\.S\s*</title>') { exit 0 } } catch {}; exit 1"
if "%ERRORLEVEL%"=="0" (
    echo Frontend C.A.O.S. ja esta ativo; reutilizando a instancia atual.
) else (
    echo Iniciando frontend em uma nova janela...
    start "C.A.O.S. Frontend" /D "%~dp0" cmd.exe /k "npm run dev -- --host 127.0.0.1 --port 5173 --strictPort"
)

echo Aguardando o frontend responder em http://localhost:5173/ ...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$deadline=(Get-Date).AddSeconds(25); do { try { $response=Invoke-WebRequest -Uri 'http://localhost:5173/' -UseBasicParsing -TimeoutSec 1; if ($response.StatusCode -lt 500 -and $response.Content -match '<title>\s*C\.A\.O\.S\s*</title>') { Start-Process 'http://localhost:5173/'; exit 0 } } catch {}; Start-Sleep -Milliseconds 350 } while ((Get-Date) -lt $deadline); exit 1"
if not "%ERRORLEVEL%"=="0" (
    echo O frontend C.A.O.S. nao respondeu na porta 5173. Confira a janela do frontend.
    pause
    exit /b 1
)

exit /b 0
