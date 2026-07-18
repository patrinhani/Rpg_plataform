[CmdletBinding()]
param(
    [string]$CampaignRoot = 'F:\RPG\mnemosyne\projeto-mnemosyne-rpg'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$python = Join-Path $repoRoot '.venv-vtt\Scripts\python.exe'
$manifest = Join-Path $repoRoot 'tools\campaign_manifest\generated\mnemosyne.manifest.json'

if (-not (Test-Path -LiteralPath $python -PathType Leaf)) {
    throw 'Ambiente .venv-vtt ausente. Execute .\scripts\bootstrap-dev.ps1 primeiro.'
}
if (-not (Test-Path -LiteralPath $CampaignRoot -PathType Container)) {
    throw "Campanha nao encontrada em '$CampaignRoot'."
}

Push-Location $repoRoot
try {
    & $python -m tools.campaign_manifest.generate `
        --source $CampaignRoot `
        --output $manifest
    if ($LASTEXITCODE -ne 0) {
        throw 'Nao foi possivel regenerar o manifesto da campanha.'
    }

    & $python -m tools.campaign_pack `
        --manifest $manifest `
        --source-root $CampaignRoot `
        --check
    if ($LASTEXITCODE -ne 0) {
        throw 'O manifesto foi gerado, mas o pack seletivo nao passou na validacao.'
    }
}
finally {
    Pop-Location
}

Write-Host 'Manifesto atualizado e pack validado. Revise o diff antes do build:' -ForegroundColor Green
Write-Host 'git diff -- tools/campaign_manifest/generated/mnemosyne.manifest.json'
