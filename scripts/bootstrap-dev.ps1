[CmdletBinding()]
param(
    [switch]$SkipFrontend
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Step {
    param([Parameter(Mandatory = $true)][string]$Message)
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Fail {
    param([Parameter(Mandatory = $true)][string]$Message)
    throw $Message
}

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [Parameter(Mandatory = $true)][string]$FailureMessage
    )

    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        Fail "$FailureMessage (codigo de saida: $LASTEXITCODE)."
    }
}

function Resolve-PythonCommand {
    $candidates = @(
        @{ Name = 'py'; Prefix = @('-3') },
        @{ Name = 'python'; Prefix = @() },
        @{ Name = 'python3'; Prefix = @() }
    )

    foreach ($candidate in $candidates) {
        $command = Get-Command $candidate.Name -ErrorAction SilentlyContinue
        if (-not $command) { continue }

        $versionArguments = @($candidate.Prefix) + @('--version')
        $versionOutput = & $command.Source @versionArguments 2>&1
        $versionExitCode = $LASTEXITCODE
        $versionText = (($versionOutput | Select-Object -First 1) -replace '^Python\s+', '').Trim()
        if ($versionExitCode -eq 0 -and $versionText) {
            return @{
                FilePath = $command.Source
                Prefix = [string[]]$candidate.Prefix
                Version = [version]$versionText
            }
        }
    }

    return $null
}

try {
    $repoRoot = Split-Path -Parent $PSScriptRoot
    $packageLock = Join-Path $repoRoot 'package-lock.json'
    $serverDirectory = Join-Path $repoRoot 'server'
    $requirements = Join-Path $serverDirectory 'requirements.txt'
    $requirementsDev = Join-Path $serverDirectory 'requirements-dev.txt'
    $venvPath = Join-Path $repoRoot '.venv-vtt'
    $venvPython = Join-Path (Join-Path $venvPath 'Scripts') 'python.exe'

    Write-Step 'Validando arquivos do projeto'
    if (-not (Test-Path -LiteralPath $packageLock -PathType Leaf)) {
        Fail "package-lock.json nao foi encontrado em '$repoRoot'. Execute este script dentro do repositorio completo."
    }
    if (-not (Test-Path -LiteralPath $requirements -PathType Leaf)) {
        Fail "As dependencias do backend nao foram encontradas em '$requirements'. Confirme que a pasta server foi obtida antes de continuar."
    }
    if (-not (Test-Path -LiteralPath $requirementsDev -PathType Leaf)) {
        Fail "As dependencias de desenvolvimento do backend nao foram encontradas em '$requirementsDev'. Confirme que a pasta server foi obtida antes de continuar."
    }

    Write-Step 'Validando Node.js e npm'
    $nodeCommand = Get-Command 'node' -ErrorAction SilentlyContinue
    $npmCommand = Get-Command 'npm' -ErrorAction SilentlyContinue
    if (-not $nodeCommand) {
        Fail 'Node.js nao foi encontrado no PATH. Instale uma versao LTS compativel (20.19+, 22.12+ ou superior) e abra um novo terminal.'
    }
    if (-not $npmCommand) {
        Fail 'npm nao foi encontrado no PATH. Reinstale o Node.js com o npm habilitado e abra um novo terminal.'
    }

    $nodeVersionOutput = & $nodeCommand.Source --version 2>&1
    $nodeVersionExitCode = $LASTEXITCODE
    $nodeVersionText = $nodeVersionOutput | Select-Object -First 1
    if ($nodeVersionExitCode -ne 0 -or -not $nodeVersionText) {
        Fail 'Node.js foi localizado, mas nao respondeu ao comando de versao.'
    }

    $nodeVersion = [version]$nodeVersionText.Trim().TrimStart('v')
    $nodeSupported = (
        ($nodeVersion.Major -eq 20 -and $nodeVersion -ge [version]'20.19.0') -or
        ($nodeVersion.Major -eq 22 -and $nodeVersion -ge [version]'22.12.0') -or
        ($nodeVersion.Major -gt 22)
    )
    if (-not $nodeSupported) {
        Fail "Node.js $nodeVersion nao e compativel com o Vite deste projeto. Use Node 20.19+, 22.12+ ou uma versao LTS superior."
    }
    Write-Host "Node.js $nodeVersion e npm encontrados." -ForegroundColor Green

    Write-Step 'Validando Python'
    $python = Resolve-PythonCommand
    if (-not $python) {
        Fail 'Python 3 nao foi encontrado. Instale Python 3.10 ou superior para o seu usuario; nao e necessario executar como administrador.'
    }
    if ($python.Version -lt [version]'3.10.0') {
        Fail "Python $($python.Version) e antigo demais. Instale Python 3.10 ou superior e abra um novo terminal."
    }
    Write-Host "Python $($python.Version) encontrado em '$($python.FilePath)'." -ForegroundColor Green

    if ($SkipFrontend) {
        Write-Step 'Reutilizando dependencias existentes do frontend'
        $vitePackage = Join-Path $repoRoot 'node_modules\vite\package.json'
        if (-not (Test-Path -LiteralPath $vitePackage -PathType Leaf)) {
            Fail 'O parametro -SkipFrontend foi usado, mas node_modules nao esta preparado. Execute novamente sem esse parametro.'
        }
    }
    else {
        Write-Step 'Instalando dependencias do frontend com npm ci'
        Push-Location $repoRoot
        try {
            Invoke-Checked `
                -FilePath $npmCommand.Source `
                -Arguments @('ci') `
                -FailureMessage 'npm ci falhou. Feche servidores Vite/Node que estejam usando node_modules e tente novamente'
        }
        finally {
            Pop-Location
        }
    }

    Write-Step 'Preparando ambiente virtual do backend'
    if (Test-Path -LiteralPath $venvPath) {
        if (-not (Test-Path -LiteralPath $venvPython -PathType Leaf)) {
            Fail "A pasta '$venvPath' existe, mas nao contem um ambiente virtual valido. Renomeie ou remova essa pasta manualmente e execute o bootstrap novamente."
        }
        Write-Host "Ambiente virtual existente sera reutilizado: $venvPath"
    }
    else {
        $venvArguments = @($python.Prefix) + @('-m', 'venv', $venvPath)
        Invoke-Checked -FilePath $python.FilePath -Arguments $venvArguments -FailureMessage 'Nao foi possivel criar .venv-vtt'
    }

    $venvVersionOutput = & $venvPython --version 2>&1
    $venvVersionExitCode = $LASTEXITCODE
    $venvVersionText = (($venvVersionOutput | Select-Object -First 1) -replace '^Python\s+', '').Trim()
    if ($venvVersionExitCode -ne 0 -or -not $venvVersionText) {
        Fail "O Python de '$venvPath' nao respondeu corretamente. Recrie o ambiente virtual e tente novamente."
    }
    $venvVersion = [version]$venvVersionText
    if ($venvVersion -lt [version]'3.10.0') {
        Fail "O ambiente virtual usa Python $venvVersion. Recrie .venv-vtt com Python 3.10 ou superior."
    }
    Write-Host "Ambiente virtual usando Python $venvVersion." -ForegroundColor Green

    Write-Step 'Instalando dependencias do backend'
    Invoke-Checked `
        -FilePath $venvPython `
        -Arguments @('-m', 'pip', 'install', '--disable-pip-version-check', '-r', $requirementsDev) `
        -FailureMessage 'A instalacao das dependencias Python de desenvolvimento falhou'

    Write-Host "`nAmbiente de desenvolvimento preparado com sucesso." -ForegroundColor Green
    Write-Host 'Abra dois terminais na raiz do projeto:'
    Write-Host '  Frontend: npm run dev'
    Write-Host '  Backend : powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-backend.ps1'
    Write-Host 'Frontend padrao: http://localhost:5173'
    Write-Host 'Backend padrao : http://127.0.0.1:8765'
}
catch {
    Write-Host "`nBootstrap interrompido: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
