[CmdletBinding()]
param(
    [switch]$SkipFrontendBuild,
    [switch]$SkipArchive,
    [switch]$SkipTunnel
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
    foreach ($requiredName in @('package.json', 'package-lock.json', 'index.html')) {
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
            throw "Bundle referenciado por dist\index.html nao encontrado: '$bundlePath'. Recompile o frontend."
        }
        $distOutputs += Get-Item -LiteralPath $bundlePath
    }

    $oldestOutput = $distOutputs | Sort-Object LastWriteTimeUtc | Select-Object -First 1
    if ($oldestOutput.LastWriteTimeUtc -lt $latestSource.LastWriteTimeUtc) {
        $sourceTimestamp = $latestSource.LastWriteTimeUtc.ToString('yyyy-MM-dd HH:mm:ssZ')
        $outputTimestamp = $oldestOutput.LastWriteTimeUtc.ToString('yyyy-MM-dd HH:mm:ssZ')
        throw (
            "O dist esta obsoleto e nao pode ser reutilizado com -SkipFrontendBuild. " +
            "Fonte mais recente: '$($latestSource.FullName)' ($sourceTimestamp). " +
            "Artefato mais antigo: '$($oldestOutput.FullName)' ($outputTimestamp). " +
            "Execute novamente sem -SkipFrontendBuild para recompilar o frontend."
        )
    }
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

try {
    $repoRoot = Split-Path -Parent $PSScriptRoot
    $serverDirectory = Join-Path $repoRoot 'server'
    $venvPython = Join-Path $repoRoot '.venv-vtt\Scripts\python.exe'
    $entrypoint = Join-Path $serverDirectory 'portable_entry.py'
    $frontendDist = Join-Path $repoRoot 'dist'
    $frontendIndex = Join-Path $frontendDist 'index.html'
    $launcherSource = Join-Path $serverDirectory 'packaging\Iniciar C.A.O.S. VTT.cmd'
    $onlineLauncherSource = Join-Path $serverDirectory 'packaging\Iniciar C.A.O.S. VTT Online.cmd'
    $cloudflaredLicenseSource = Join-Path $serverDirectory 'packaging\cloudflared\LICENSE-cloudflared.txt'
    $cloudflaredNoticeSource = Join-Path $serverDirectory 'packaging\cloudflared\CLOUDFLARED-NOTICE.txt'
    $readmeSource = Join-Path $serverDirectory 'README-PORTABLE.md'
    $buildRoot = Join-Path $serverDirectory '.build'
    $artifactRoot = Join-Path $serverDirectory '.artifacts'
    $portableDist = Join-Path $artifactRoot 'portable'
    $portableDirectory = Join-Path $portableDist 'CAOS-VTT'
    $cloudflaredVersion = '2026.7.2'
    $cloudflaredUrl = 'https://github.com/cloudflare/cloudflared/releases/download/2026.7.2/cloudflared-windows-amd64.exe'
    $cloudflaredSha256 = 'cdb5d4432f6ae1595654a692a51308b69d2bf7af961f5578d9391837cf072df9'
    $cloudflaredCache = Join-Path $serverDirectory ".cache\cloudflared\$cloudflaredVersion\cloudflared.exe"
    $zipName = if ($SkipTunnel) { 'CAOS-VTT-portable-local-win.zip' } else { 'CAOS-VTT-portable-win.zip' }
    $zipPath = Join-Path $artifactRoot $zipName
    $hashPath = "$zipPath.sha256"

    Write-Step 'Validando ambiente de build'
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
    if (-not $SkipTunnel) {
        foreach ($requiredTunnelFile in @(
            $onlineLauncherSource,
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
        $pythonBitsOutput = & $venvPython -c 'import struct; print(struct.calcsize("P") * 8)' 2>$null | Select-Object -First 1
        $pythonBits = if ($pythonBitsOutput) { $pythonBitsOutput.Trim() } else { '' }
        if ($LASTEXITCODE -ne 0 -or $pythonBits -ne '64') {
            throw 'O pacote online precisa de um ambiente .venv-vtt Python 64-bit.'
        }
    }

    & $venvPython -c 'import PyInstaller' 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw 'PyInstaller nao esta instalado. Execute .\.venv-vtt\Scripts\python.exe -m pip install -r .\server\requirements-build.txt.'
    }

    if ($SkipFrontendBuild) {
        Write-Step 'Reutilizando o frontend existente em dist'
        if (-not (Test-Path -LiteralPath $frontendIndex -PathType Leaf)) {
            throw 'O parametro -SkipFrontendBuild exige um dist\index.html ja compilado.'
        }
    }
    else {
        Write-Step 'Compilando o frontend Vite'
        $npm = Get-Command 'npm' -ErrorAction SilentlyContinue
        if (-not $npm) {
            throw 'npm nao foi encontrado. Instale Node.js no computador de desenvolvimento ou use -SkipFrontendBuild com um dist atualizado.'
        }
        Push-Location $repoRoot
        try {
            Invoke-Checked -FilePath $npm.Source -Arguments @('run', 'build') -FailureMessage 'A compilacao do frontend falhou'
        }
        finally {
            Pop-Location
        }
    }

    Write-Step 'Validando se o frontend compilado corresponde as fontes atuais'
    Assert-FrontendBuildIsFresh -RepoRoot $repoRoot -FrontendDist $frontendDist

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

    Write-Step 'Limpando apenas os artefatos portateis anteriores'
    Remove-SafeDirectory -Path $buildRoot -ExpectedParent $serverDirectory
    Remove-SafeDirectory -Path $portableDist -ExpectedParent $artifactRoot
    New-Item -ItemType Directory -Path $buildRoot -Force | Out-Null
    New-Item -ItemType Directory -Path $portableDist -Force | Out-Null
    New-Item -ItemType Directory -Path $artifactRoot -Force | Out-Null
    # Preserve the other variant so the online and local ZIPs can coexist.
    Remove-Item -LiteralPath $zipPath -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $hashPath -Force -ErrorAction SilentlyContinue

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
    if (-not $SkipTunnel) {
        Copy-Item -LiteralPath $cloudflaredBinary -Destination (Join-Path $portableDirectory 'cloudflared.exe') -Force
        Copy-Item -LiteralPath $onlineLauncherSource -Destination $portableDirectory -Force
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
        Compress-Archive -Path (Join-Path $portableDirectory '*') -DestinationPath $zipPath -CompressionLevel Optimal -Force
        $hash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
        "$hash  $([IO.Path]::GetFileName($zipPath))" | Set-Content -LiteralPath $hashPath -Encoding ascii
        Write-Host "ZIP:  $zipPath" -ForegroundColor Green
        Write-Host "Hash: $hashPath" -ForegroundColor Green
    }

    Write-Host "`nPacote portatil pronto: $portableDirectory" -ForegroundColor Green
    if ($SkipTunnel) {
        Write-Host 'Variante local: abra Iniciar C.A.O.S. VTT.cmd.'
    }
    else {
        Write-Host 'Variante online: abra Iniciar C.A.O.S. VTT Online.cmd.'
    }
}
catch {
    Write-Host "`nBuild portatil interrompido: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
