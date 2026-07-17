[CmdletBinding()]
param(
    [ValidateRange(1, 65535)]
    [int]$Port = 8765,

    [string]$HostToken = '',

    [string]$AllowedOrigins = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

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

    $env:CAOS_VTT_HOST_TOKEN = $HostToken
    $env:CAOS_VTT_ALLOWED_ORIGINS = $AllowedOrigins
    $env:CAOS_VTT_PORT = $Port.ToString()
    Write-Host "Iniciando backend C.A.O.S na porta $Port" -ForegroundColor Cyan
    Write-Host 'Entrypoint: python -m caos_vtt'
    Write-Host "Origens permitidas: $AllowedOrigins"
    if ($generatedHostToken) {
        Write-Host "Host token temporario: $HostToken" -ForegroundColor Yellow
        Write-Host 'Copie esse token para criar a sala. Ele nao foi salvo em disco.' -ForegroundColor Yellow
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
