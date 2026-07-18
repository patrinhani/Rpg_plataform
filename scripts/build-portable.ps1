[CmdletBinding()]
param(
    [switch]$SkipFrontendBuild,
    [switch]$SkipArchive,
    [switch]$SkipTunnel,
    [string]$CampaignRoot,
    [switch]$SkipCampaign,
    [ValidateRange(1, 2147483647)]
    [long]$MaxCampaignBytes = 536870912
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Step {
    param([Parameter(Mandatory = $true)][string]$Message)
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [Parameter(Mandatory = $true)][string]$FailureMessage
    )

    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$FailureMessage (codigo de saida: $LASTEXITCODE)."
    }
}

function Remove-SafeTreeItem {
    param([Parameter(Mandatory = $true)][System.IO.FileSystemInfo]$Item)

    if (($Item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        # Remove somente o link/junction; nunca percorra seu destino.
        Remove-Item -LiteralPath $Item.FullName -Force
        return
    }

    if ($Item.PSIsContainer) {
        foreach ($child in @(Get-ChildItem -LiteralPath $Item.FullName -Force)) {
            Remove-SafeTreeItem -Item $child
        }
    }
    Remove-Item -LiteralPath $Item.FullName -Force
}

function Remove-SafeDirectory {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$ExpectedParent
    )

    $resolvedPath = [IO.Path]::GetFullPath($Path)
    $resolvedParent = [IO.Path]::GetFullPath($ExpectedParent).TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
    if (-not $resolvedPath.StartsWith($resolvedParent, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Remocao recusada fora da pasta de build: '$resolvedPath'."
    }
    if (Test-Path -LiteralPath $resolvedPath) {
        Remove-SafeTreeItem -Item (Get-Item -LiteralPath $resolvedPath -Force)
    }
}

function Copy-VerifiedTree {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Destination,
        [Parameter(Mandatory = $true)][string]$ExpectedDestinationParent
    )

    $resolvedSource = [IO.Path]::GetFullPath($Source)
    $resolvedDestination = [IO.Path]::GetFullPath($Destination)
    $resolvedParent = [IO.Path]::GetFullPath($ExpectedDestinationParent).TrimEnd('\', '/')
    $parentPrefix = $resolvedParent + [IO.Path]::DirectorySeparatorChar
    if (-not $resolvedDestination.StartsWith($parentPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Copia recusada fora da pasta de artefatos: '$resolvedDestination'."
    }
    if (-not (Test-Path -LiteralPath $resolvedSource -PathType Container)) {
        throw "Origem da copia verificada nao encontrada: '$resolvedSource'."
    }
    if (Test-Path -LiteralPath $resolvedDestination) {
        throw "Destino da copia verificada ja existe: '$resolvedDestination'."
    }

    $sourcePrefix = $resolvedSource.TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
    New-Item -ItemType Directory -Path $resolvedDestination | Out-Null
    try {
        foreach ($item in @(Get-ChildItem -LiteralPath $resolvedSource -Recurse -Force)) {
            if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw "Copia recusou link/junction em '$($item.FullName)'."
            }
            $relative = $item.FullName.Substring($sourcePrefix.Length)
            $target = Join-Path $resolvedDestination $relative
            if ($item.PSIsContainer) {
                New-Item -ItemType Directory -Path $target -Force | Out-Null
                continue
            }
            $targetParent = Split-Path -Parent $target
            New-Item -ItemType Directory -Path $targetParent -Force | Out-Null
            Copy-Item -LiteralPath $item.FullName -Destination $target
            $copied = Get-Item -LiteralPath $target
            if ($copied.Length -ne $item.Length) {
                throw "Tamanho divergiu ao copiar '$relative'."
            }
            $sourceHash = (Get-FileHash -LiteralPath $item.FullName -Algorithm SHA256).Hash
            $targetHash = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash
            if ($sourceHash -ne $targetHash) {
                throw "SHA-256 divergiu ao copiar '$relative'."
            }
        }
    }
    catch {
        if (Test-Path -LiteralPath $resolvedDestination) {
            Remove-SafeDirectory -Path $resolvedDestination -ExpectedParent $resolvedParent
        }
        throw
    }
}

function Assert-RealPathBelow {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$ExpectedParent
    )

    $resolvedPath = [IO.Path]::GetFullPath($Path)
    $parentWithoutSeparator = [IO.Path]::GetFullPath($ExpectedParent).TrimEnd('\', '/')
    $parentPrefix = $parentWithoutSeparator + [IO.Path]::DirectorySeparatorChar
    if (-not $resolvedPath.StartsWith($parentPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Caminho de build recusado fora da raiz esperada: '$resolvedPath'."
    }

    $parentItem = Get-Item -LiteralPath $parentWithoutSeparator -Force
    if (($parentItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Raiz de build nao pode ser link simbolico ou junction: '$parentWithoutSeparator'."
    }

    $relativePath = $resolvedPath.Substring($parentPrefix.Length)
    $currentPath = $parentWithoutSeparator
    foreach ($segment in @($relativePath -split '[\\/]')) {
        if ([string]::IsNullOrWhiteSpace($segment)) { continue }
        $currentPath = Join-Path $currentPath $segment
        if (-not (Test-Path -LiteralPath $currentPath)) { continue }
        $item = Get-Item -LiteralPath $currentPath -Force
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "Caminho de build nao pode atravessar link simbolico ou junction: '$currentPath'."
        }
    }
}

function Assert-FrontendBuildIsFresh {
    param(
        [Parameter(Mandatory = $true)][string]$RepoRoot,
        [Parameter(Mandatory = $true)][string]$FrontendDist
    )

    $sourceDirectory = Join-Path $RepoRoot 'src'
    $distIndex = Join-Path $FrontendDist 'index.html'
    if (-not (Test-Path -LiteralPath $sourceDirectory -PathType Container)) {
        throw "A pasta de fontes do frontend nao foi encontrada em '$sourceDirectory'."
    }
    if (-not (Test-Path -LiteralPath $distIndex -PathType Leaf)) {
        throw "O frontend compilado nao contem '$distIndex'."
    }

    $sourceFiles = @(Get-ChildItem -LiteralPath $sourceDirectory -Recurse -File)
    foreach ($requiredName in @('package.json', 'package-lock.json', 'vtt.html')) {
        $requiredPath = Join-Path $RepoRoot $requiredName
        if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
            throw "Arquivo necessario para validar o frontend nao encontrado: '$requiredPath'."
        }
        $sourceFiles += Get-Item -LiteralPath $requiredPath
    }

    $viteConfigs = @(
        Get-ChildItem -LiteralPath $RepoRoot -File |
            Where-Object { $_.Name -like 'vite.config.*' }
    )
    if ($viteConfigs.Count -eq 0) {
        throw "Nenhum arquivo vite.config.* foi encontrado em '$RepoRoot'."
    }
    $sourceFiles += $viteConfigs

    $publicDirectory = Join-Path $RepoRoot 'public'
    if (Test-Path -LiteralPath $publicDirectory -PathType Container) {
        $sourceFiles += @(Get-ChildItem -LiteralPath $publicDirectory -Recurse -File)
    }

    $latestSource = $sourceFiles | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
    if (-not $latestSource) {
        throw 'Nenhum arquivo-fonte foi encontrado para validar a atualidade do frontend.'
    }

    $distHtml = Get-Content -LiteralPath $distIndex -Raw
    $bundlePattern = '(?i)(?:src|href)=["'']/?(assets/[^"''?#]+\.(?:js|css))(?:[?#][^"'']*)?["'']'
    $bundleReferences = @(
        [regex]::Matches($distHtml, $bundlePattern) |
            ForEach-Object { $_.Groups[1].Value } |
            Sort-Object -Unique
    )
    if ($bundleReferences.Count -eq 0) {
        throw "O arquivo '$distIndex' nao referencia bundles JavaScript ou CSS do Vite. Recompile o frontend."
    }

    $distOutputs = @(Get-Item -LiteralPath $distIndex)
    foreach ($bundleReference in $bundleReferences) {
        $relativeBundlePath = $bundleReference.Replace('/', [IO.Path]::DirectorySeparatorChar)
        $bundlePath = Join-Path $FrontendDist $relativeBundlePath
        if (-not (Test-Path -LiteralPath $bundlePath -PathType Leaf)) {
            throw "Bundle referenciado por dist-vtt\index.html nao encontrado: '$bundlePath'. Recompile o frontend."
        }
        $distOutputs += Get-Item -LiteralPath $bundlePath
    }

    $oldestOutput = $distOutputs | Sort-Object LastWriteTimeUtc | Select-Object -First 1
    if ($oldestOutput.LastWriteTimeUtc -lt $latestSource.LastWriteTimeUtc) {
        $sourceTimestamp = $latestSource.LastWriteTimeUtc.ToString('yyyy-MM-dd HH:mm:ssZ')
        $outputTimestamp = $oldestOutput.LastWriteTimeUtc.ToString('yyyy-MM-dd HH:mm:ssZ')
        throw (
            "O dist-vtt esta obsoleto e nao pode ser reutilizado com -SkipFrontendBuild. " +
            "Fonte mais recente: '$($latestSource.FullName)' ($sourceTimestamp). " +
            "Artefato mais antigo: '$($oldestOutput.FullName)' ($outputTimestamp). " +
            "Execute novamente sem -SkipFrontendBuild para recompilar o frontend."
        )
    }
}

function Assert-VttFrontendIsIsolated {
    param([Parameter(Mandatory = $true)][string]$FrontendDist)

    $files = @(Get-ChildItem -LiteralPath $FrontendDist -Recurse -File)
    if ($files.Count -eq 0) {
        throw 'A build dedicada do VTT esta vazia.'
    }
    $totalBytes = ($files | Measure-Object -Property Length -Sum).Sum
    $maxFrontendBytes = 5MB
    if ($totalBytes -gt $maxFrontendBytes) {
        throw "A build dedicada do VTT possui $totalBytes bytes e excede o limite de $maxFrontendBytes bytes."
    }

    foreach ($script in @($files | Where-Object { $_.Extension -eq '.js' })) {
        $content = Get-Content -LiteralPath $script.FullName -Raw
        if ($content -match '(?i)firebase|firestore|bestiario') {
            throw "A build VTT isolada contem dependencia proibida em '$($script.Name)'."
        }
    }
    Write-Host "Frontend VTT isolado: $($files.Count) arquivos / $totalBytes bytes." -ForegroundColor Green
}

function Get-VerifiedCloudflared {
    param(
        [Parameter(Mandatory = $true)][string]$DownloadUrl,
        [Parameter(Mandatory = $true)][string]$CachePath,
        [Parameter(Mandatory = $true)][string]$ExpectedSha256
    )

    $expectedHash = $ExpectedSha256.Trim().ToLowerInvariant()
    if ($expectedHash -notmatch '^[a-f0-9]{64}$') {
        throw 'O SHA-256 esperado do cloudflared e invalido.'
    }

    $cacheDirectory = Split-Path -Parent $CachePath
    New-Item -ItemType Directory -Path $cacheDirectory -Force | Out-Null

    if (Test-Path -LiteralPath $CachePath -PathType Leaf) {
        $cachedHash = (Get-FileHash -LiteralPath $CachePath -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($cachedHash -eq $expectedHash) {
            Write-Host "cloudflared verificado no cache: $CachePath" -ForegroundColor Green
            return $CachePath
        }
        Write-Warning 'O cloudflared em cache possui hash incorreto e sera baixado novamente.'
        Remove-Item -LiteralPath $CachePath -Force
    }

    $temporaryPath = "$CachePath.download-$([guid]::NewGuid().ToString('N')).tmp"
    $previousProgressPreference = $ProgressPreference
    try {
        $ProgressPreference = 'SilentlyContinue'
        if ([enum]::GetNames([Net.SecurityProtocolType]) -contains 'Tls12') {
            [Net.ServicePointManager]::SecurityProtocol = (
                [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
            )
        }
        Write-Host "Baixando cloudflared oficial de $DownloadUrl"
        Invoke-WebRequest `
            -Uri $DownloadUrl `
            -OutFile $temporaryPath `
            -UseBasicParsing `
            -TimeoutSec 300 `
            -Headers @{ 'User-Agent' = 'CAOS-VTT-portable-builder' } |
            Out-Null

        $downloadedHash = (Get-FileHash -LiteralPath $temporaryPath -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($downloadedHash -ne $expectedHash) {
            throw (
                "SHA-256 do cloudflared baixado nao confere. " +
                "Esperado: $expectedHash; recebido: $downloadedHash. O arquivo nao sera usado."
            )
        }
        Move-Item -LiteralPath $temporaryPath -Destination $CachePath -Force
    }
    finally {
        $ProgressPreference = $previousProgressPreference
        Remove-Item -LiteralPath $temporaryPath -Force -ErrorAction SilentlyContinue
    }

    $finalHash = (Get-FileHash -LiteralPath $CachePath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($finalHash -ne $expectedHash) {
        throw 'O cloudflared mudou depois da verificacao e o build foi interrompido.'
    }
    Write-Host "cloudflared baixado e verificado: $CachePath" -ForegroundColor Green
    return $CachePath
}

$artifactRoot = $null
$stagingRoot = $null
$campaignPackTempRoot = $null
$systemTemp = $null
$buildLock = $null

try {
    $repoRoot = Split-Path -Parent $PSScriptRoot
    $serverDirectory = Join-Path $repoRoot 'server'
    $venvPython = Join-Path $repoRoot '.venv-vtt\Scripts\python.exe'
    $entrypoint = Join-Path $serverDirectory 'portable_entry.py'
    $frontendDist = Join-Path $repoRoot 'dist-vtt'
    $frontendIndex = Join-Path $frontendDist 'index.html'
    $launcherSource = Join-Path $serverDirectory 'packaging\Iniciar C.A.O.S. VTT.cmd'
    $onlineLauncherSource = Join-Path $serverDirectory 'packaging\Iniciar C.A.O.S. VTT Online.cmd'
    $webOriginConfigSource = Join-Path $serverDirectory 'packaging\ORIGEM-WEB.txt'
    $cloudflaredLicenseSource = Join-Path $serverDirectory 'packaging\cloudflared\LICENSE-cloudflared.txt'
    $cloudflaredNoticeSource = Join-Path $serverDirectory 'packaging\cloudflared\CLOUDFLARED-NOTICE.txt'
    $readmeSource = Join-Path $serverDirectory 'README-PORTABLE.md'
    $quickStartSource = Join-Path $serverDirectory 'packaging\LEIA-ME PRIMEIRO.txt'
    $campaignManifest = Join-Path $repoRoot 'tools\campaign_manifest\generated\mnemosyne.manifest.json'
    $campaignManifestTool = Join-Path $repoRoot 'tools\campaign_manifest\generate.py'
    $campaignPackTool = Join-Path $repoRoot 'tools\campaign_pack\__main__.py'
    $buildRoot = Join-Path $serverDirectory '.build'
    $artifactRoot = Join-Path $serverDirectory '.artifacts'
    $runId = [guid]::NewGuid().ToString('N')
    $systemTemp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
    $campaignPackTempRoot = Join-Path $systemTemp "caos-vtt-campaign-pack-$runId"
    $campaignPackBuild = Join-Path $campaignPackTempRoot 'mnemosyne'
    $stagingRoot = Join-Path $artifactRoot ".staging-$runId"
    $portableDist = Join-Path $stagingRoot 'portable'
    $portableDirectory = Join-Path $portableDist 'CAOS-VTT'
    $finalPortableDist = Join-Path $artifactRoot 'portable'
    $finalPortableDirectory = Join-Path $finalPortableDist 'CAOS-VTT'
    $cloudflaredVersion = '2026.7.2'
    $cloudflaredUrl = 'https://github.com/cloudflare/cloudflared/releases/download/2026.7.2/cloudflared-windows-amd64.exe'
    $cloudflaredSha256 = 'cdb5d4432f6ae1595654a692a51308b69d2bf7af961f5578d9391837cf072df9'
    $cloudflaredCache = Join-Path $serverDirectory ".cache\cloudflared\$cloudflaredVersion\cloudflared.exe"
    $zipName = if ($SkipCampaign -and $SkipTunnel) {
        'CAOS-VTT-portable-demo-local-win.zip'
    }
    elseif ($SkipCampaign) {
        'CAOS-VTT-portable-demo-win.zip'
    }
    elseif ($SkipTunnel) {
        'CAOS-VTT-portable-local-win.zip'
    }
    else {
        'CAOS-VTT-portable-win.zip'
    }
    $zipPath = Join-Path $artifactRoot $zipName
    $hashPath = "$zipPath.sha256"
    $stagingZipPath = Join-Path $stagingRoot $zipName
    $stagingHashPath = "$stagingZipPath.sha256"
    $resolvedCampaignRoot = $null

    Write-Step 'Validando ambiente de build'
    foreach ($safePath in @(
        @{ Path = $serverDirectory; Parent = $repoRoot },
        @{ Path = $frontendDist; Parent = $repoRoot },
        @{ Path = $buildRoot; Parent = $serverDirectory },
        @{ Path = $artifactRoot; Parent = $serverDirectory },
        @{ Path = $campaignPackTempRoot; Parent = $systemTemp },
        @{ Path = $cloudflaredCache; Parent = $serverDirectory }
    )) {
        Assert-RealPathBelow -Path $safePath.Path -ExpectedParent $safePath.Parent
    }
    New-Item -ItemType Directory -Path $artifactRoot -Force | Out-Null
    $lockPath = Join-Path $artifactRoot '.build-portable.lock'
    try {
        $buildLock = [IO.File]::Open(
            $lockPath,
            [IO.FileMode]::OpenOrCreate,
            [IO.FileAccess]::ReadWrite,
            [IO.FileShare]::None
        )
    }
    catch {
        throw 'Outro build portatil ja esta em execucao. Aguarde sua conclusao e tente novamente.'
    }
    if (-not (Test-Path -LiteralPath $venvPython -PathType Leaf)) {
        throw 'O ambiente .venv-vtt nao existe. Execute .\scripts\bootstrap-dev.ps1 primeiro.'
    }
    if (-not (Test-Path -LiteralPath $entrypoint -PathType Leaf)) {
        throw "Entrypoint portatil nao encontrado: '$entrypoint'."
    }
    if (-not (Test-Path -LiteralPath $launcherSource -PathType Leaf)) {
        throw "Launcher portatil nao encontrado: '$launcherSource'."
    }
    if (-not (Test-Path -LiteralPath $readmeSource -PathType Leaf)) {
        throw "Documentacao portatil nao encontrada: '$readmeSource'."
    }
    if (-not (Test-Path -LiteralPath $quickStartSource -PathType Leaf)) {
        throw "Guia rapido portatil nao encontrado: '$quickStartSource'."
    }
    if ($SkipCampaign) {
        if ($PSBoundParameters.ContainsKey('CampaignRoot')) {
            throw 'Use -CampaignRoot ou -SkipCampaign, nunca os dois no mesmo build.'
        }
    }
    else {
        $campaignRootInput = if ($PSBoundParameters.ContainsKey('CampaignRoot')) {
            $CampaignRoot
        }
        else {
            $env:CAOS_VTT_CAMPAIGN_ROOT
        }
        if ([string]::IsNullOrWhiteSpace($campaignRootInput)) {
            throw (
                "A campanha e obrigatoria no pacote portatil. Informe " +
                "-CampaignRoot 'F:\RPG\mnemosyne\projeto-mnemosyne-rpg' ou defina " +
                'CAOS_VTT_CAMPAIGN_ROOT. Use -SkipCampaign somente para gerar um build demo identificado.'
            )
        }
        if (-not (Test-Path -LiteralPath $campaignRootInput -PathType Container)) {
            throw "CampaignRoot nao aponta para uma pasta existente: '$campaignRootInput'."
        }
        $campaignRootItem = Get-Item -LiteralPath $campaignRootInput -Force
        if (($campaignRootItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw 'CampaignRoot nao pode ser link simbolico ou junction.'
        }
        $resolvedCampaignRoot = $campaignRootItem.FullName
        if (-not (Test-Path -LiteralPath $campaignManifest -PathType Leaf)) {
            throw "Manifesto fixo da campanha nao encontrado: '$campaignManifest'."
        }
        if (-not (Test-Path -LiteralPath $campaignManifestTool -PathType Leaf)) {
            throw "Gerador do manifesto da campanha nao encontrado: '$campaignManifestTool'."
        }
        if (-not (Test-Path -LiteralPath $campaignPackTool -PathType Leaf)) {
            throw "Gerador do pack de campanha nao encontrado: '$campaignPackTool'."
        }
    }
    if (-not $SkipTunnel) {
        foreach ($requiredTunnelFile in @(
            $onlineLauncherSource,
            $webOriginConfigSource,
            $cloudflaredLicenseSource,
            $cloudflaredNoticeSource
        )) {
            if (-not (Test-Path -LiteralPath $requiredTunnelFile -PathType Leaf)) {
                throw "Arquivo necessario para o pacote online nao encontrado: '$requiredTunnelFile'."
            }
        }
        if (-not [Environment]::Is64BitOperatingSystem) {
            throw 'O pacote online usa cloudflared Windows AMD64 e precisa ser gerado em Windows x64.'
        }
        # Evite aspas internas: o Windows pode remove-las ao reconstruir argv
        # para executaveis nativos e transformar calcsize("P") em calcsize(P).
        $pythonBitsOutput = & $venvPython -c 'import struct; print(struct.calcsize(chr(80)) * 8)' 2>$null
        $pythonBitsExitCode = $LASTEXITCODE
        $pythonBits = if ($pythonBitsOutput) { @($pythonBitsOutput)[0].Trim() } else { '' }
        if ($pythonBitsExitCode -ne 0 -or $pythonBits -ne '64') {
            throw 'O pacote online precisa de um ambiente .venv-vtt Python 64-bit.'
        }
    }

    & $venvPython -c 'import PyInstaller' 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw 'PyInstaller nao esta instalado. Execute .\.venv-vtt\Scripts\python.exe -m pip install -r .\server\requirements-build.txt.'
    }

    $vttHtml = Join-Path $frontendDist 'vtt.html'
    if ($SkipFrontendBuild -and -not (Test-Path -LiteralPath $frontendIndex -PathType Leaf)) {
        if (Test-Path -LiteralPath $vttHtml -PathType Leaf) {
            Move-Item -LiteralPath $vttHtml -Destination $frontendIndex -Force
        }
    }

    if ($SkipFrontendBuild) {
        Write-Step 'Reutilizando o frontend existente em dist-vtt'
        if (-not (Test-Path -LiteralPath $frontendIndex -PathType Leaf)) {
            throw 'O parametro -SkipFrontendBuild exige dist-vtt\index.html ou dist-vtt\vtt.html ja compilado.'
        }
    }
    else {
        Write-Step 'Compilando o frontend VTT dedicado'
        $npm = Get-Command 'npm' -ErrorAction SilentlyContinue
        if (-not $npm) {
            throw 'npm nao foi encontrado. Instale Node.js no computador de desenvolvimento ou use -SkipFrontendBuild com um dist atualizado.'
        }
        Push-Location $repoRoot
        try {
            Invoke-Checked -FilePath $npm.Source -Arguments @('run', 'build:vtt') -FailureMessage 'A compilacao do frontend VTT falhou'
        }
        finally {
            Pop-Location
        }
    }

    if (Test-Path -LiteralPath $vttHtml -PathType Leaf) {
        Move-Item -LiteralPath $vttHtml -Destination $frontendIndex -Force
    }
    if (-not (Test-Path -LiteralPath $frontendIndex -PathType Leaf)) {
        throw "A build VTT nao produziu '$frontendIndex'."
    }

    Write-Step 'Validando se o frontend compilado corresponde as fontes atuais'
    Assert-FrontendBuildIsFresh -RepoRoot $repoRoot -FrontendDist $frontendDist
    Assert-VttFrontendIsIsolated -FrontendDist $frontendDist

    $cloudflaredBinary = $null
    if ($SkipTunnel) {
        Write-Step 'Gerando variante local menor, sem cloudflared'
    }
    else {
        Write-Step "Preparando cloudflared oficial $cloudflaredVersion"
        $cloudflaredBinary = Get-VerifiedCloudflared `
            -DownloadUrl $cloudflaredUrl `
            -CachePath $cloudflaredCache `
            -ExpectedSha256 $cloudflaredSha256
    }

    Write-Step 'Preparando area transacional de build'
    Remove-SafeDirectory -Path $buildRoot -ExpectedParent $serverDirectory
    Remove-SafeDirectory -Path $stagingRoot -ExpectedParent $artifactRoot
    Remove-SafeDirectory -Path $campaignPackTempRoot -ExpectedParent $systemTemp
    New-Item -ItemType Directory -Path $buildRoot -Force | Out-Null
    New-Item -ItemType Directory -Path $portableDist -Force | Out-Null
    New-Item -ItemType Directory -Path $campaignPackTempRoot -Force | Out-Null

    if ($SkipCampaign) {
        Write-Step 'Build demo solicitado explicitamente; nenhum asset de campanha sera incluido'
    }
    else {
        Write-Step 'Confirmando que o manifesto acompanha a campanha atual'
        Push-Location $repoRoot
        try {
            Invoke-Checked `
                -FilePath $venvPython `
                -Arguments @(
                    '-m', 'tools.campaign_manifest.generate',
                    '--source', $resolvedCampaignRoot,
                    '--output', $campaignManifest,
                    '--check'
                ) `
                -FailureMessage 'O manifesto da campanha esta desatualizado; regenere e revise antes do build'
        }
        finally {
            Pop-Location
        }

        Write-Step 'Gerando pack runtime seletivo da campanha Mnemosyne'
        New-Item -ItemType Directory -Path (Split-Path -Parent $campaignPackBuild) -Force | Out-Null
        Push-Location $repoRoot
        try {
            Invoke-Checked `
                -FilePath $venvPython `
                -Arguments @(
                    '-m', 'tools.campaign_pack',
                    '--manifest', $campaignManifest,
                    '--source-root', $resolvedCampaignRoot,
                    '--output', $campaignPackBuild,
                    '--max-bytes', $MaxCampaignBytes.ToString([Globalization.CultureInfo]::InvariantCulture)
                ) `
                -FailureMessage 'A geracao do pack de campanha falhou'
        }
        finally {
            Pop-Location
        }
        if (-not (Test-Path -LiteralPath (Join-Path $campaignPackBuild 'manifest.json') -PathType Leaf)) {
            throw 'O gerador concluiu sem produzir o manifesto runtime da campanha.'
        }
    }

    Write-Step 'Gerando executavel Windows onedir sem UPX'
    $addData = "$frontendDist;frontend_dist"
    $pyInstallerArguments = @(
        '-m', 'PyInstaller',
        '--noconfirm',
        '--clean',
        '--onedir',
        '--noupx',
        '--console',
        '--name', 'CAOS-VTT',
        '--paths', $serverDirectory,
        '--distpath', $portableDist,
        '--workpath', (Join-Path $buildRoot 'work'),
        '--specpath', (Join-Path $buildRoot 'spec'),
        '--add-data', $addData,
        '--collect-submodules', 'uvicorn',
        '--collect-submodules', 'websockets',
        $entrypoint
    )
    Invoke-Checked -FilePath $venvPython -Arguments $pyInstallerArguments -FailureMessage 'PyInstaller falhou'

    $executable = Join-Path $portableDirectory 'CAOS-VTT.exe'
    if (-not (Test-Path -LiteralPath $executable -PathType Leaf)) {
        throw "PyInstaller concluiu sem gerar '$executable'."
    }
    Copy-Item -LiteralPath $launcherSource -Destination $portableDirectory -Force
    Copy-Item -LiteralPath $readmeSource -Destination $portableDirectory -Force
    Copy-Item -LiteralPath $quickStartSource -Destination $portableDirectory -Force
    if ($SkipCampaign) {
        @(
            'BUILD DEMO SEM CAMPANHA',
            'Este pacote foi gerado explicitamente com -SkipCampaign.'
        ) | Set-Content -LiteralPath (Join-Path $portableDirectory 'DEMO-MODE.txt') -Encoding ascii
    }
    else {
        Write-Step 'Copiando pack verificado adjacente ao executavel'
        $packagedCampaigns = Join-Path $portableDirectory 'campaigns'
        $packagedCampaign = Join-Path $packagedCampaigns 'mnemosyne'
        New-Item -ItemType Directory -Path $packagedCampaign -Force | Out-Null
        foreach ($packItem in @(Get-ChildItem -LiteralPath $campaignPackBuild -Force)) {
            Copy-Item `
                -LiteralPath $packItem.FullName `
                -Destination $packagedCampaign `
                -Recurse `
                -Force
        }
        $packagedManifest = Join-Path $packagedCampaign 'manifest.json'
        Push-Location $repoRoot
        try {
            Invoke-Checked `
                -FilePath $venvPython `
                -Arguments @(
                    '-m', 'tools.campaign_pack',
                    '--manifest', $packagedManifest,
                    '--source-root', $packagedCampaign,
                    '--max-bytes', $MaxCampaignBytes.ToString([Globalization.CultureInfo]::InvariantCulture),
                    '--check'
                ) `
                -FailureMessage 'A copia portatil da campanha falhou na verificacao final'
        }
        finally {
            Pop-Location
        }
    }
    if (-not $SkipTunnel) {
        Copy-Item -LiteralPath $cloudflaredBinary -Destination (Join-Path $portableDirectory 'cloudflared.exe') -Force
        Copy-Item -LiteralPath $onlineLauncherSource -Destination $portableDirectory -Force
        Copy-Item -LiteralPath $webOriginConfigSource -Destination $portableDirectory -Force
        Copy-Item -LiteralPath $cloudflaredLicenseSource -Destination $portableDirectory -Force
        Copy-Item -LiteralPath $cloudflaredNoticeSource -Destination $portableDirectory -Force

        $packagedCloudflaredHash = (
            Get-FileHash -LiteralPath (Join-Path $portableDirectory 'cloudflared.exe') -Algorithm SHA256
        ).Hash.ToLowerInvariant()
        if ($packagedCloudflaredHash -ne $cloudflaredSha256) {
            throw 'A copia empacotada do cloudflared falhou na verificacao SHA-256.'
        }
    }

    if (-not $SkipArchive) {
        Write-Step 'Criando ZIP e hash SHA-256'
        Compress-Archive -Path (Join-Path $portableDirectory '*') -DestinationPath $stagingZipPath -CompressionLevel Optimal -Force
        $hash = (Get-FileHash -LiteralPath $stagingZipPath -Algorithm SHA256).Hash.ToLowerInvariant()
        "$hash  $([IO.Path]::GetFileName($zipPath))" | Set-Content -LiteralPath $stagingHashPath -Encoding ascii
    }

    Write-Step 'Instalando pasta, ZIP e hash como um unico conjunto transacional'
    $portableBackup = Join-Path $artifactRoot ".portable-backup-$runId"
    $zipBackup = Join-Path $artifactRoot ".zip-backup-$runId"
    $hashBackup = Join-Path $artifactRoot ".hash-backup-$runId"
    $movedPreviousPortable = $false
    $movedPreviousZip = $false
    $movedPreviousHash = $false
    $installedPortable = $false
    $installedZip = $false
    $installedHash = $false
    $installedPortableDist = $finalPortableDist
    $installedPortableDirectory = $finalPortableDirectory
    $copyPortableInsteadOfMove = $false
    try {
        if (Test-Path -LiteralPath $finalPortableDist) {
            try {
                Move-Item `
                    -LiteralPath $finalPortableDist `
                    -Destination $portableBackup `
                    -ErrorAction Stop
                $movedPreviousPortable = $true
            }
            catch [System.IO.IOException], [System.UnauthorizedAccessException] {
                $installedPortableDist = Join-Path $artifactRoot "portable-$runId"
                $installedPortableDirectory = Join-Path $installedPortableDist 'CAOS-VTT'
                $copyPortableInsteadOfMove = $true
                Write-Warning (
                    "A pasta portatil anterior esta em uso e foi preservada. " +
                    "A nova pasta sera instalada em '$installedPortableDist'. " +
                    'Feche Explorer/terminais nessa pasta antes do proximo build para recuperar o caminho estavel.'
                )
            }
        }
        if (Test-Path -LiteralPath $zipPath -PathType Leaf) {
            Move-Item -LiteralPath $zipPath -Destination $zipBackup
            $movedPreviousZip = $true
        }
        if (Test-Path -LiteralPath $hashPath -PathType Leaf) {
            Move-Item -LiteralPath $hashPath -Destination $hashBackup
            $movedPreviousHash = $true
        }

        if ($copyPortableInsteadOfMove) {
            Copy-VerifiedTree `
                -Source $portableDist `
                -Destination $installedPortableDist `
                -ExpectedDestinationParent $artifactRoot
        }
        else {
            try {
                Move-Item `
                    -LiteralPath $portableDist `
                    -Destination $installedPortableDist `
                    -ErrorAction Stop
            }
            catch [System.IO.IOException], [System.UnauthorizedAccessException] {
                Write-Warning 'Rename da nova pasta bloqueado; usando copia integral com SHA-256.'
                Copy-VerifiedTree `
                    -Source $portableDist `
                    -Destination $installedPortableDist `
                    -ExpectedDestinationParent $artifactRoot
            }
        }
        $installedPortable = $true
        if (-not $SkipArchive) {
            Move-Item -LiteralPath $stagingZipPath -Destination $zipPath
            $installedZip = $true
            Move-Item -LiteralPath $stagingHashPath -Destination $hashPath
            $installedHash = $true
        }
    }
    catch {
        if ($installedHash -and (Test-Path -LiteralPath $hashPath -PathType Leaf)) {
            Remove-Item -LiteralPath $hashPath -Force
        }
        if ($installedZip -and (Test-Path -LiteralPath $zipPath -PathType Leaf)) {
            Remove-Item -LiteralPath $zipPath -Force
        }
        if ($installedPortable -and (Test-Path -LiteralPath $installedPortableDist)) {
            Remove-SafeDirectory -Path $installedPortableDist -ExpectedParent $artifactRoot
        }
        if ($movedPreviousPortable -and (Test-Path -LiteralPath $portableBackup)) {
            Move-Item -LiteralPath $portableBackup -Destination $finalPortableDist
        }
        if ($movedPreviousZip -and (Test-Path -LiteralPath $zipBackup -PathType Leaf)) {
            Move-Item -LiteralPath $zipBackup -Destination $zipPath
        }
        if ($movedPreviousHash -and (Test-Path -LiteralPath $hashBackup -PathType Leaf)) {
            Move-Item -LiteralPath $hashBackup -Destination $hashPath
        }
        throw
    }
    if ($movedPreviousPortable -and (Test-Path -LiteralPath $portableBackup)) {
        Remove-SafeDirectory -Path $portableBackup -ExpectedParent $artifactRoot
    }
    if ($movedPreviousZip -and (Test-Path -LiteralPath $zipBackup -PathType Leaf)) {
        Remove-Item -LiteralPath $zipBackup -Force
    }
    if ($movedPreviousHash -and (Test-Path -LiteralPath $hashBackup -PathType Leaf)) {
        Remove-Item -LiteralPath $hashBackup -Force
    }

    if (-not $SkipArchive) {
        Write-Host "ZIP:  $zipPath" -ForegroundColor Green
        Write-Host "Hash: $hashPath" -ForegroundColor Green
    }
    elseif ($movedPreviousZip -or $movedPreviousHash) {
        Write-Warning 'O ZIP/hash anterior desta variante foi removido porque -SkipArchive gerou somente a pasta atual.'
    }
    Remove-SafeDirectory -Path $stagingRoot -ExpectedParent $artifactRoot
    Remove-SafeDirectory -Path $buildRoot -ExpectedParent $serverDirectory
    Remove-SafeDirectory -Path $campaignPackTempRoot -ExpectedParent $systemTemp

    Write-Host "`nPacote portatil pronto: $installedPortableDirectory" -ForegroundColor Green
    if ($SkipCampaign) {
        Write-Warning 'Este artefato e DEMO e nao contem a campanha Mnemosyne.'
    }
    else {
        Write-Host 'Campanha Mnemosyne incluida em campaigns\mnemosyne.' -ForegroundColor Green
    }
    if ($SkipTunnel) {
        Write-Host 'Variante local: abra Iniciar C.A.O.S. VTT.cmd.'
    }
    else {
        Write-Host 'Variante online: abra Iniciar C.A.O.S. VTT Online.cmd.'
    }
}
catch {
    if ($stagingRoot -and $artifactRoot -and (Test-Path -LiteralPath $stagingRoot)) {
        try {
            Remove-SafeDirectory -Path $stagingRoot -ExpectedParent $artifactRoot
        }
        catch {
            Write-Warning "Nao foi possivel limpar a area temporaria '$stagingRoot'."
        }
    }
    Write-Host "`nBuild portatil interrompido: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
finally {
    if (
        $campaignPackTempRoot -and
        $systemTemp -and
        (Test-Path -LiteralPath $campaignPackTempRoot)
    ) {
        try {
            Remove-SafeDirectory -Path $campaignPackTempRoot -ExpectedParent $systemTemp
        }
        catch {
            Write-Warning "Nao foi possivel limpar o pack temporario '$campaignPackTempRoot'."
        }
    }
    if ($buildLock) {
        $buildLock.Dispose()
    }
}
