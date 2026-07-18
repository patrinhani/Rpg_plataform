[CmdletBinding()]
param(
    [ValidateRange(1, 65535)]
    [int]$Port = 8765,

    [string]$HostToken = '',

    [string]$AllowedOrigins = '',

    [string]$CampaignManifest = '',

    [string]$CampaignRoot = '',

    [string]$FirebaseProjectId = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Read-FirebaseProjectIdFromDotEnv {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return ''
    }

    $values = @()
    foreach ($line in [IO.File]::ReadAllLines($Path)) {
        $trimmedLine = $line.Trim()
        if ([string]::IsNullOrWhiteSpace($trimmedLine) -or $trimmedLine.StartsWith('#')) {
            continue
        }
        if ($line -match '^\s*VITE_APP_PROJECT_ID\s*=\s*(.*?)\s*$') {
            $value = $Matches[1].Trim()
            if ($value.Length -ge 2) {
                $first = $value[0]
                $last = $value[$value.Length - 1]
                if (($first -eq '"' -and $last -eq '"') -or ($first -eq "'" -and $last -eq "'")) {
                    $value = $value.Substring(1, $value.Length - 2)
                }
            }
            $values += $value
        }
    }
    if ($values.Count -gt 1) {
        throw "O arquivo '$Path' define VITE_APP_PROJECT_ID mais de uma vez."
    }
    if ($values.Count -eq 0) {
        return ''
    }
    return [string]$values[0]
}

function Assert-FirebaseProjectId {
    param([Parameter(Mandatory = $true)][string]$Value)

    if ($Value -notmatch '^[a-z][a-z0-9-]{4,28}[a-z0-9]$') {
        throw 'FirebaseProjectId invalido. Informe somente o project ID publico do Firebase.'
    }
}

function Assert-LoopbackPortAvailable {
    param([Parameter(Mandatory = $true)][int]$Value)

    $listener = $null
    try {
        $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $Value)
        $listener.Server.ExclusiveAddressUse = $true
        $listener.Start()
    }
    catch [Net.Sockets.SocketException] {
        throw (
            "A porta $Value ja esta em uso. Feche o servidor anterior ou execute novamente " +
            ".\scripts\start-backend.ps1 -Port 8766. Nenhum processo foi encerrado automaticamente."
        )
    }
    finally {
        if ($null -ne $listener) {
            $listener.Stop()
        }
    }
}

try {
    $repoRoot = Split-Path -Parent $PSScriptRoot
    $venvPython = Join-Path (Join-Path (Join-Path $repoRoot '.venv-vtt') 'Scripts') 'python.exe'
    $serverDirectory = Join-Path $repoRoot 'server'

    if (-not (Test-Path -LiteralPath $venvPython -PathType Leaf)) {
        throw "O ambiente .venv-vtt nao foi encontrado. Execute primeiro .\scripts\bootstrap-dev.ps1."
    }
    if (-not (Test-Path -LiteralPath $serverDirectory -PathType Container)) {
        throw "A pasta do backend nao foi encontrada em '$serverDirectory'."
    }

    $entrypoint = Join-Path (Join-Path $serverDirectory 'caos_vtt') '__main__.py'
    if (-not (Test-Path -LiteralPath $entrypoint -PathType Leaf)) {
        throw "O entrypoint do backend nao foi encontrado em '$entrypoint'."
    }

    Assert-LoopbackPortAvailable -Value $Port

    if ([string]::IsNullOrWhiteSpace($FirebaseProjectId)) {
        $FirebaseProjectId = $env:CAOS_VTT_FIREBASE_PROJECT_ID
    }
    if ([string]::IsNullOrWhiteSpace($FirebaseProjectId)) {
        $dotEnvPath = Join-Path $repoRoot '.env.local'
        $FirebaseProjectId = Read-FirebaseProjectIdFromDotEnv -Path $dotEnvPath
    }
    if ([string]::IsNullOrWhiteSpace($FirebaseProjectId)) {
        Remove-Item Env:CAOS_VTT_FIREBASE_PROJECT_ID -ErrorAction SilentlyContinue
    }
    else {
        $FirebaseProjectId = $FirebaseProjectId.Trim()
        Assert-FirebaseProjectId -Value $FirebaseProjectId
        $env:CAOS_VTT_FIREBASE_PROJECT_ID = $FirebaseProjectId
    }

    if ([string]::IsNullOrWhiteSpace($HostToken)) {
        $HostToken = $env:CAOS_VTT_HOST_TOKEN
    }
    $generatedHostToken = [string]::IsNullOrWhiteSpace($HostToken)
    if ($generatedHostToken) {
        $randomBytes = New-Object byte[] 32
        $random = [Security.Cryptography.RandomNumberGenerator]::Create()
        try {
            $random.GetBytes($randomBytes)
        }
        finally {
            $random.Dispose()
        }
        $HostToken = [Convert]::ToBase64String($randomBytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
    }

    if ([string]::IsNullOrWhiteSpace($AllowedOrigins)) {
        $AllowedOrigins = $env:CAOS_VTT_ALLOWED_ORIGINS
    }
    if ([string]::IsNullOrWhiteSpace($AllowedOrigins)) {
        $AllowedOrigins = 'http://localhost:5173,http://127.0.0.1:5173'
    }

    if ([string]::IsNullOrWhiteSpace($CampaignManifest)) {
        $CampaignManifest = $env:CAOS_VTT_CAMPAIGN_MANIFEST
    }
    if ([string]::IsNullOrWhiteSpace($CampaignRoot)) {
        $CampaignRoot = $env:CAOS_VTT_CAMPAIGN_ROOT
    }
    if ([string]::IsNullOrWhiteSpace($CampaignManifest) -ne [string]::IsNullOrWhiteSpace($CampaignRoot)) {
        throw 'CampaignManifest e CampaignRoot precisam ser informados juntos.'
    }
    if (-not [string]::IsNullOrWhiteSpace($CampaignManifest)) {
        if (-not (Test-Path -LiteralPath $CampaignManifest -PathType Leaf)) {
            throw "CampaignManifest nao aponta para um arquivo: '$CampaignManifest'."
        }
        if (-not (Test-Path -LiteralPath $CampaignRoot -PathType Container)) {
            throw "CampaignRoot nao aponta para uma pasta: '$CampaignRoot'."
        }
        $env:CAOS_VTT_CAMPAIGN_MANIFEST = (Resolve-Path -LiteralPath $CampaignManifest).Path
        $env:CAOS_VTT_CAMPAIGN_ROOT = (Resolve-Path -LiteralPath $CampaignRoot).Path
    }
    else {
        Remove-Item Env:CAOS_VTT_CAMPAIGN_MANIFEST -ErrorAction SilentlyContinue
        Remove-Item Env:CAOS_VTT_CAMPAIGN_ROOT -ErrorAction SilentlyContinue
    }

    $env:CAOS_VTT_HOST_TOKEN = $HostToken
    $env:CAOS_VTT_ALLOWED_ORIGINS = $AllowedOrigins
    $env:CAOS_VTT_PORT = $Port.ToString()
    Write-Host "Iniciando backend C.A.O.S na porta $Port" -ForegroundColor Cyan
    Write-Host 'Entrypoint: python -m caos_vtt'
    Write-Host "Origens permitidas: $AllowedOrigins"
    if (-not [string]::IsNullOrWhiteSpace($CampaignManifest)) {
        Write-Host "Campanha: $CampaignManifest" -ForegroundColor Green
    }
    if (-not [string]::IsNullOrWhiteSpace($FirebaseProjectId)) {
        Write-Host "Acesso autenticado da Mesa: ativo (Firebase $FirebaseProjectId)" -ForegroundColor Green
    }
    else {
        Write-Host 'Acesso autenticado da Mesa: desativado; o fluxo manual isolado continua disponivel.' -ForegroundColor Yellow
    }
    if ($generatedHostToken) {
        Write-Host "Host token temporario de fallback: $HostToken" -ForegroundColor Yellow
        Write-Host 'Use-o somente no VTT isolado; pela Mesa autenticada ele nao e necessario.' -ForegroundColor Yellow
    }
    Write-Host 'Pressione Ctrl+C para encerrar.'

    Push-Location $serverDirectory
    try {
        & $venvPython -m caos_vtt
        if ($LASTEXITCODE -ne 0) {
            throw "O backend encerrou com codigo $LASTEXITCODE. Confira a mensagem acima."
        }
    }
    finally {
        Pop-Location
    }
}
catch {
    Write-Host "Nao foi possivel iniciar o backend: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
